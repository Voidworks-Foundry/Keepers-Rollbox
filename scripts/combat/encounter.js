/** Reads Foundry's encounters for the rules and the panel; anything odd reads as none. See docs/combat.md. */
import { KEEPER, declareSettings, option } from "../utils.js";

/**
 * Declares the Gameplay rules feature switch.
 * @type {object[]}
 */
export const SETTINGS = declareSettings([
  { key: "rollboxGameplay", scope: "world", type: Boolean, default: true, section: "gameplay",
    label: "Gameplay rules",
    hint: "Rollbox's combat rules: an attack starting a fight and who joins it, readied firearms, the weapon-drawn card, "
      + "defeated combatants skipped and the melee reach. Off: none of them run.",
    note: KEEPER }
]);

/**
 * Tells whether the Gameplay rules switch is on.
 * @returns {boolean}
 */
export const gameplayOn = () => option("rollboxGameplay") !== false;

/**
 * Returns the started encounter on the viewed scene, for what the panel draws; rules read runningCombat instead.
 * @returns {Combat|null}
 */
export function viewedCombat() {
  try {
    const combat = globalThis.game?.combat;
    if (!combat?.started) return null;
    const sceneId = combat.scene?.id ?? null;
    const viewed = globalThis.canvas?.scene?.id ?? null;
    if (sceneId && viewed && sceneId !== viewed) return null;
    return combat;
  } catch {
    return null;
  }
}

function startedCombats() {
  try {
    const game = globalThis.game;
    return [...new Set([game?.combat, ...Array.from(game?.combats ?? [])])].filter((combat) => combat?.started);
  } catch {
    return [];
  }
}

const tokenDocOf = (thing) => thing?.document ?? (thing?.documentName === "Token" ? thing : null);

function sceneIdsOf(thing) {
  try {
    const token = tokenDocOf(thing);
    if (token) return token.parent?.id ? [token.parent.id] : [];
    const tokens = typeof thing?.getDependentTokens === "function" ? thing.getDependentTokens() : [];
    return [...new Set(Array.from(tokens ?? [], (doc) => doc?.parent?.id).filter(Boolean))];
  } catch {
    return [];
  }
}

function holds(combat, thing) {
  const token = tokenDocOf(thing);
  const actor = token ? null : thing;
  return turnsOf(combat).some((combatant) => (token ? combatant.tokenId === token.id
    : isCombatantOf(combatant, actor)));
}

function preferred(combats) {
  if (!combats.length) return null;
  try {
    const game = globalThis.game;
    const playersScene = game?.scenes?.active?.id ?? null;
    const order = [game?.combat, game?.combats?.active,
      ...combats.filter((combat) => combat.active && combat.scene?.id === playersScene),
      ...combats.filter((combat) => combat.active)];
    return order.find((combat) => combat && combats.includes(combat)) ?? combats[0];
  } catch {
    return combats[0];
  }
}

/**
 * Returns the started encounter that holds, or else stands on the scene of, those concerned, on any scene.
 * @param {Actor|Token|TokenDocument|Array<Actor|Token|TokenDocument>} [concerned]
 * @returns {Combat|null} null when only another scene has one
 */
export function runningCombat(concerned = null) {
  const combats = startedCombats();
  if (!combats.length) return null;
  const list = (Array.isArray(concerned) ? concerned : [concerned]).filter(Boolean);
  if (!list.length) return preferred(combats);
  const holding = combats.filter((combat) => list.some((thing) => holds(combat, thing)));
  if (holding.length) return preferred(holding);
  const scenes = list.flatMap(sceneIdsOf);
  if (!scenes.length) return preferred(combats);
  return preferred(combats.filter((combat) => !combat.scene || scenes.includes(combat.scene.id)));
}

/**
 * Finds a combatant in any started encounter by its id.
 * @param {string} id
 * @returns {Combatant|null}
 */
export function startedCombatant(id) {
  if (!id) return null;
  for (const combat of startedCombats()) {
    try {
      const combatant = combat.combatants?.get?.(id);
      if (combatant) return combatant;
    } catch {
      // Holds nobody.
    }
  }
  return null;
}

/**
 * Returns the combatants in Foundry's turn order.
 * @param {Combat|null} combat
 * @returns {Combatant[]}
 */
export function turnsOf(combat) {
  try {
    return Array.from(combat?.turns ?? []).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Tells whether a combatant stands for this character, by object or uuid (a token's own actor).
 * @param {Combatant} combatant
 * @param {Actor} actor
 * @returns {boolean}
 */
export function isCombatantOf(combatant, actor) {
  const own = combatant?.actor;
  if (!own || !actor) return false;
  return own === actor || (actor.uuid !== undefined && own.uuid === actor.uuid);
}

/**
 * Returns the character's combatant.
 * @param {Actor} actor
 * @param {Combat|null} [combat]
 * @returns {Combatant|null}
 */
export function combatantFor(actor, combat = runningCombat(actor)) {
  return turnsOf(combat).find((combatant) => isCombatantOf(combatant, actor)) ?? null;
}

/**
 * Returns whose turn it is.
 * @param {Combat|null} [combat]
 * @returns {Combatant|null}
 */
export function currentCombatant(combat = runningCombat()) {
  try {
    return combat?.combatant ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the encounter's round, 0 before it starts.
 * @param {Combat|null} [combat]
 * @returns {number}
 */
export function roundOf(combat = runningCombat()) {
  const round = Number(combat?.round);
  return Number.isFinite(round) ? round : 0;
}
