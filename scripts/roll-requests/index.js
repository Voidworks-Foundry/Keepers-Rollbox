/**
 * Roll requests: the only code that talks to CoC7 about rolls. The Keeper's menus describe what they want as
 * plain data (requests.js); send() turns it into CoC7's own request links, whispered to each character's players
 * or posted in chat, or copies the link. Characters with no player owner (NPCs) are rolled at once on the
 * Keeper's side, privately (keeper-rolls.js). CoC7 rolls, compares and applies every result: Rollbox writes no
 * dice or success-level code. Keeper only: send() does nothing on a player's client. Every CoC7 call is guarded
 * (coc7.js). How each request is built: docs/BUILD-GUIDE.md, "CoC7 links and options".
 * This file is the part's public surface: menus import from here only, never from the files beside it.
 */
import { isKeeper, numberOrNull, tellKeeper, uniqueActors, warn } from "../utils.js";
import { clickCardButton } from "./card-buttons.js";
import { damageRoll, difficultyLevel, isSafeRollKey, rollString, sanityLink } from "./links.js";
import { coc7LinksReady, linkActorClick, ownersOf, requestText, skillsCoC7CantFind } from "./coc7.js";
import { linkForPlan, planCheck, resolveCheck } from "./resolve.js";
import { rollForKeeper } from "./keeper-rolls.js";

export { checkRequest, improvisedRequest, opposedRequest, sanityLoss, sanityRequest, weaponRequest } from "./requests.js";
export { damageText, weaponSkills } from "./resolve.js";
export { ownersOf } from "./coc7.js";
export { DIFFICULTIES, MAX_DICE } from "./links.js";

/** How a request goes out: whispered to each character's players, posted in chat, or copied as a link. */
const MODES = Object.freeze(["whisper", "chat", "link"]);
/** CoC7's card class names (`flags.CoC7.load.as`) for the cards Rollbox clicks. */
const OPPOSED_CARD = "CoC7ChatOpposedMessage";
const SANITY_CARD = "CoC7SanCheckCard";

function skip(result, actor, reason) {
  result.skipped.push({ actor, reason });
}

/** Post one request message: whispered to the owners, or public in chat mode. Never whispered to nobody. */
async function postRequest(actor, owners, mode, content, result) {
  const message = { speaker: { alias: game.user?.name }, content };
  if (mode === "whisper") {
    const whisper = owners.map((user) => user.id).filter(Boolean);
    if (!whisper.length) return skip(result, actor, "no player to whisper to");
    message.whisper = whisper;
  }
  await ChatMessage.create(message);
  result.requested.push(actor);
}

/** A player character: CoC7's link in a message; their player clicks it and CoC7 rolls. */
async function requestFromPlayers(plan, actor, owners, mode, result) {
  const cantFind = await skillsCoC7CantFind(plan.checks);
  if (cantFind.length) {
    tellKeeper(`Rollbox: CoC7 can't find ${cantFind.join(", ")} to add to ${actor.name}'s sheet, so the request `
      + "would do nothing. Add the skill to the sheet first.");
    return skip(result, actor, `CoC7 can't find ${cantFind.join(", ")}`);
  }
  const link = linkForPlan(plan);
  if (!link) {
    tellKeeper(`Rollbox: ${plan.checks.map((c) => c.display).join(", ")} can't go in a CoC7 link (a name holds , : [ ] { } # or &).`);
    return skip(result, actor, "name can't go in a link");
  }
  const damage = plan.damage ? `<br>Damage: ${damageRoll(plan.damage.formula, plan.damage.flavor)}` : "";
  await postRequest(actor, owners, mode, requestText(actor.name, link) + damage, result);
}

/** A Sanity request to one character. */
async function sendSanity(request, actor, owners, mode, result) {
  if (numberOrNull(actor.system?.attribs?.san?.value) === null) return skip(result, actor, "no Sanity value");
  if (owners.length) {
    return postRequest(actor, owners, mode, requestText(actor.name, sanityLink(request)), result);
  }
  // NPC: CoC7's Sanity card on the Keeper's side, and Rollbox clicks its Sanity roll (Void's decision).
  // The card can't be private (Gap 4); the Keeper clicks the rest of it as usual.
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
    warn(`CoC7 couldn't make ${actor.name}'s Sanity card: ${error?.message ?? error}`);
    skip(result, actor, "CoC7 couldn't make the Sanity card");
  }
}

/** One character: a request to their players, or a roll on the Keeper's side for an NPC. */
async function sendTo(request, actor, mode, result) {
  const owners = ownersOf(actor);
  if (owners === null) {
    warn(`CoC7's actor.owners is missing; ${actor.name ?? "a character"} was skipped.`);
    return skip(result, actor, "player owners unknown");
  }
  if (request.type === "sanity") return sendSanity(request, actor, owners, mode, result);
  const plan = planCheck(request, actor);
  if (plan.error) {
    tellKeeper(`Rollbox: ${plan.error}`);
    return skip(result, actor, plan.error);
  }
  if (plan.warning) tellKeeper(`Rollbox: ${plan.warning}`);
  if (owners.length) return requestFromPlayers(plan, actor, owners, mode, result);
  const notRolled = await rollForKeeper(plan, actor);
  if (notRolled) return skip(result, actor, notRolled);
  result.rolled.push(actor);
}

