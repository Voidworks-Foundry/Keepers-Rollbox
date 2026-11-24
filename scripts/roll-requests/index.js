/**
 * Roll requests' public surface: send(), a player's own check and the Keeper relay's handlers; other parts import
 * from here only. See docs/roll-requests.md.
 */
import {
  actorFromUuid, escapeHtml, isActiveKeeper, isKeeper, numberOrNull, tellKeeper, uniqueActors, warn
} from "../utils.js";
import { playerRollboxOn } from "../player/index.js";
import { askKeeper, registerRelay } from "./relay.js";
import { clickCardButton, setRolesWhenJoined } from "./card-buttons.js";
import { damageRoll, difficultyLevel, isSafeRollKey, rollString, sanityLink } from "./links.js";
import {
  callActor, coc7LinksReady, linkActorClick, ownersOf, playsFor, requestText, skillsCoC7CantFind
} from "./coc7.js";
import { linkForPlan, planCheck, resolveCheck } from "./resolve.js";
import { rollForKeeper } from "./keeper-rolls.js";
import { makeOwnCheck } from "./own-rolls.js";
import { keeperTicks } from "./attack.js";
import { maneuverForPlayer, onOpposedRender, restoreManeuvers } from "./maneuver.js";
import { checkRequest, improvisedRequest, opposedRequest, sanityRequest, weaponRequest } from "./requests.js";

export { checkRequest, improvisedRequest, opposedRequest, sanityLoss, sanityRequest, weaponRequest } from "./requests.js";
export { damageText, weaponSkills } from "./resolve.js";
export { callActor, checkResult, ownersOf } from "./coc7.js";
export { checkCardActor, isCheckOf, watchCheck } from "./check-cards.js";
export { CLICK_DELAY_MS, CLICK_TRIES, pickFromCardList, pressCardButton, rollWhenChosen } from "./card-buttons.js";
export { askKeeper, onKeeperRequest } from "./relay.js";
export { DIFFICULTIES, MAX_DICE } from "./links.js";

const OPPOSED_CARD = "CoC7ChatOpposedMessage";
const SANITY_CARD = "CoC7SanCheckCard";

function skip(result, actor, reason) {
  result.skipped.push({ actor, reason });
}

// Foundry makes a message with an empty whisper list public, so a request never goes out without one.
async function postRequest(actor, owners, content, result) {
  const whisper = owners.map((user) => user.id).filter(Boolean);
  if (!whisper.length) return skip(result, actor, "no player to whisper to");
  await ChatMessage.create({ speaker: { alias: game.user?.name }, content, whisper });
  result.requested.push(actor);
}

async function requestFromPlayers(plan, actor, owners, result) {
  const cantFind = await skillsCoC7CantFind(plan.checks);
  if (cantFind.length) {
    tellKeeper(`Rollbox: CoC7 can't find ${cantFind.join(", ")} to add to ${actor.name}'s sheet, so the request `
      + "would do nothing. Add the skill to the sheet first.");
    return skip(result, actor, `CoC7 can't find ${cantFind.join(", ")}`);
  }
  const link = linkForPlan(plan);
  if (!link) {
    tellKeeper(`Rollbox: ${plan.checks.map((c) => c.display).join(", ")} can't go in a CoC7 link (a name holds , : [ ] { } # & < or >).`);
    return skip(result, actor, "name can't go in a link");
  }
  const damage = plan.damage ? `<br>Damage: ${damageRoll(plan.damage.formula, plan.damage.flavor)}` : "";
  await postRequest(actor, owners, requestText(actor.name, link) + damage, result);
}

