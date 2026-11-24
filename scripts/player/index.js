/**
 * Whether players get a Rollbox panel, which features it offers, and each player's own investigator.
 * See docs/player.md.
 */
import { KEEPER, MODULE_ID, declareSettings, getSetting, isKeeper, option, warn } from "../utils.js";

export { cancelPick, pickTarget, picking, targetedToken } from "./targeting.js";

const PLAYER_FEATURES = Object.freeze(["actions", "checks", "combined", "sanity", "luck", "opposed", "assist"]);

const SECTION = "playerRollbox";
const MASTER = "rollboxPlayerRollbox";
const feature = (key, label) => ({ key, scope: "world", type: Boolean, default: true, section: SECTION, label,
  note: KEEPER });

// Never offered to a player, whatever their saved tick box says.
const KEEPER_ONLY = Object.freeze(["sanity", "luck"]);

const FEATURE_KEYS = Object.freeze({
  actions: "rollboxPlayerActions", checks: "rollboxPlayerChecks", combined: "rollboxPlayerCombined",
  sanity: "rollboxPlayerSanity", luck: "rollboxPlayerLuck", opposed: "rollboxPlayerOpposed",
  assist: "rollboxPlayerAssist"
});

/** The Player Rollbox section's settings, registered by settings.js; Sanity and Luck stay registered, hidden. */
export const SETTINGS = declareSettings([
  { key: MASTER, scope: "world", type: Boolean, default: true, section: SECTION,
    label: "Player Rollbox",
    hint: "Players get their own Rollbox panel, with their own investigator and the features ticked in the Player "
      + "Rollbox section below.", note: KEEPER },
  feature(FEATURE_KEYS.actions, "Actions (attacks, maneuvers, spells)"),
  feature(FEATURE_KEYS.checks, "Checks"),
  { ...feature(FEATURE_KEYS.combined, "Combined checks"),
    hint: "Only with Checks on: without Checks it gives nothing. Off: a player ticks one check at a time." },
  { ...feature(FEATURE_KEYS.sanity, "Sanity"), config: false },
  { ...feature(FEATURE_KEYS.luck, "Luck"), config: false },
  feature(FEATURE_KEYS.opposed, "Opposed rolls"),
  feature(FEATURE_KEYS.assist, "Assist")
]);

const PLAYER_MENU = Object.freeze(["action", "check", "other"]);
const MENU_FEATURES = Object.freeze({
  action: ["actions"], check: ["checks"], other: ["opposed", "assist"],
  opposed: ["opposed"], assist: ["assist"]
});

/**
 * Returns whether the Keeper has turned the Player Rollbox on for this world.
 * @returns {boolean}
 */
export function playerRollboxOn() {
  return option(MASTER) === true;
}

/**
 * Returns whether this client runs a Rollbox panel: the Keeper's or a player's, with the user's own switch on.
 * @returns {boolean}
 */
export function panelHere() {
  if (!(isKeeper() || playerRollboxOn())) return false;
  try {
    return getSetting("rollboxEnabled") !== false;
  } catch {
    return false;
  }
}

/**
 * Returns whether another user has their own Rollbox panel switch on, read on the Keeper's client.
 * @param {User} user
 * @returns {boolean} true when unreadable
 */
export function panelOnFor(user) {
  try {
    // Foundry v14: a Keeper's client holds every user's user-scope settings; no document means the default, on.
    const stored = game.settings?.storage?.get?.("world")?.getSetting?.(`${MODULE_ID}.rollboxEnabled`, user?.id ?? null);
    if (!stored) return true;
    return stored.value !== false && stored.value !== "false";
  } catch {
    return true;
  }
}

/**
 * Returns whether the current user may use a feature: the Keeper always; an unknown feature never, for anyone.
 * @param {"actions"|"checks"|"combined"|"sanity"|"luck"|"opposed"|"assist"} feature one of PLAYER_FEATURES
 * @returns {boolean}
 */
export function canUse(feature) {
  if (!Object.hasOwn(FEATURE_KEYS, feature)) return false;
  if (isKeeper()) return true;
  if (feature === "combined" && !canUse("checks")) return false;
  return playerFeatureOn(feature);
}

/**
 * Returns whether the Keeper gives players a feature; the same on every client, so the relay can check a request.
 * @param {"actions"|"checks"|"combined"|"sanity"|"luck"|"opposed"|"assist"} feature one of PLAYER_FEATURES
 * @returns {boolean}
 */
export function playerFeatureOn(feature) {
  const key = Object.hasOwn(FEATURE_KEYS, feature) ? FEATURE_KEYS[feature] : null;
  if (!key || KEEPER_ONLY.includes(feature)) return false;
  return playerRollboxOn() && option(key) === true;
}

function offersMenu(id) {
  if (isKeeper()) return true;
  return (Object.hasOwn(MENU_FEATURES, id) ? MENU_FEATURES[id] : []).some(canUse);
}

/**
 * Returns whether a click on the character sheet may do what it asks (panel/sheet-clicks.js `shortcut`).
 * @param {{open?: string, start?: {section?: string, tab?: string}, opposed?: object}|null} action what the click asks for
 * @returns {boolean}
 */
export function offersClick(action) {
  if (isKeeper()) return true;
  if (!action) return false;
  if (action.opposed) return canUse("opposed");
  if (action.open === "other" && action.start?.section) return canUse(action.start.section);
  if (action.open === "check" && action.start?.tab === "sanity") return false;
  if (action.open === "check") return canUse("checks");
  return offersMenu(action.open);
}

/**
 * Returns the current user's menu buttons, in order, each only when it offers something.
 * @returns {string[]}
 */
export function playerMenu() {
  return PLAYER_MENU.filter(offersMenu);
}

/**
 * Returns each player's own investigator (`ownCharacter`), once each, in the order of Foundry's user list.
 * @returns {{actor: Actor, user: User}[]} one entry per investigator, with the first player it is assigned to
 */
export function investigators() {
  const found = [];
  const seen = new Set();
  try {
    for (const user of Array.from(game.users ?? [])) {
      const actor = user && !user.isGM ? ownCharacter(user) : null;
      const key = actor?.uuid ?? actor;
      if (!actor || seen.has(key)) continue;
      seen.add(key);
      found.push({ actor, user });
    }
  } catch (error) {
    warn("couldn't read the players' investigators.", error);
  }
  return found;
}

/**
 * Returns the character assigned to the user (`User#character`), only when they own it, as a player rolls only for those.
 * @param {User} user
 * @returns {Actor|null} null for a user without a character, or one they don't own
 */
export function ownCharacter(user) {
  try {
    const actor = user?.character ?? null;
    if (!actor) return null;
    return actor.testUserPermission(user, "OWNER") === true ? actor : null;
  } catch (error) {
    warn("couldn't read the user's character.", error);
    return null;
  }
}
