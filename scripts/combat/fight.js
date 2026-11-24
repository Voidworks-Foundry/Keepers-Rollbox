/** The first blow, attacks and spells in a fight, standing by, and the turn-start rule. See docs/combat.md. */
import { askKeeper } from "../roll-requests/index.js";
import { MODULE_ID, element, flagsRemoved, isActiveKeeper, isKeeper, sameActor, uniqueActors, warn } from "../utils.js";
import { combatantFor, currentCombatant, gameplayOn, roundOf, runningCombat, turnsOf } from "./encounter.js";
import { tokenOn } from "./sight.js";
import { clearSurprise, surprisedBy } from "./about-to-attack.js";
import { openJoinWindow, showFightNotice } from "./fight-boxes.js";
import { gunDrawn, holsterGun } from "./readied-firearms.js";
import { holdPlayers, releaseAttacks } from "./waiting.js";
import {
  ACTS_FLAG, FIGHT_FLAG, KEEP_TURN, OWN_STEP, STANDBY_FLAG, actingNow, askablePlayer, combatantOfToken, flagOf, isFight,
  joinsOnItsOwn, nearOf, sceneTokens, skipsTurn, standingBy
} from "./fight-state.js";
import {
  addCombatants, addFighters, becomeFighter, beginEncounter, keepOut, passTurn, reveal, sceneOfToken, setStanding
} from "./fight-changes.js";
import { checkWhoIsIn, joinRows } from "./join-list.js";

const FIRST_BLOW_LEAD = "First blow:";

// Foundry v14: `Combat#startCombat` sets round 1, turn 0, so round 1 starts at the top of the order.
async function startFight(attacker, targets, picked = []) {
  if (!sceneOfToken(attacker)) return null;
  const inFight = [attacker, ...targets];
  const fighting = [...inFight, ...picked];
  try {
    await reveal(attacker);
    const flag = { [FIGHT_FLAG]: { attacker: attacker.name ?? "", targets: targets.map((token) => token.name ?? "") } };
    const entries = fighting.map((token) => ({ token }));
    // The first blow is over: any surprise it set ends with it.
    for (const token of inFight) await clearSurprise(token.actor);
    for (const token of sceneTokens()) {
      if (fighting.some((other) => other.id === token.id) || !joinsOnItsOwn(token) || !nearOf(token, fighting)) continue;
      entries.push({ token, standing: askablePlayer(token.actor) ? "asked" : "out" });
    }
    return await beginEncounter(entries, { flags: flag });
  } catch (error) {
    warn("couldn't start the fight.", error);
    return null;
  }
}

// `{ attacker, targets, card, attackers, hit }` of the first blow waiting for Start combat, on the Keeper's client:
// tokens, then the names its line reads (who attacked, who was attacked).
let firstBlow = null;

/**
 * Returns the first blow waiting for Start combat, for the tests and the e2e.
 * @returns {{attacker: Token, targets: Token[]}|null}
 */
export const pendingFirstBlow = () => firstBlow;

/**
 * Forgets the first blow and closes its card.
 * @returns {void}
 */
export function clearFirstBlow() {
  firstBlow?.card?.closeNotice?.();
  firstBlow = null;
}

const nameList = (names) => {
  const list = [...names];
  return list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list.at(-1)}` : (list[0] ?? "");
};

// "the surprise attack" while any target is surprised by its attacker; "the attack" after Saw it coming.
function firstBlowText({ attackers, hit, surprise }) {
  const verb = attackers.size > 1 ? "attack" : "attacks";
  const what = surprise ? "the surprise attack" : "the attack";
  return `${nameList(attackers)} ${verb} ${nameList(hit)}. Finish ${what} on CoC7's cards, then start combat.`;
}

function surprises(attacker, targets) {
  const uuid = attacker.actor?.uuid;
  return Boolean(uuid) && targets.some((token) => surprisedBy(token.actor, uuid));
}

/** Shows the Keeper's First blow card, or adds a further attack's people to the one waiting. */
function noteFirstBlow(attacker, targets) {
  // A card closed by something else (the fight boxes cleared) leaves no first blow behind to add to.
  if (firstBlow && !firstBlow.card?.isConnected) firstBlow = null;
  const name = (token) => token.name ?? token.actor?.name ?? "";
  if (firstBlow) {
    const known = new Set([firstBlow.attacker, ...firstBlow.targets].map((token) => token.id));
    for (const token of [attacker, ...targets]) {
      if (known.has(token.id)) continue;
      known.add(token.id);
      firstBlow.targets.push(token);
    }
    firstBlow.attackers.add(name(attacker));
    for (const token of targets) firstBlow.hit.add(name(token));
    firstBlow.surprise ||= surprises(attacker, targets);
    const line = firstBlow.card?.querySelector?.(".rollbox-fight-notice-text");
    if (line) line.replaceChildren(element("b", "", FIRST_BLOW_LEAD), ` ${firstBlowText(firstBlow)}`);
    releaseAttacks();
    return;
  }
  firstBlow = { attacker, targets: [...targets], attackers: new Set([name(attacker)]),
    hit: new Set(targets.map(name)), surprise: surprises(attacker, targets) };
  firstBlow.card = showFightNotice({ kind: "firstBlow", lead: FIRST_BLOW_LEAD, text: ` ${firstBlowText(firstBlow)}`,
    closeBelow: true, buttons: [["Start combat", () => startFromFirstBlow(), true]],
    onDismiss: () => {
      firstBlow = null;
      holdPlayers("firstBlow", null);
    } });
  holdPlayers("firstBlow", { card: firstBlow.card });
  releaseAttacks();
}

