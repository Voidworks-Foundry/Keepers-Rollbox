/** Every change to a fight's encounter, on the Keeper's client, with initiative through CoC7. See docs/combat.md. */
import { MODULE_ID, flagsRemoved, isKeeper, warn } from "../utils.js";
import { currentCombatant, roundOf, runningCombat, turnsOf } from "./encounter.js";
import {
  ACTS_FLAG, ENDS_TURN, KEEP_TURN, LEFT_OUT_FLAG, SKIP_FLAG, STANDBY_FLAG, combatantOfToken, hiddenToken, leftOutOf,
  standingBy
} from "./fight-state.js";

/**
 * Shows a hidden token, as the Keeper's visibility toggle does.
 * @param {Token} token
 * @returns {Promise<void>}
 */
export async function reveal(token) {
  if (!hiddenToken(token)) return;
  try {
    await (token.document ?? token).update({ hidden: false });
  } catch (error) {
    warn("couldn't reveal the attacker's token.", error);
  }
}

// Foundry re-sorts the order on new initiatives, so the turn is put back on whoever had it.
async function rollInitiativeFor(combat, ids) {
  if (!ids.length || typeof combat?.rollInitiative !== "function") return;
  const current = combat.started ? currentCombatant(combat)?.id ?? null : null;
  try {
    await combat.rollInitiative(ids, { updateTurn: false });
  } catch (error) {
    warn("CoC7 couldn't set the initiative of someone Rollbox added.", error);
    return;
  }
  if (!current || currentCombatant(combat)?.id === current) return;
  const index = turnsOf(combat).findIndex((combatant) => combatant.id === current);
  try {
    if (index >= 0) await combat.update({ turn: index }, { [KEEP_TURN]: true });
  } catch (error) {
    warn("couldn't keep the turn where it was.", error);
  }
}

/**
 * Adds tokens to the encounter, each a fighter or standing by, with CoC7's initiative.
 * @param {Combat} combat
 * @param {{token: Token, standing?: "asked"|"out"|null, skipRound?: number}[]} entries
 * @returns {Promise<Combatant[]>}
 */
export async function addCombatants(combat, entries) {
  if (!entries.length) return [];
  const sceneId = combat.scene?.id ?? globalThis.canvas?.scene?.id;
  const data = entries.map(({ token, standing = null, skipRound = null }) => {
    const flags = {};
    if (standing) flags[STANDBY_FLAG] = standing;
    if (skipRound) flags[SKIP_FLAG] = skipRound;
    return { tokenId: token.id, sceneId, actorId: token.document?.actorId ?? token.actor?.id,
      hidden: hiddenToken(token), flags: Object.keys(flags).length ? { [MODULE_ID]: flags } : {} };
  });
  let made = [];
  try {
    made = await combat.createEmbeddedDocuments("Combatant", data) ?? [];
  } catch (error) {
    warn("couldn't add to the encounter.", error);
    return [];
  }
  await rollInitiativeFor(combat, made.map((combatant) => combatant.id));
  return made;
}

/**
 * Returns the scene a token stands on, else the viewed one.
 * @param {Token|TokenDocument} token
 * @returns {Scene|null}
 */
export const sceneOfToken = (token) => (token?.document ?? token)?.parent ?? globalThis.canvas?.scene ?? null;

function unstartedOn(scene) {
  try {
    return Array.from(globalThis.game?.combats ?? []).find((combat) => combat && !combat.started
      && combat.scene?.id === scene.id) ?? null;
  } catch {
    return null;
  }
}

/**
 * Starts an encounter on the first token's scene, reusing one running for them or one the Keeper built there.
 * @param {{token: Token, standing?: "asked"|"out"|null}[]} entries
 * @param {{flags?: object}} [options] Rollbox's flags for the encounter
 * @returns {Promise<Combat|null>}
 */
