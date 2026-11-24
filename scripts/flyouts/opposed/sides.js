/** The Opposed roll's model: plain-data sides, how they start and follow the selection. See docs/opposed-flyout.md. */
import { actorKey, uniqueActors } from "../../utils.js";
import { checkChoices, groupSkills, skillKey } from "../../skill-values/index.js";
import { ownersOf } from "../../roll-requests/index.js";
import { CHECK_TABS } from "../flyout.js";

/** Returns who rolls this side's card, or "" if its owners can't be read. @param {Actor} actor @returns {string} */
export function whoRolls(actor) {
  const owners = ownersOf(actor);
  if (owners === null) return "";
  if (!owners.length) return "Keeper rolls (NPC), by Start rolls";
  const online = owners.filter((user) => user.active);
  if (!online.length) return "Keeper rolls (player offline), by Start rolls";
  return `${online.map((user) => user.name).filter(Boolean).join(", ")} rolls on the card`;
}

/** Tells whether a value is neither null nor undefined. @param {*} value @returns {boolean} */
export const known = (value) => value !== null && value !== undefined;

/** Returns everyone on a side, its character first. @param {object} side @returns {Actor[]} */
export const members = (side) => (side.actor ? [side.actor, ...(side.group ?? [])] : []);
/** Tells whether a side holds several characters. @param {object} side @returns {boolean} */
export const isGroup = (side) => (side.group?.length ?? 0) > 0;

/** Returns a side's rows; a side of several gets every row without values. @param {object} side @returns {object} */
export function choicesFor(side) {
  if (!isGroup(side)) return checkChoices(side.actor);
  const skill = groupSkills(members(side)).map((row) => ({ key: skillKey(row.name), name: row.name,
    check: { kind: "skill", name: row.name, cocid: row.cocid ?? null }, value: null, trained: true, onSheet: true }));
  return { characteristic: checkChoices(null).characteristic, skill };
}

/**
 * Returns the character's starting pick (row keys by actorKey in `picks`) and that row's tab, or {} without one.
 * @param {Actor} actor @param {Object<string, string>} [picks] @returns {{tab?: string, pick?: object}}
 */
export function startPick(actor, picks) {
  const key = picks?.[actorKey(actor)];
  if (!key) return {};
  const choices = checkChoices(actor);
  for (const tab of CHECK_TABS) {
    const pick = choices[tab.id].find((row) => row.key === key);
    if (pick) return { tab: tab.id, pick };
  }
  return {};
}

/** Returns a side waiting for its character. @returns {object} */
export function emptySide() {
  return { actor: null, group: [], picked: [], anchored: false, tab: CHECK_TABS[0].id, pick: null, dice: 0, search: "" };
}

/**
 * Returns a side for this character with its starting pick; `anchored` when the roll was started from it.
 * @param {Actor} actor @param {Object<string, string>} [picks] @param {boolean} [anchored] @returns {object}
 */
export function sideFor(actor, picks, anchored = false) {
  return { ...emptySide(), actor, anchored, ...startPick(actor, picks) };
}

/**
 * Returns the side with these characters, clearing the pick when its rows change.
 * @param {object} side @param {Actor[]} list @returns {object}
 */
export function withMembers(side, list) {
  const people = uniqueActors(list);
  if (!people.length) return emptySide();
  const wasGroup = isGroup(side);
  const next = { ...side, actor: people[0], group: people.slice(1) };
  const nowGroup = isGroup(next);
  if (wasGroup !== nowGroup || (!nowGroup && !sameCharacter(side.actor, people[0]))) {
    Object.assign(next, { pick: null, search: "", tab: CHECK_TABS[0].id });
  }
  next.picked = (side.picked ?? []).filter((key) => people.some((actor) => actorKey(actor) === key));
  return next;
}

/** Tells whether two actors are the same character. @param {Actor} a @param {Actor} b @returns {boolean} */
export const sameCharacter = (a, b) => Boolean(a && b) && actorKey(a) === actorKey(b);
/** Tells whether the character is on this side. @param {object} side @param {Actor} actor @returns {boolean} */
export const onSide = (side, actor) => members(side).some((member) => sameCharacter(member, actor));

/**
 * Returns the two sides of a newly opened roll; three or more characters form one side of several.
 * @param {Actor[]} actors @param {{first?: string, picks?: Object<string, string>}} [start] @returns {object[]}
 */
export function freshSides(actors, start) {
  const sides = [emptySide(), emptySide()];
  const first = start?.first ? actors.find((actor) => actorKey(actor) === start.first) : null;
  if (first) {
    sides[0] = sideFor(first, start.picks, true);
    const other = actors.length === 2 ? actors.find((actor) => !sameCharacter(actor, first)) : null;
    if (other) sides[1] = sideFor(other, start.picks);
    return sides;
  }
  if (actors.length >= 3) {
    sides[0] = withMembers(emptySide(), actors);
    return sides;
  }
  actors.slice(0, 2).forEach((actor, index) => { sides[index] = sideFor(actor, start?.picks); });
  return sides;
}

/**
 * Updates the sides for a new selection, keeping anchored and picked characters. Mutates `state`.
 * @param {{sides: object[], actors: Actor[]}} state @param {Actor[]} actors @returns {void}
 */
export function refreshSides(state, actors) {
  const selected = new Set(actors.map(actorKey));
  const before = new Set(state.actors.map(actorKey));
  state.sides = state.sides.map((side, index) => {
    const other = state.sides[1 - index];
    if (isGroup(side)) {
      const kept = members(side).filter((actor) => side.picked.includes(actorKey(actor)));
      return withMembers(side, [...actors.filter((actor) => !onSide(other, actor)), ...kept]);
    }
    const stays = side.anchored || side.picked.includes(actorKey(side.actor)) || selected.has(actorKey(side.actor));
    return side.actor && !stays ? emptySide() : side;
  });
  const pool = actors.length === 2 ? actors : actors.filter((actor) => !before.has(actorKey(actor)));
  for (const actor of pool) {
    if (state.sides.some((side) => onSide(side, actor))) continue;
    const index = state.sides.findIndex((side) => !side.actor);
    if (index < 0) break;
    state.sides[index] = sideFor(actor);
  }
  state.actors = [...actors];
}

/**
 * Returns the line that settles a tie by the higher value, since CoC7 8.15's card shows only "Tie".
 * @param {object[]} sides @returns {string} "" when a value is unknown
 */
export function tieText(sides) {
  const [a, b] = sides;
  if (!known(a.pick?.value) || !known(b.pick?.value)) return "";
  if (a.pick.value === b.pick.value) {
    return `On a Tie: equal values (${a.pick.value}), so a stalemate or both re-roll (p. 91).`;
  }
  const [high, low] = a.pick.value > b.pick.value ? [a, b] : [b, a];
  return `On a Tie: ${high.actor.name} wins, higher value (${high.pick.name} ${high.pick.value} `
    + `vs ${low.pick.name} ${low.pick.value}, p. 91).`;
}

/** Returns what is missing before the card can be made, or "". @param {object[]} sides @returns {string} */
export function missingText(sides) {
  const open = sides.filter((side) => !side.pick);
  if (!open.length) return "";
  if (open.length > 1) return "Pick a check for both sides.";
  return isGroup(open[0]) ? "Pick a check for the group." : `Pick a check for ${open[0].actor.name ?? "the other side"}.`;
}
