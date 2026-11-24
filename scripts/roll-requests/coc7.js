/** Guarded reads and calls of CoC7 outside its links. See docs/roll-requests.md. */
import { COC7_ID, escapeHtml, warn } from "../utils.js";
import { comparable, isCocid } from "../skill-values/index.js";

/**
 * Returns whether the system is CoC7 and its link class is registered.
 * @returns {boolean}
 */
export function coc7LinksReady() {
  return game.system?.id === COC7_ID && typeof CONFIG?.CoC7Link?.documentClass === "function";
}

/**
 * Returns CoC7's internal `CoC7Link._onLinkActorClick`, bound to its class, which makes a card for one given actor.
 * @returns {Function|null} null when CoC7 no longer has it
 */
export function linkActorClick() {
  const cls = globalThis.CONFIG?.CoC7Link?.documentClass;
  return typeof cls?._onLinkActorClick === "function" ? cls._onLinkActorClick.bind(cls) : null;
}

/**
 * Returns the character's player owners (CoC7's `actor.owners`, GMs left out).
 * @param {Actor} actor
 * @returns {User[]|null} empty for an NPC; null when unreadable
 */
export function ownersOf(actor) {
  try {
    const owners = actor.owners;
    return Array.isArray(owners) ? owners.filter((user) => user && !user.isGM) : null;
  } catch {
    return null;
  }
}

/**
 * Returns whether the user is one of the character's player owners.
 * @param {Actor} actor
 * @param {User} user
 * @returns {boolean}
 */
export function playsFor(actor, user) {
  return (ownersOf(actor) ?? []).some((owner) => owner === user || (owner?.id && owner.id === user?.id));
}

/**
 * Returns CoC7's request sentence around a link, in English when CoC7's string is missing.
 * @param {string} name escaped here
 * @param {string} link
 * @returns {string} HTML
 */
export function requestText(name, link) {
  const key = "CoC7.MessageTargetCheckRequested";
  const data = { name: escapeHtml(name), check: link };
  if (game.i18n?.has?.(key)) return game.i18n.format(key, data);
  return `Your keeper has requested ${data.name} make a ${link} roll.`;
}

/**
 * Returns the first rolled result on a CoC7 check card (`game.CoC7.messageResults`), with `isSuccess`, `type`, `key`.
 * @param {ChatMessage} message
 * @returns {Promise<object|null>} null until rolled, or when unreadable
 */
export async function checkResult(message) {
  try {
    const results = await game.CoC7?.messageResults?.(message);
    const list = Array.isArray(results) ? results : [results];
    return list.find((result) => result?.isRolled === true) ?? null;
  } catch {
    return null;
  }
}

/**
 * Calls one of CoC7's actor methods, guarded.
 * @param {Actor} actor
 * @param {string} method
 * @param {...*} args
 * @returns {Promise<boolean>} false, with a warning, when it is missing or throws
 */
export async function callActor(actor, method, ...args) {
  if (typeof actor?.[method] !== "function") {
    warn(`CoC7's actor.${method} is missing; ${actor?.name ?? "the character"} wasn't rolled.`);
    return false;
  }
  try {
    await actor[method](...args);
    return true;
  } catch (error) {
    warn(`CoC7's actor.${method} failed for ${actor.name}.`, error);
    return false;
  }
}

function eraAllows(item, era) {
  const eras = item?.flags?.[COC7_ID]?.cocidFlag?.eras;
  return !eras || !Object.keys(eras).length || Boolean(eras[era]);
}

function coc7NamePart(name) {
  const match = String(name).match(/^([^(]+)\s*\((.+)\)$/);
  return comparable(match ? match[2] : name);
}

// CoC7 8.15: a read-only copy of `getItemOrAdd`'s lookup (by CoC ID, else by name and era); null when unknown.
async function coc7FindsSkill(key) {
  try {
    if (isCocid(key)) {
      const cocid = game.CoC7?.cocid;
      if (typeof cocid?.fromCoCIDBest !== "function") return null;
      const found = await cocid.fromCoCIDBest({ cocid: key });
      return Array.isArray(found) && found.length === 1;
    }
    let era = "standard";
    try {
      era = game.settings.get(COC7_ID, "worldEra");
    } catch { /* CoC7's setting missing: its default era */ }
    const wanted = coc7NamePart(key);
    const matches = (item) => item?.type === "skill" && eraAllows(item, era)
      && (item.name === key || comparable(item.system?.skillName ?? item.name) === wanted);
    if (Array.from(game.items ?? []).some(matches)) return true;
    for (const pack of Array.from(game.packs ?? [])) {
      if (pack?.documentName !== "Item") continue;
      const index = pack.indexed ? pack.index : await pack.getIndex();
      if (Array.from(index ?? []).some(matches)) return true;
    }
    return false;
  } catch (error) {
    warn(`couldn't check whether CoC7 has the skill "${key}".`, error);
    return null;
  }
}

/**
 * Returns the names of a request's missing skills CoC7 can't find, which CoC7 would drop or fail on.
 * @param {object[]} checks resolved checks (resolve.js)
 * @returns {Promise<string[]>}
 */
export async function skillsCoC7CantFind(checks) {
  const missing = [];
  for (const check of checks) {
    if (check.kind !== "skill" || check.onSheet) continue;
    if (await coc7FindsSkill(check.key) === false) missing.push(check.display);
  }
  return missing;
}
