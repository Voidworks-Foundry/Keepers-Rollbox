/** Who joins a fight: the Keeper's join list, and the turn-start check of who is in range. See docs/combat.md. */
import { warn } from "../utils.js";
import { currentCombatant, turnsOf } from "./encounter.js";
import { feetBetween, inSight } from "./sight.js";
import { closeJoiningCard, showJoiningCard } from "./fight-boxes.js";
import {
  askablePlayer, combatantOfToken, dispositionText, fighterTokens, hiddenToken, isInvestigator, joinRange,
  joinsOnItsOwn, leftOutOf, nearOf, onASide, placeableOf, sceneTokens, standingBy
} from "./fight-state.js";
import { addCombatants, keepOut } from "./fight-changes.js";

/**
 * Lists every token with a character within join range of the fight, nearest first, as rows for the Keeper's window.
 * @param {Combat|null} combat
 * @param {Token[]} inFight
 * @returns {{token: Token, name: string, investigator: boolean, feet: number, tags: string[], ticked: boolean,
 *   combatant: Combatant|null}[]}
 */
export function joinRows(combat, inFight) {
  const range = joinRange();
  const sides = inFight.every(onASide);
  const rows = [];
  for (const token of sceneTokens()) {
    if (inFight.some((other) => other.id === token.id)) continue;
    const feet = Math.min(...inFight.map((other) => feetBetween(token, other) ?? Infinity));
    if (!(feet <= range)) continue;
    const seen = inFight.some((other) => inSight(token, other));
    const asked = Boolean(askablePlayer(token.actor));
    const tags = [];
    if (asked) tags.push("asks their player");
    if (hiddenToken(token)) tags.push("hidden");
    else if (!seen) tags.push("out of sight");
    if (!isInvestigator(token.actor)) tags.push(dispositionText(token));
    rows.push({ token, name: token.name ?? token.actor.name ?? "", investigator: isInvestigator(token.actor),
      feet: Math.round(feet), tags, ticked: sides && seen && joinsOnItsOwn(token) && !asked,
      combatant: combatantOfToken(combat, token) });
  }
  return rows.sort((a, b) => a.feet - b.feet);
}

/**
 * Drops standing-by combatants out of range and lists newcomers in range on the Keeper's joining card.
 * @param {Combat} combat
 * @returns {Promise<void>}
 */
export async function checkWhoIsIn(combat) {
  // Distances and sight are read on the board, so only while the Keeper views the fight's scene.
  if (combat.scene && combat.scene.id !== globalThis.canvas?.scene?.id) return;
  const fighting = fighterTokens(combat);
  if (!fighting.length) return;
  const turns = turnsOf(combat);
  const current = currentCombatant(combat);
  const gone = turns.filter((combatant) => combatant !== current && standingBy(combatant) && placeableOf(combatant)
    && !nearOf(placeableOf(combatant), fighting));
  const inIt = new Set(turns.map((combatant) => combatant.tokenId));
  const leftOut = leftOutOf(combat);
  const fresh = [];
  for (const token of sceneTokens()) {
    if (inIt.has(token.id) || leftOut.has(token.id) || !joinsOnItsOwn(token)) continue;
    const by = nearOf(token, fighting);
    if (by) fresh.push({ token, by });
  }
  try {
    if (gone.length) await combat.deleteEmbeddedDocuments("Combatant", gone.map((combatant) => combatant.id));
  } catch (error) {
    warn("couldn't drop someone out of the fight's range.", error);
  }
  askWhoJoins(combat, fresh);
}

/** Shows the joining card for those who came into range, or closes it when there are none. */
function askWhoJoins(combat, fresh) {
  if (!fresh.length) {
    closeJoiningCard();
    return;
  }
  const entry = (token) => ({ token, standing: askablePlayer(token.actor) ? "asked" : null });
  // Looked up again at the press: the card stays up while the encounter changes, so someone may be in by then.
  const outside = (token) => !combatantOfToken(combat, token);
  const pick = (ids) => fresh.map(({ token }) => token).filter((token) => ids.includes(token.id) && outside(token));
  const leave = async (ids) => {
    try {
      await keepOut(combat, ids);
    } catch (error) {
      warn("couldn't leave them out of the fight.", error);
    }
  };
  showJoiningCard({ key: combat.id, rows: fresh.map(({ token, by }) => ({
    id: token.id, name: token.name ?? token.actor?.name ?? "", by: by.name ?? "a fighter",
    asks: Boolean(askablePlayer(token.actor)),
    onAdd: () => (outside(token) ? addCombatants(combat, [entry(token)]) : []),
    onLeaveOut: () => leave([token.id])
  })),
  onAddAll: (ids) => addCombatants(combat, pick(ids).map(entry)),
  onLeaveAll: (ids) => leave(ids) });
}
