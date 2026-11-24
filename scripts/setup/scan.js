/** The setup check's scan: the questions to ask, and the sure answers saved at once. See docs/setup.md. */
import { MODULE_ID, flagsRemoved, warn } from "../utils.js";
import {
  MANEUVER_OFF_FLAG, actorKind, fightingSkill, isManeuverWeapon, skillUnset, unarmedOnSheet
} from "../roll-requests/index.js";
import { RELOAD_FLAG, isReloadable, reloadSource } from "../shared/index.js";

const skippedNow = new Set();

/**
 * Leaves a question out of later scans until the page is reloaded.
 * @param {{key: string}} issue
 * @returns {void}
 */
export function skipForNow(issue) {
  if (issue?.key) skippedNow.add(issue.key);
}

/**
 * Lists the sheets the scan looks at: world actors, then the current scene's unlinked tokens.
 * @returns {Actor[]}
 */
export function setupActors() {
  const list = [];
  const wanted = (actor) => Boolean(actor) && (actorKind(actor) !== null
    || Array.from(actor.items ?? []).some(isReloadable));
  try {
    for (const actor of game.actors ?? []) if (wanted(actor)) list.push(actor);
    for (const token of globalThis.canvas?.scene?.tokens ?? []) {
      if (token?.actorLink === false && wanted(token.actor)) list.push(token.actor);
    }
  } catch (error) {
    warn("couldn't list the sheets for the setup check.", error);
  }
  return list;
}

function actorIssues(actor) {
  const issues = [];
  const saves = [];
  const items = Array.from(actor.items ?? []);
  const issue = (ask, part, data) => ({ key: `${actor.uuid}|${ask}|${part}`, actor, ask, ...data });
  for (const weapon of items.filter(isReloadable)) {
    const { kind, source } = reloadSource(weapon);
    if (source === "cocid" || source === "rule") saves.push({ _id: weapon.id, [`flags.${MODULE_ID}.${RELOAD_FLAG}`]: kind });
    else if (source === "guess") issues.push(issue("reload", weapon.id, { type: "reload", weapon, guess: kind }));
  }
  // Maneuver left off by a fight back interrupted before roll-requests switched it back on.
  for (const weapon of items.filter((item) => item?.flags?.[MODULE_ID]?.[MANEUVER_OFF_FLAG] === true)) {
    saves.push({ _id: weapon.id, "system.properties.mnvr": true, ...flagsRemoved(MANEUVER_OFF_FLAG) });
  }
  const skill = fightingSkill(actor);
  if (skill) {
    const unarmed = unarmedOnSheet(actor);
    for (const weapon of items.filter((item) => item === unarmed || isManeuverWeapon(item))) {
      if (skillUnset(weapon)) issues.push(issue("skill", weapon.id, { type: "skill", weapon, skill }));
    }
  }
  return { issues: issues.filter((each) => !skippedNow.has(each.key)), saves };
}

/**
 * Scans the sheets, saves the sure answers (one update per actor) and returns the questions.
 * @param {Actor[]} [actors] all of setupActors() by default
 * @returns {Promise<{issues: object[], saved: number, ms: number}>} `ms` excludes the saving
 */
export async function scanSetup(actors = setupActors()) {
  const started = globalThis.performance?.now?.() ?? Date.now();
  const issues = [];
  const batches = [];
  for (const actor of actors) {
    try {
      const found = actorIssues(actor);
      issues.push(...found.issues);
      if (found.saves.length) batches.push([actor, found.saves]);
    } catch (error) {
      warn(`the setup check couldn't read ${actor?.name ?? "a sheet"}.`, error);
    }
  }
  const ms = (globalThis.performance?.now?.() ?? Date.now()) - started;
  let saved = 0;
  for (const [actor, updates] of batches) {
    if (typeof actor.updateEmbeddedDocuments !== "function") continue;
    try {
      await actor.updateEmbeddedDocuments("Item", updates);
      saved += updates.length;
    } catch (error) {
      warn(`couldn't save the changes to ${actor.name ?? "a sheet"}'s weapons (reload kinds, Maneuver back on).`, error);
    }
  }
  return { issues, saved, ms };
}

/**
 * Lists every firearm on the sheets with its reload kind and where it comes from.
 * @param {Actor[]} [actors] all of setupActors() by default
 * @returns {{actor: Actor, weapon: Item, kind: string, source: string}[]}
 */
export function firearmKinds(actors = setupActors()) {
  const list = [];
  for (const actor of actors) {
    try {
      for (const weapon of Array.from(actor.items ?? []).filter(isReloadable)) {
        list.push({ actor, weapon, ...reloadSource(weapon) });
      }
    } catch (error) {
      warn(`the Reload kinds list couldn't read ${actor?.name ?? "a sheet"}.`, error);
    }
  }
  return list;
}