/** Copy link: the request's link, not tied to anyone, to paste anywhere. Nothing is rolled or sent. */
async function copyLink(request, actor, result) {
  let text = null;
  if (request.type === "sanity") {
    text = sanityLink(request);
  } else {
    const plan = planCheck(request, actor);
    if (plan.error) {
      tellKeeper(`Rollbox: ${plan.error}`);
      return result;
    }
    if (plan.warning) tellKeeper(`Rollbox: ${plan.warning}`);
    const link = linkForPlan(plan);
    if (link) text = link + (plan.damage ? ` ${damageRoll(plan.damage.formula, plan.damage.flavor)}` : "");
  }
  if (!text) {
    tellKeeper("Rollbox: this request can't go in a CoC7 link (a name holds , : [ ] { } # or &).");
    return result;
  }
  if (typeof game.clipboard?.copyPlainText !== "function") {
    warn("Foundry's game.clipboard.copyPlainText is missing; the link wasn't copied.");
    return result;
  }
  await game.clipboard.copyPlainText(text);
  globalThis.ui?.notifications?.info?.("Rollbox: request link copied.");
  result.copied = text;
  return result;
}

/** CoC7's roll string for one side of an opposed card: always regular difficulty (see below). */
function opposedRoll(actor, check, dice) {
  // Without a difficulty digit CoC7 uses the world's default difficulty, which can be "unknown"
  // (`parseRolls`); opposed rolls compare success levels at Regular, so it is always sent (p. 92).
  return rollString({ actorUuid: actor.uuid, type: check.kind, key: check.key, dice, difficulty: "regular" });
}

/**
 * An opposed roll: one CoC7 opposed card with both sides filled in, made on the Keeper's side through
 * CoC7's internal link handler (the only call that makes exactly one card, BUILD-GUIDE "Cards: opposed").
 * Then Rollbox clicks the card's Start rolls, which rolls the NPC side (and any character whose player is
 * offline); each player then rolls their own side on the card. A missing skill is added to that
 * character's sheet by CoC7 (Void's decision), after Rollbox checks CoC7 can find it.
 * When no card is made, `result.skipped` says why (with the side's actor, or null for the whole card), so
 * the Opposed roll view can show it.
 */
async function sendOpposed(request, mode, result) {
  const actors = request.sides.map((side) => side.actor);
  if (mode === "link") {
    tellKeeper("Rollbox: an opposed roll can't be copied as a link (CoC7 would make one card per selected token).");
    return result;
  }
  const click = linkActorClick();
  if (!click) {
    warn("CoC7's CoC7Link._onLinkActorClick is missing; no opposed card was made.");
    skip(result, null, "CoC7's opposed card can't be reached");
    return result;
  }
  const sides = request.sides.map((side) => ({ ...side, resolved: resolveCheck(side.actor, side.check) }));
  const unsafe = sides.find((side) => !isSafeRollKey(side.resolved.key));
  if (unsafe) {
    tellKeeper(`Rollbox: ${unsafe.resolved.display} can't go on CoC7's opposed card (its name holds , : [ ] { } # or &).`);
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
  const stopWatching = clickCardButton({ as: OPPOSED_CARD, actorUuids: actors.map((actor) => actor.uuid),
    action: "rollNoPlayers", fallback: "Rollbox: click Start rolls on the opposed card." });
  try {
    await click(actors[0], { check: "check", subtype: "opposed", combat: false, rolls });
    result.requested.push(...actors);
  } catch (error) {
    stopWatching(); // no card is coming: don't ask the Keeper to click Start rolls
    warn(`CoC7 couldn't make the opposed card: ${error?.message ?? error}`);
    skip(result, null, "CoC7 couldn't make the opposed card");
  }
  return result;
}

/**
 * Send a request. Keeper only; on a player's client it does nothing.
 * - `whisper`: each character's request is whispered to their player owners ("Request from player").
 * - `chat`: each character's request is posted publicly ("Send to chat").
 * - `link`: the request's link is copied to the clipboard; nothing is sent or rolled.
 * Characters with no player owner (NPCs) are rolled at once, privately, for the Keeper, in either send mode.
 * Several characters each get their own request. An opposed request carries its own two characters.
 * @param {object} request from checkRequest, sanityRequest, weaponRequest, improvisedRequest or opposedRequest.
 * @param {Iterable<Actor>} [actors] the selected characters.
 * @param {{mode?: "whisper"|"chat"|"link"}} [options]
 * @returns {Promise<{requested: Actor[], rolled: Actor[], skipped: {actor: Actor|null, reason: string}[],
 *   copied: string|null, unavailable: boolean}>} what happened, for the menus to show. `actor` is null
 *   only for an opposed card that couldn't be made at all.
 */
export async function send(request, actors = [], { mode = "whisper" } = {}) {
  const result = { requested: [], rolled: [], skipped: [], copied: null, unavailable: false };
  if (!isKeeper() || !request?.type) return result;
  if (!coc7LinksReady()) {
    warn("CoC7's roll links aren't available (CONFIG.CoC7Link is missing); nothing was sent.");
    result.unavailable = true;
    return result;
  }
  if (!MODES.includes(mode)) {
    warn(`send: unknown mode "${mode}"; nothing was sent.`);
    return result;
  }
  if (request.type === "opposed") return sendOpposed(request, mode, result);
  const list = uniqueActors(actors);
  if (mode === "link") return copyLink(request, list[0] ?? null, result);
  for (const actor of list) {
    try {
      await sendTo(request, actor, mode, result);
    } catch (error) {
      warn(`request for ${actor?.name ?? "a character"} failed: ${error?.message ?? error}`);
      skip(result, actor, "failed");
    }
  }
  return result;
}