async function sendSanity(request, actor, owners, result) {
  if (numberOrNull(actor.system?.attribs?.san?.value) === null) return skip(result, actor, "no Sanity value");
  if (owners.length) {
    return postRequest(actor, owners, requestText(actor.name, sanityLink(request)), result);
  }
  // CoC7's Sanity card can't be private, so an NPC's is public; Rollbox presses only its Sanity roll.
  const click = linkActorClick();
  if (!click) {
    warn("CoC7's CoC7Link._onLinkActorClick is missing; the NPC's Sanity card wasn't made.");
    return skip(result, actor, "CoC7's Sanity card can't be reached");
  }
  const stopWatching = clickCardButton({ as: SANITY_CARD, actorUuids: [actor.uuid], action: "rollSanCheck",
    fallback: `Rollbox: click the Sanity roll on ${actor.name}'s Sanity card.` });
  try {
    await click(actor, { check: "sanloss", sanMin: request.success, sanMax: request.failure,
      sanReason: request.creature || undefined, difficulty: difficultyLevel("regular"), poolModifier: 0 });
    result.rolled.push(actor);
  } catch (error) {
    stopWatching(); // no card is coming: don't ask the Keeper to click one
    warn(`CoC7 couldn't make ${actor.name}'s Sanity card.`, error);
    skip(result, actor, "CoC7 couldn't make the Sanity card");
  }
}

// Never a CoC7 link to the Keepers: it names no character, so a Keeper's click would roll their selected tokens.
async function sendTo(request, actor, result, { keeperRolls = false, quiet = false } = {}) {
  const owners = ownersOf(actor);
  if (owners === null) {
    warn(`CoC7's actor.owners is missing; ${actor.name ?? "a character"} was skipped.`);
    return skip(result, actor, "player owners unknown");
  }
  if (request.type === "sanity") return sendSanity(request, actor, owners, result);
  const plan = planCheck(request, actor);
  if (plan.error) {
    tellKeeper(`Rollbox: ${plan.error}`);
    return skip(result, actor, plan.error);
  }
  if (plan.warning) tellKeeper(`Rollbox: ${plan.warning}`);
  if (!keeperRolls && owners.length) return requestFromPlayers(plan, actor, owners, result);
  const notRolled = await rollForKeeper(plan, actor, { quiet, owned: owners.length > 0 });
  if (notRolled) return skip(result, actor, notRolled);
  result.rolled.push(actor);
}

// Whispered rather than a notification, which would fade before the Keeper acts; a notification only as a fallback.
async function noteOpenSide(side, opponent) {
  const who = side.actor?.name ?? "A player";
  const name = opponent?.name ?? "the opponent";
  const lines = [`${who} (${side.resolved.display}) made an opposed card against ${name}. Their check is yours to pick.`,
    `Add ${name}'s side: right-click the check on their sheet (sheet locked) and roll it as an Opposed roll card. `
      + `Rollbox then makes ${who} the attacker and ${name} the defender; press Start rolls when you're ready.`];
  try {
    const whisper = globalThis.ChatMessage.getWhisperRecipients("GM").map((user) => user.id).filter(Boolean);
    if (!whisper.length) throw new Error("no GM to whisper to");
    await ChatMessage.create({ speaker: { alias: "Rollbox" }, whisper,
      content: `<div class="rollbox-open-side">${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>` });
  } catch (error) {
    warn("couldn't whisper the open side's note to the Keepers.", error);
    tellKeeper(`Rollbox: ${lines.join(" ")}`);
  }
}

function opposedRoll(actor, check, dice) {
  // Without a difficulty digit CoC7 8.15 uses the world's default, which can be "unknown" (`parseRolls`);
  // opposed rolls compare success levels at Regular (p. 92).
  return rollString({ actorUuid: actor.uuid, type: check.kind, key: check.key, dice, difficulty: "regular" });
}

