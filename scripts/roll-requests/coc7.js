/**
 * CoC7 helpers: every read or call of CoC7 that roll-requests makes outside its links, each guarded so a CoC7
 * change makes a request do nothing (with a warning) instead of throwing. Whether CoC7's links are there, its
 * internal link handler, a character's player owners, its request wording, its actor methods, and a read-only
 * copy of its skill lookup, so the Keeper is told before a request that CoC7 would drop.
 */
import { COC7_ID, escapeHtml, warn } from "../utils.js";
import { comparable, isCocid } from "../skill-values/index.js";

/** CoC7's link machinery is in place: the system is CoC7 and its link class is registered (`CoC7Link.init`). */
export function coc7LinksReady() {
  return game.system?.id === COC7_ID && typeof CONFIG?.CoC7Link?.documentClass === "function";
}

/**
 * CoC7's internal link handler (`CoC7Link._onLinkActorClick`), bound to its class: the one call that makes an
 * opposed card or an NPC's Sanity card for one actor. Null when it has gone.
 */
export function linkActorClick() {
  const cls = globalThis.CONFIG?.CoC7Link?.documentClass;
  return typeof cls?._onLinkActorClick === "function" ? cls._onLinkActorClick.bind(cls) : null;
}

/**
 * The character's player owners (CoC7's `actor.owners`: non-GM users with OWNER). Empty for an NPC; null when
 * unreadable.
 */
export function ownersOf(actor) {
  try {
    const owners = actor.owners;
    return Array.isArray(owners) ? owners.filter((user) => user && !user.isGM) : null;
  } catch {
    return null;
  }
}

/** CoC7's wording when it has it ("Your keeper has requested {name} make a {check} roll."), else the same in English. */
export function requestText(name, link) {
  const key = "CoC7.MessageTargetCheckRequested";
  const data = { name: escapeHtml(name), check: link };
  if (game.i18n?.has?.(key)) return game.i18n.format(key, data);
  return `Your keeper has requested ${data.name} make a ${link} roll.`;
}

/** Calls an actor method of CoC7's, guarded. False (with a warning) when it's missing or throws. */
export async function callActor(actor, method, ...args) {
  if (typeof actor?.[method] !== "function") {
    warn(`CoC7's actor.${method} is missing; ${actor?.name ?? "the character"} wasn't rolled.`);
    return false;
  }
  try {
    await actor[method](...args);
    return true;
  } catch (error) {
    warn(`CoC7's actor.${method} failed for ${actor.name}: ${error?.message ?? error}`);
    return false;
  }
}

/** CoC7's era filter on world and compendium skills (`getItemOrAdd`): untagged items are always allowed. */
function eraAllows(item, era) {
  const eras = item?.flags?.[COC7_ID]?.cocidFlag?.eras;
  return !eras || !Object.keys(eras).length || Boolean(eras[era]);
}

/** The part of a skill name CoC7 compares (`guessNameParts`): the specialisation if there is one. */
function coc7NamePart(name) {
  const match = String(name).match(/^([^(]+)\s*\((.+)\)$/);
  return comparable(match ? match[2] : name);
}

/**
 * Whether CoC7 will find a skill that isn't on the sheet, so it can add it when the check is rolled
 * (`getItemOrAdd`, `models/actor/document-class.js`): by CoC ID through `game.CoC7.cocid.fromCoCIDBest`
 * (exactly one match), otherwise by name in the world's items and then every Item compendium, skipping
 * skills tagged for other eras. Read-only. Null when CoC7's lookup can't be reached (Rollbox then
 * sends the request and leaves it to CoC7).
 */
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
    warn(`couldn't check whether CoC7 has the skill "${key}": ${error?.message ?? error}`);
    return null;
  }
}

/**
 * Before CoC7 is asked to add skills (a player's request, an opposed card): the names of missing skills
 * CoC7 can't find. CoC7 would otherwise do nothing when the link is clicked, or fail with "Unknown skill".
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