export async function beginEncounter(entries, { flags = null } = {}) {
  const scene = sceneOfToken(entries[0]?.token);
  if (!scene?.id) return null;
  let combat = runningCombat(entries.map(({ token }) => token)) ?? unstartedOn(scene);
  if (combat && flags) await combat.update({ [`flags.${MODULE_ID}`]: flags });
  if (!combat) {
    const CombatClass = globalThis.getDocumentClass?.("Combat") ?? globalThis.Combat;
    combat = await CombatClass.create({ scene: scene.id, active: true, flags: flags ? { [MODULE_ID]: flags } : {} });
  }
  const fresh = [];
  for (const entry of entries) {
    if (!combatantOfToken(combat, entry.token) && !fresh.some((other) => other.token.id === entry.token.id)) {
      fresh.push(entry);
    }
  }
  await addCombatants(combat, fresh);
  const unrolled = turnsOf(combat).filter((combatant) => combatant.initiative === null
    || combatant.initiative === undefined).map((combatant) => combatant.id);
  await rollInitiativeFor(combat, unrolled);
  if (!combat.started) await combat.startCombat();
  return combat;
}

/**
 * Makes a standing-by combatant a fighter.
 * @param {Combatant} combatant
 * @returns {Promise<boolean>} false for a fighter
 */
export async function becomeFighter(combatant) {
  if (!standingBy(combatant)) return false;
  try {
    await combatant.update(flagsRemoved(STANDBY_FLAG, ACTS_FLAG));
    return true;
  } catch (error) {
    warn("couldn't make a standing-by combatant a fighter.", error);
    return false;
  }
}

// A place already passed this round can't be taken any more, so Act this round counts for the next.
function actingRound(combatant) {
  const combat = combatant.parent ?? runningCombat();
  const round = roundOf(combat);
  const index = turnsOf(combat).indexOf(combatant);
  return index >= 0 && index < Number(combat?.turn ?? 0) ? round + 1 : round;
}

/**
 * Sets or clears a combatant's standing by and Act this round.
 * @param {Combatant} combatant
 * @param {{standing?: "asked"|"out"|null, acts?: boolean}} [changes]
 * @returns {Promise<boolean>}
 */
export async function setStanding(combatant, { standing, acts } = {}) {
  const changes = {};
  if (standing !== undefined) changes[`flags.${MODULE_ID}.${STANDBY_FLAG}`] = standing;
  if (acts !== undefined) {
    if (acts) changes[`flags.${MODULE_ID}.${ACTS_FLAG}`] = actingRound(combatant);
    else Object.assign(changes, flagsRemoved(ACTS_FLAG));
  }
  try {
    await combatant.update(changes);
    return true;
  } catch (error) {
    warn("couldn't change standing by.", error);
    return false;
  }
}

/**
 * Makes each token a fighter, adding it if it isn't in. Keeper only.
 * @param {Combat} combat
 * @param {Token[]} tokens
 * @returns {Promise<number>} how many became fighters
 */
export async function addFighters(combat, tokens) {
  if (!combat || !isKeeper()) return 0;
  await letBackIn(combat, tokens.map((token) => token?.id));
  let count = 0;
  const fresh = [];
  for (const token of tokens) {
    const combatant = combatantOfToken(combat, token);
    if (!combatant) fresh.push({ token });
    else if (await becomeFighter(combatant)) count += 1;
  }
  count += (await addCombatants(combat, fresh)).length;
  return count;
}

/**
 * Keeps tokens out for the rest of the fight.
 * @param {Combat} combat
 * @param {string[]} tokenIds
 * @returns {Promise<void>}
 */
export async function keepOut(combat, tokenIds) {
  const ids = tokenIds.filter(Boolean);
  if (!ids.length) return;
  await combat.setFlag(MODULE_ID, LEFT_OUT_FLAG, [...new Set([...leftOutOf(combat), ...ids])]);
}

async function letBackIn(combat, tokenIds) {
  const left = leftOutOf(combat);
  if (!tokenIds.some((id) => left.has(id))) return;
  try {
    await combat.setFlag(MODULE_ID, LEFT_OUT_FLAG, [...left].filter((id) => !tokenIds.includes(id)));
  } catch (error) {
    warn("couldn't let them back into the fight.", error);
  }
}

/**
 * Ends the turn by giving it to `next` wherever initiative sorted them, or starts the next round with nobody after.
 * @param {Combat} combat
 * @param {Combatant|null} next
 * @returns {Promise<boolean>}
 */
export async function passTurn(combat, next) {
  try {
    const index = next ? turnsOf(combat).indexOf(next) : -1;
    if (index < 0) await combat.nextRound();
    else await combat.update({ turn: index }, { direction: 1, [ENDS_TURN]: true });
    return true;
  } catch (error) {
    warn("couldn't end the turn.", error);
    return false;
  }
}