// CoC7's internal link handler is the only call that makes exactly one card with both sides.
async function sendOpposed(request, result, byPlayer = false) {
  const open = request.sides.filter((side) => side.open);
  const filled = request.sides.filter((side) => !side.open);
  const actors = filled.map((side) => side.actor);
  const click = linkActorClick();
  if (!click) {
    warn("CoC7's CoC7Link._onLinkActorClick is missing; no opposed card was made.");
    skip(result, null, "CoC7's opposed card can't be reached");
    return result;
  }
  const sides = filled.map((side) => ({ ...side, resolved: resolveCheck(side.actor, side.check) }));
  const unsafe = sides.find((side) => !isSafeRollKey(side.resolved.key));
  if (unsafe) {
    tellKeeper(`Rollbox: ${unsafe.resolved.display} can't go on CoC7's opposed card (its name holds , : [ ] { } # & < or >).`);
    skip(result, unsafe.actor, `${unsafe.resolved.display} can't go on CoC7's opposed card`);
    return result;
  }
  for (const side of sides) {
    const cantFind = await skillsCoC7CantFind([side.resolved]);
    if (cantFind.length) {
      tellKeeper(`Rollbox: CoC7 can't find ${cantFind.join(", ")} to add to ${side.actor.name}'s sheet, so it can't `
        + "make the opposed card. Add the skill to the sheet first.");
      skip(result, side.actor, `CoC7 can't find ${cantFind.join(", ")}`);
      return result;
    }
  }
  const rolls = sides.map((side) => opposedRoll(side.actor, side.resolved, side.dice)).join("&&");
  // A player started it, or a side waits for the Keeper: Start rolls is the Keeper's, not Rollbox's.
  // A side left open: the roles are set once the Keeper's side joins, on the active Keeper's client.
  const roles = open.length && isActiveKeeper() ? setRolesWhenJoined({ playerUuid: actors[0].uuid }) : () => {};
  const stopWatching = byPlayer || open.length ? roles : clickCardButton({ as: OPPOSED_CARD,
    actorUuids: actors.map((actor) => actor.uuid), action: "rollNoPlayers",
    fallback: "Rollbox: click Start rolls on the opposed card." });
  try {
    await click(actors[0], { check: "check", subtype: "opposed", combat: false, rolls });
    result.requested.push(...actors);
    if (open.length) await noteOpenSide(sides[0], open[0].actor);
    else if (byPlayer && actors.some((actor) => !ownersOf(actor)?.length)) {
      tellKeeper("Rollbox: a player started an opposed roll with an NPC. Roll the NPC's side on CoC7's card "
        + "(Start rolls) when you're ready.");
    }
  } catch (error) {
    stopWatching(); // no card is coming: don't ask the Keeper to click Start rolls
    warn("CoC7 couldn't make the opposed card.", error);
    skip(result, null, "CoC7 couldn't make the opposed card");
  }
  return result;
}

const uuidOf = (doc) => doc?.uuid ?? null;

// An opposed card's Start rolls is Keeper-only; an NPC or another player's character needs a GM too.
function needsKeeper(request, actors) {
  if (request.type === "opposed") return true;
  return actors.some((actor) => !playsFor(actor, game.user));
}

function packRequest(request) {
  if (request.type !== "opposed") return request;
  return { ...request, sides: request.sides.map(({ actor, ...side }) => ({ ...side, actorUuid: uuidOf(actor) })) };
}

// Security: a relayed request is rebuilt by the flyouts' own normalisers, so one forged in the console is cleaned or refused.
function unpackRequest(request) {
  if (!request || typeof request !== "object") return null;
  switch (request.type) {
    case "check": return checkRequest(request);
    case "sanity": return sanityRequest({ success: request.success, failure: request.failure, cause: request.label,
      creature: request.creature });
    case "weapon": return weaponRequest(request);
    case "improvised": return improvisedRequest(request);
    case "opposed": {
      const sides = Array.from(request.sides ?? []).map(({ actorUuid, ...side } = {}) => ({ ...side, actor: actorFromUuid(actorUuid) }));
      return sides.every((side) => side.actor) ? opposedRequest({ sides }) : null;
    }
    default: return null;
  }
}

function packResult(result) {
  return { requested: result.requested.map(uuidOf), rolled: result.rolled.map(uuidOf),
    skipped: result.skipped.map(({ actor, reason }) => ({ uuid: uuidOf(actor), reason })),
    unavailable: result.unavailable };
}

function unpackResult(packed, result) {
  result.requested.push(...Array.from(packed?.requested ?? [], actorFromUuid).filter(Boolean));
  result.rolled.push(...Array.from(packed?.rolled ?? [], actorFromUuid).filter(Boolean));
  result.skipped.push(...Array.from(packed?.skipped ?? [], ({ uuid, reason }) => ({ actor: actorFromUuid(uuid), reason })));
  result.unavailable = packed?.unavailable === true;
  return result;
}