/**
 * Opens Who's joining this fight? for the first blow, starts it when nobody else is near, or joins a running encounter.
 * @returns {Promise<Combat|null|false>} the encounter, null when the window waits for the Keeper, false for nothing
 */
export async function startFromFirstBlow() {
  const blow = firstBlow;
  firstBlow = null;
  holdPlayers("firstBlow", null);
  if (!blow || !isKeeper()) return false;
  const { attacker, targets } = blow;
  const running = runningCombat([attacker, ...targets]);
  if (running) {
    await addFighters(running, [attacker, ...targets]);
    return running;
  }
  const rows = joinRows(null, [attacker, ...targets]);
  if (!rows.length) return startFight(attacker, targets);
  openJoinWindow({ attacker, targets, rows, start: true, onAdd: (tokens) => startFight(attacker, targets, tokens),
    onCancel: () => noteFirstBlow(attacker, targets) });
  return null;
}

/**
 * Notes a first blow out of combat; in one, adds the attacker and targets who aren't in and makes them fighters.
 * @param {Actor} actor the attacker
 * @param {Actor[]} targets
 * @returns {Promise<"firstBlow"|"joined"|false>}
 */
export async function fightBegins(actor, targets) {
  const others = uniqueActors(targets).filter((target) => !sameActor(target, actor));
  const running = runningCombat([actor, ...others]);
  // Tokens on the encounter's scene, which the Keeper may not be viewing; out of combat, the viewed scene's.
  const scene = running?.scene ?? null;
  const attacker = tokenOn(actor, scene);
  if (!attacker) return false;
  const targetTokens = others.map((target) => tokenOn(target, scene)).filter(Boolean);
  if (!running) {
    if (!targetTokens.length) return false;
    noteFirstBlow(attacker, targetTokens);
    return "firstBlow";
  }
  const fresh = [];
  const own = combatantOfToken(running, attacker);
  if (!own) {
    await reveal(attacker);
    fresh.push({ token: attacker, skipRound: roundOf(running) });
  } else {
    await becomeFighter(own);
  }
  for (const token of targetTokens) {
    const combatant = combatantOfToken(running, token);
    if (!combatant) fresh.push({ token });
    else await becomeFighter(combatant);
  }
  await addCombatants(running, fresh);
  return "joined";
}

// The Keeper's client checks that the sender plays the actor (fight-relay.js fightForPlayer).
function askKeeperFight(action, actor, targets) {
  const targetUuids = uniqueActors(targets).map((target) => target.uuid);
  return askKeeper("fight", { action, actorUuid: actor.uuid, targetUuids });
}

/**
 * Makes an attack's characters fighters, or notes the first blow; a player's client asks the Keeper's.
 * @param {{actor: Actor, targets?: Actor[]}} attack
 * @returns {Promise<"firstBlow"|"joined"|false>} "firstBlow" for an attack out of combat (the Keeper starts combat)
 */
export async function attackMade({ actor, targets = [] } = {}) {
  if (!actor || !gameplayOn()) return false;
  if (!isKeeper()) {
    const reply = await askKeeperFight("attack", actor, targets);
    return reply.ok ? reply.answer ?? false : false;
  }
  return fightBegins(actor, targets);
}

/**
 * Makes the caster and targets of a spell in a fight stop standing by; nobody is added.
 * @param {{actor: Actor, targets?: Actor[]}} cast
 * @returns {Promise<boolean>} true when anyone changed
 */
export async function spellCastAt({ actor, targets = [] } = {}) {
  const combat = actor ? runningCombat([actor, ...targets]) : null;
  if (!actor || !combat || !gameplayOn() || !uniqueActors(targets).length) return false;
  if (!isKeeper()) {
    const reply = await askKeeperFight("spell", actor, targets);
    return reply.ok && reply.answer === true;
  }
  let changed = false;
  for (const who of uniqueActors([actor, ...targets])) {
    const combatant = combatantFor(who, combat);
    if (combatant && await becomeFighter(combatant)) changed = true;
  }
  return changed;
}

/**
 * Puts a combatant on standby with their gun put away, ending their turn if it is theirs; `on` false makes a fighter.
 * @param {Combatant} combatant
 * @param {boolean} on
 * @returns {Promise<boolean>} true when changed
 */