async function sendThroughKeeper(request, actors, result, involved = []) {
  const reply = await askKeeper("send", { request: packRequest(request), actorUuids: actors.map(uuidOf),
    involvedUuids: involved.map(uuidOf) });
  if (!reply.ok) {
    skip(result, null, reply.reason);
    return result;
  }
  if (!reply.answer) {
    skip(result, null, "the Keeper's Rollbox couldn't send it");
    return result;
  }
  return unpackResult(reply.answer, result);
}

// A registration, so this part doesn't import a flyout.
let helpersInGroup = null;

/**
 * Registers the Assist part's test that a relayed check's helpers stand in the rollers' Assist group.
 * @param {(rollers: Actor[], helpers: Actor[], user: User) => boolean} check
 * @returns {void}
 */
export function registerHelperCheck(check) {
  helpersInGroup = typeof check === "function" ? check : null;
}

function mayRelay(request, actors, helping, user) {
  if (request.type === "opposed") {
    // A side left open for the Keeper: the side going on the card must be the player's own.
    if (request.sides.some((side) => side.open)) return request.sides.every((side) => side.open || playsFor(side.actor, user));
    return request.sides.some((side) => playsFor(side.actor, user));
  }
  if (!actors.length) return false;
  if (actors.every((actor) => playsFor(actor, user))) return true;
  if (request.type !== "check" || !helping.some((actor) => playsFor(actor, user))) return false;
  // Security: the helper list comes from the player's message, so it is trusted only for NPC rollers or the Assist group.
  if (actors.every((actor) => !(ownersOf(actor) ?? []).length)) return true;
  try {
    return helpersInGroup?.(actors, helping, user) === true;
  } catch (error) {
    warn("couldn't read the Assist group of a player's request.", error);
    return false;
  }
}

async function sendForPlayer({ request, actorUuids = [], involvedUuids = [] } = {}, user) {
  if (!playerRollboxOn()) return null;
  const unpacked = unpackRequest(request);
  const actors = Array.from(actorUuids ?? [], actorFromUuid).filter(Boolean);
  const helping = Array.from(involvedUuids ?? [], actorFromUuid).filter(Boolean);
  if (!unpacked || !mayRelay(unpacked, actors, helping, user)) {
    warn(`refused a request from ${user?.name ?? "a player"}: not a request Rollbox makes, or not for their characters.`);
    return null;
  }
  return packResult(await send(unpacked, actors, { byPlayer: true }));
}

/**
 * Listens on Rollbox's socket channel at ready, with the Keeper's handlers and maneuver hooks on a Keeper's client.
 * @returns {boolean} true when listening
 */
export function registerKeeperRelay() {
  if (!isKeeper() && !playerRollboxOn()) return false;
  if (isKeeper()) Hooks.on("renderChatMessageHTML", onOpposedRender);
  if (isActiveKeeper()) restoreManeuvers().catch((error) => warn("couldn't switch Maneuver back on.", error));
  return registerRelay({ send: sendForPlayer, ticks: keeperTicks, maneuver: maneuverForPlayer });
}

/**
 * Returns the CoC7 roll link a check request would send to this character's players.
 * @param {object} request from checkRequest
 * @param {Actor|null} actor
 * @returns {string|null} null when the request has no link (a name can't go in one)
 */
export function requestLink(request, actor) {
  if (request?.type !== "check") return null;
  const plan = planCheck(request, actor ?? null);
  return plan.error ? null : linkForPlan(plan);
}

/**
 * Has CoC7 make a player's own check on their client at once, with no window; never a request to themselves.
 * @param {object} request from checkRequest
 * @param {Actor} actor the player's own investigator
 * @returns {Promise<{requested: Actor[], rolled: Actor[], skipped: {actor: Actor|null, reason: string}[],
 *   unavailable: boolean}>} `requested` holds the investigator once CoC7 was asked
 */
export async function makeCheck(request, actor) {
  const result = { requested: [], rolled: [], skipped: [], unavailable: false };
  if (request?.type !== "check" || !actor) return result;
  if (!coc7LinksReady()) {
    result.unavailable = true;
    return result;
  }
  const plan = planCheck(request, actor);
  if (plan.error) {
    skip(result, actor, plan.error);
    return result;
  }
  const cantFind = await skillsCoC7CantFind(plan.checks);
  if (cantFind.length) {
    skip(result, actor, `CoC7 can't find ${cantFind.join(", ")}`);
    return result;
  }
  const notMade = makeOwnCheck(plan, actor);
  if (notMade) skip(result, actor, notMade);
  else result.requested.push(actor);
  return result;
}