export async function placeOnStandby(combatant, on) {
  if (!combatant || !isKeeper()) return false;
  if (!on) return becomeFighter(combatant);
  const combat = combatant.parent ?? runningCombat();
  const acting = actingNow(combatant, combat);
  if (standingBy(combatant) && !acting) return false;
  const theirTurn = Boolean(combat?.started) && currentCombatant(combat) === combatant;
  const turns = turnsOf(combat);
  const next = theirTurn ? turns[turns.indexOf(combatant) + 1] ?? null : null;
  // Someone acting from standby keeps how they stand by ("asked" stays asked); only their acting ends.
  const standing = acting ? undefined : "out";
  if (!(await setStanding(combatant, { standing, acts: false }))) return false;
  await holsterGun(combatant);
  if (theirTurn) await passTurn(combat, next);
  return true;
}

/**
 * Makes someone standing by a fighter when CoC7's Draw gun turns on for them. Active GM only.
 * @param {Combatant} combatant
 * @param {object} changes
 * @returns {Promise<boolean>} true when they became a fighter
 */
export async function onGunDrawn(combatant, changes) {
  if (!isActiveKeeper() || !gameplayOn() || !gunDrawn(changes) || !standingBy(combatant)) return false;
  return becomeFighter(combatant);
}

/**
 * Turns Draw gun off for whoever goes on standby, by any way. Active GM only.
 * @param {Combatant} combatant
 * @param {object} changes
 * @returns {Promise<boolean>} true when Draw gun was turned off
 */
export async function onStandingBy(combatant, changes) {
  const standing = changes?.flags?.[MODULE_ID]?.[STANDBY_FLAG];
  if (!isActiveKeeper() || !gameplayOn() || !standing || !standingBy(combatant)) return false;
  return holsterGun(combatant);
}

/**
 * Removes a combatant and keeps their token out of the rest of the fight. Keeper only.
 * @param {Combatant} combatant
 * @param {Combat} [combat]
 * @returns {Promise<boolean>} true when they left
 */
export async function leaveOut(combatant, combat = combatant?.parent ?? runningCombat()) {
  if (!combatant || !combat || !isKeeper()) return false;
  try {
    if (combatant.tokenId) await keepOut(combat, [combatant.tokenId]);
    await combatant.delete();
    return true;
  } catch (error) {
    warn("couldn't leave them out of the fight.", error);
    return false;
  }
}

// Foundry v14: `Combat#nextRound` takes no options but passes its own, mutable, to `combatRound`, called before
// its first await; the listener is gone again before any other update can start.
function nextRoundWith(combat, extra) {
  const add = (each, data, options) => {
    if (each === combat) Object.assign(options, extra);
  };
  Hooks.on("combatRound", add);
  try {
    return combat.nextRound();
  } finally {
    Hooks.off("combatRound", add);
  }
}

// One update past a whole run of skipped turns, so a standing-by crowd costs one turn start and one redraw.
async function skipOne(combat) {
  const combatant = currentCombatant(combat);
  if (!combatant || !skipsTurn(combatant, combat)) return false;
  const turns = turnsOf(combat);
  if (turns.every((other) => skipsTurn(other, combat))) return false;
  const from = turns.indexOf(combatant);
  const to = turns.findIndex((other, index) => index > from && !skipsTurn(other, combat));
  try {
    if (to < 0) await nextRoundWith(combat, { [OWN_STEP]: true });
    else await combat.update({ turn: to }, { direction: 1, [OWN_STEP]: true });
    return true;
  } catch (error) {
    warn("couldn't skip a standing-by turn.", error);
    return false;
  }
}

/**
 * Clears Act this round for everyone standing by whose acting place has passed; a delayed place is still to come.
 * @param {Combat} combat
 * @returns {Promise<number>} how many went back on standby
 */
export async function backOnStandby(combat) {
  const round = roundOf(combat);
  const turn = Number(combat?.turn ?? 0);
  const updates = turnsOf(combat).flatMap((combatant, index) => {
    const acts = flagOf(combatant, ACTS_FLAG);
    if (!standingBy(combatant) || typeof acts !== "number") return [];
    if (acts > round || (acts === round && index >= turn)) return [];
    return [{ _id: combatant.id, ...flagsRemoved(ACTS_FLAG) }];
  });
  if (!updates.length) return 0;
  try {
    await combat.updateEmbeddedDocuments("Combatant", updates);
    return updates.length;
  } catch (error) {
    warn("couldn't put them back on standby.", error);
    return 0;
  }
}

/**
 * Runs a turn start: standby acting cleared, who is in checked, then the turn skipped if it should be. Active GM only.
 * @param {Combat} combat
 * @param {object} changes Foundry's update data
 * @param {object} [options] the update's options (Rollbox's own turn put back is no turn start; its own skip checks
 *   nobody)
 * @returns {Promise<boolean>} true when it moved the turn
 */
export async function onTurn(combat, changes, options = {}) {
  if (!isActiveKeeper() || !gameplayOn() || !combat?.started || options?.[KEEP_TURN]) return false;
  if (!changes || !("turn" in changes || "round" in changes)) return false;
  await backOnStandby(combat);
  // Not on Rollbox's own skips: someone just added counts from the next turn, so a crowd doesn't pull in its neighbours.
  if (isFight(combat) && !options?.[OWN_STEP]) await checkWhoIsIn(combat);
  return skipOne(combat);
}