const CHARACTERISTIC_ROLL = "R/CH";

/**
 * Rolls one characteristic check privately for the Keeper at once, whoever owns the character; Keeper's client only.
 * @param {object} request from checkRequest (one characteristic check)
 * @param {Actor} actor
 * @returns {Promise<boolean>} true when CoC7 rolled it
 */
export async function rollPrivately(request, actor) {
  const [check] = request?.checks ?? [];
  if (!isKeeper() || request?.type !== "check" || request.combined || check?.kind !== "characteristic" || !actor) {
    return false;
  }
  // CoC7 8.15: characteristicCheck from a GM's client posts a standby card for a player-owned character; runRoll doesn't.
  return callActor(actor, "runRoll", { rollType: CHARACTERISTIC_ROLL, characteristic: check.name,
    difficulty: difficultyLevel(request.difficulty), poolModifier: request.dice ?? 0, isBlind: true, fastForward: true,
    preventStandby: true });
}

/**
 * Sends a request: whispered to each character's player owners, an NPC rolled privately for the Keeper at once.
 * Does nothing on a player's client with the Player Rollbox off; what needs a GM goes through the relay.
 * @param {object} request from checkRequest, sanityRequest, weaponRequest, improvisedRequest or opposedRequest
 * @param {Iterable<Actor>} [actors] the selected characters; an opposed request carries its own
 * @param {{involved?: Iterable<Actor>, byPlayer?: boolean, keeperRolls?: boolean, quiet?: boolean}} [options]
 *   `involved`: characters taking part without a roll (Assist's helpers); `byPlayer`: a player started it;
 *   `keeperRolls`: roll every character privately for the Keeper; `quiet`: no Keeper's note before CoC7's card
 * @returns {Promise<{requested: Actor[], rolled: Actor[], skipped: {actor: Actor|null, reason: string}[],
 *   unavailable: boolean}>} `actor` null in `skipped` when nothing could be made or the Keeper's client didn't send it
 */
export async function send(request, actors = [], { involved = [], byPlayer = false, keeperRolls = false, quiet = false } = {}) {
  const result = { requested: [], rolled: [], skipped: [], unavailable: false };
  if (!request?.type) return result;
  if (!isKeeper()) {
    if (!playerRollboxOn()) return result;
    const list = request.type === "opposed" ? [] : uniqueActors(actors);
    if (needsKeeper(request, list)) return sendThroughKeeper(request, list, result, uniqueActors(involved));
  }
  if (!coc7LinksReady()) {
    warn("CoC7's roll links aren't available (CONFIG.CoC7Link is missing); nothing was sent.");
    result.unavailable = true;
    return result;
  }
  const fromPlayer = byPlayer === true && isKeeper();
  if (request.type === "opposed") return sendOpposed(request, result, fromPlayer);
  const list = uniqueActors(actors);
  for (const actor of list) {
    try {
      await sendTo(request, actor, result, { keeperRolls: keeperRolls === true && isKeeper(), quiet: quiet === true });
    } catch (error) {
      warn(`request for ${actor?.name ?? "a character"} failed.`, error);
      skip(result, actor, "failed");
    }
  }
  return result;
}
export {
  SETTINGS as ATTACK_SETTINGS, castSpell, grantAutoHit, loadOneRound, reloadWeapon, startAttack
} from "./attack.js";
export {
  UNARMED_COCID, actorKind, addAttacks, fightingSkill, fightingSkills, isManeuverWeapon, maneuverWeapons, meleeWeapons,
  missingAttacks, setWeaponSkill, skillUnset, switchManeuverOn, unarmedOnSheet, weaponSkillItem
} from "./unarmed.js";
export {
  MANEUVER_OFF_FLAG, answerManeuver, counterWeapons, maneuverRolls, noticeText, postManeuverNotice, readManeuverNotice,
  restoreManeuvers, rollOwnSide
} from "./maneuver.js";
