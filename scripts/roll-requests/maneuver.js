/** Maneuvers on CoC7's opposed card in combat mode: the notice, the answer, the card and its tie. See docs/roll-requests.md. */
import {
  COC7_ID, MODULE_ID, actorFromUuid, dotted, escapeHtml, flagsRemoved, isActiveKeeper, isKeeper,
  itemsOf, tellKeeper, warn
} from "../utils.js";
import { playerRollboxOn } from "../player/index.js";
import { MANEUVER_GOALS, buildOf, maneuverDice } from "../shared/index.js";
import { askKeeper } from "./relay.js";
import { CLICK_DELAY_MS, clickCardButton, isWantedCard, pressControl, pressWhenReady } from "./card-buttons.js";
import { isSafeRollKey, rollString } from "./links.js";
import { callActor, linkActorClick, playsFor } from "./coc7.js";
import {
  fightingSkill, isManeuverWeapon, maneuverWeapons, meleeWeapons, skillUnset, unarmedOnSheet, weaponSkillItem
} from "./unarmed.js";

const NOTICE_FLAG = "maneuver";
const OPPOSED_CARD = "CoC7ChatOpposedMessage";
// CoC7 8.15: the opposed card's roles (`participant`), also the Advantage buttons' values.
const ATTACKER = "A";
const DEFENDER = "D";
const ANSWERS = Object.freeze(["dodge", "fight", "counter", "none"]);
const CARD_WAIT_MS = 15000;
// How many recent chat messages are searched for an opposed card's notice.
const RECENT = 60;
const GOAL_WORDS = Object.freeze({ restrain: "restrain", knockDown: "knock down", disarm: "disarm",
  pushAway: "push away", breakFree: "break free from", knockOut: "knock out" });

const answering = new Set();
// Cards whose Advantage Rollbox pressed, so a redraw doesn't press it again; far more than a fight's open cards.
const advantaged = new Set();
const ADVANTAGED_KEPT = 50;
/** Rollbox's flag on a weapon whose Maneuver it switched off for a fight back. */
export const MANEUVER_OFF_FLAG = "maneuverOff";

/**
 * Returns the notice's sentence: "<attacker> attempts to <goal> (maneuver) <target>."
 * @param {Actor} attacker
 * @param {string} goal
 * @param {Actor} target
 * @returns {string}
 */
export function noticeText(attacker, goal, target) {
  const words = GOAL_WORDS[goal] ?? GOAL_WORDS[MANEUVER_GOALS[0].id];
  return `${attacker?.name ?? "Someone"} attempts to ${words} (maneuver) ${target?.name ?? "their target"}.`;
}

/**
 * Posts the public maneuver notice, spoken by the attacker, with its flag naming who, with what and the goal.
 * @param {{actor: Actor, weapon: Item, target: Actor, goal: string}} maneuver
 * @returns {Promise<ChatMessage|null>}
 */
export async function postManeuverNotice({ actor, weapon, target, goal }) {
  if (!actor?.uuid || !target?.uuid || !weapon?.id || typeof globalThis.ChatMessage?.create !== "function") return null;
  try {
    const speaker = globalThis.ChatMessage.getSpeaker?.({ actor }) ?? { alias: actor.name };
    return await ChatMessage.create({ speaker,
      content: `<div class="rollbox-maneuver-notice"><p>${escapeHtml(noticeText(actor, goal, target))}</p></div>`,
      flags: { [MODULE_ID]: { [NOTICE_FLAG]: { attacker: actor.uuid, target: target.uuid, weapon: weapon.id, goal,
        answer: null, defence: null, card: null } } } }) ?? null;
  } catch (error) {
    warn("couldn't post the maneuver notice.", error);
    return null;
  }
}

// Security: anyone can post a message with this flag, so only a GM or a player of the attacker may speak for it.
function trustedAuthor(message, attackerUuid) {
  const author = message?.author ?? null;
  if (author?.isGM === true) return true;
  return Boolean(author) && playsFor(actorFromUuid(attackerUuid), author);
}

/**
 * Returns what a maneuver notice says; null for any other message or an untrusted author.
 * @param {ChatMessage} message
 * @returns {{id: string, attacker: string, target: string, weapon: string, goal: string, answer: string|null,
 *   defence: string|null, card: string|null}|null} `defence`: the target's weapon for Fight back or Counter
 */
export function readManeuverNotice(message) {
  try {
    const flag = message?.flags?.[MODULE_ID]?.[NOTICE_FLAG];
    if (!message?.id || !flag?.attacker || !flag?.target || !flag?.weapon) return null;
    if (!trustedAuthor(message, String(flag.attacker))) return null;
    return { id: message.id, attacker: String(flag.attacker), target: String(flag.target), weapon: String(flag.weapon),
      goal: String(flag.goal ?? ""), answer: ANSWERS.includes(flag.answer) ? flag.answer : null,
      defence: flag.defence ? String(flag.defence) : null, card: flag.card ? String(flag.card) : null };
  } catch {
    return null;
  }
}

// CoC7's getItemOrAdd takes a name or a uuid; Roll damage finds a winner's weapon by name, so a unique name wins.
function itemKey(actor, item) {
  const name = String(item?.name ?? "");
  const same = itemsOf(actor).filter((each) => each?.type === item?.type && each?.name === name).length;
  return isSafeRollKey(name) && same === 1 ? name : item.uuid;
}

function dodgeKey(actor) {
  const dodge = itemsOf(actor).find((item) => item?.type === "skill" && item.system?.isDodge === true);
  return dodge && isSafeRollKey(dodge.name) ? dodge.name : "Dodge";
}

// The weapon's skill instead when CoC7 can't roll the weapon, or `asSkill`: CoC7 would call a Maneuver-on win a maneuver.
function weaponSide(actor, weapon, dice, asSkill = false) {
  if (!asSkill && !skillUnset(weapon)) return { actorUuid: actor.uuid, type: "item", key: itemKey(actor, weapon), dice };
  const skill = weaponSkillItem(actor, weapon) ?? fightingSkill(actor);
  if (!skill || !isSafeRollKey(skill.name)) return null;
  return { actorUuid: actor.uuid, type: "skill", key: skill.name, dice };
}

/**
 * Returns the weapons a character can counter a maneuver with, the unarmed weapon first.
 * @param {Actor} actor
 * @returns {Item[]}
 */
export function counterWeapons(actor) {
  const list = maneuverWeapons(actor);
  const unarmed = unarmedOnSheet(actor);
  return unarmed && list.includes(unarmed) ? [unarmed, ...list.filter((item) => item !== unarmed)] : list;
}

/**
 * Returns the two roll strings for CoC7's opposed card, attacker first, and the tie's Advantage by the rules.
 * @param {{attacker: Actor, weapon: Item, target: Actor, answer: string, defence?: Item|null, fightAsSkill?: boolean}} plan
 * @returns {{rolls: string[], advantage: "A"|"D"}|{error: string}}
 */
export function maneuverRolls({ attacker, weapon, target, answer, defence = null, fightAsSkill = false }) {
  if (!attacker?.uuid || !target?.uuid) return { error: "the attacker or the target can't be found" };
  if (!weapon || !maneuverWeapons(attacker).some((each) => each.id === weapon.id)) {
    return { error: `${attacker.name} has no such maneuver weapon` };
  }
  const own = maneuverDice(buildOf(attacker), buildOf(target));
  if (own.impossible) return { error: `${target.name} is too big for ${attacker.name}'s maneuver (p. 105)` };
  if (skillUnset(weapon)) return { error: `${weapon.name} has no skill on ${attacker.name}'s sheet` };
  const attack = { actorUuid: attacker.uuid, type: "item", key: itemKey(attacker, weapon), dice: own.dice };
  let defend = null;
  if (answer === "dodge") defend = { actorUuid: target.uuid, type: "skill", key: dodgeKey(target), dice: 0 };
  else if (answer === "fight") {
    if (!defence || !meleeWeapons(target).some((each) => each.id === defence.id)) {
      return { error: `${target.name} has no such weapon to fight back with` };
    }
    defend = weaponSide(target, defence, 0, fightAsSkill && isManeuverWeapon(defence));
  } else if (answer === "counter") {
    const counter = defence ?? counterWeapons(target)[0];
    if (!counter || !maneuverWeapons(target).some((each) => each.id === counter.id)) {
      return { error: `${target.name} has no maneuver weapon to counter with` };
    }
    const theirs = maneuverDice(buildOf(target), buildOf(attacker));
    if (theirs.impossible) return { error: `${attacker.name} is too big for ${target.name}'s counter (p. 105)` };
    defend = weaponSide(target, counter, theirs.dice);
  } else return { error: "no such answer" };
  if (!defend) return { error: `${target.name}'s side has no skill CoC7 can roll` };
  const rolls = [attack, defend].map((side) => rollString({ ...side, difficulty: "regular" }));
  return { rolls, advantage: answer === "dodge" ? DEFENDER : ATTACKER };
}

// Foundry: only a Keeper may update another user's message.
async function noteOnNotice(message, changes) {
  try {
    const flat = Object.fromEntries(Object.entries(changes)
      .map(([key, value]) => [`flags.${MODULE_ID}.${NOTICE_FLAG}.${key}`, value]));
    await message.update(flat);
    return true;
  } catch (error) {
    warn("couldn't note the answer on the maneuver notice.", error);
    return false;
  }
}

/** Watches for the opposed card CoC7 is about to post; `posted` is null after CARD_WAIT_MS or once stopped. */
function watchCard(actorUuids) {
  let stop = () => {};
  const posted = new Promise((resolve) => {
    const finish = (value) => {
      Hooks.off("createChatMessage", hookId);
      clearTimeout(timer);
      resolve(value);
    };
    const hookId = Hooks.on("createChatMessage", (message) => {
      if (isWantedCard(message, OPPOSED_CARD, actorUuids) && message.flags?.[COC7_ID]?.load?.isCombat === true) {
        finish(message);
      }
    });
    const timer = setTimeout(() => finish(null), CARD_WAIT_MS);
    stop = () => finish(null);
  });
  return { posted, stop };
}

async function setManeuver(weapon, on) {
  if (!weapon) return false;
  const changes = on
    ? { "system.properties.mnvr": true, ...flagsRemoved(MANEUVER_OFF_FLAG) }
    : { "system.properties.mnvr": false, [`flags.${MODULE_ID}.${MANEUVER_OFF_FLAG}`]: true };
  try {
    await weapon.update(changes);
    return true;
  } catch (error) {
    warn(`couldn't switch Maneuver ${on ? "back on" : "off"} for ${weapon.name ?? "the weapon"}.`, error);
    return false;
  }
}

/**
 * Switches Maneuver back on for every weapon Rollbox left off (the page closed mid-card), one update per sheet.
 * @param {Actor[]} [actors] the sheets to look at; the world's and the current scene's unlinked tokens' by default
 * @returns {Promise<number>} how many weapons were switched back on
 */
export async function restoreManeuvers(actors = sheetsInPlay()) {
  let restored = 0;
  for (const actor of actors) {
    const updates = itemsOf(actor).filter((item) => item?.flags?.[MODULE_ID]?.[MANEUVER_OFF_FLAG] === true)
      .map((item) => ({ _id: item.id, "system.properties.mnvr": true, ...flagsRemoved(MANEUVER_OFF_FLAG) }));
    if (!updates.length) continue;
    try {
      await actor.updateEmbeddedDocuments("Item", updates);
      restored += updates.length;
    } catch (error) {
      warn(`couldn't switch Maneuver back on for ${actor.name ?? "a sheet"}'s weapons.`, error);
    }
  }
  return restored;
}

// Unlinked tokens each hold their own copy of their items.
function sheetsInPlay() {
  const list = [];
  try {
    for (const actor of game.actors ?? []) list.push(actor);
    for (const token of globalThis.canvas?.scene?.tokens ?? []) {
      if (token?.actorLink === false && token.actor) list.push(token.actor);
    }
  } catch (error) {
    warn("couldn't list the sheets to check for a weapon left with Maneuver off.", error);
  }
  return list;
}

/** On the Keeper's client, makes CoC7's opposed card for an answered maneuver and presses Start Rolls. */
async function makeManeuverCard(message, choice = {}) {
  const notice = readManeuverNotice(message);
  if (!notice) return { ok: false, reason: "no such maneuver" };
  // Two answers close together would both read the notice unanswered before either writes it: one card per notice.
  if (answering.has(notice.id)) return { ok: false, reason: "the maneuver is being answered" };
  answering.add(notice.id);
  try {
    return await answerNotice(message, notice, choice);
  } finally {
    answering.delete(notice.id);
  }
}

async function answerNotice(message, notice, { answer, weaponId = null, bonus = 0 } = {}) {
  if (notice.answer) return { ok: false, reason: "the maneuver was already answered" };
  const attacker = actorFromUuid(notice.attacker);
  const target = actorFromUuid(notice.target);
  const weapon = itemsOf(attacker).find((item) => item.id === notice.weapon) ?? null;
  if (answer === "none") return unopposedManeuver(message, attacker, weapon, target, bonus);
  const defence = weaponId ? itemsOf(target).find((item) => item.id === weaponId) ?? null : null;
  // A Maneuver-on weapon fights back as a weapon: its Maneuver is off while CoC7 makes the card (setManeuver).
  const fightSwitch = answer === "fight" && isManeuverWeapon(defence) && !skillUnset(defence);
  let plan = maneuverRolls({ attacker, weapon, target, answer, defence });
  if (plan.error) {
    tellKeeper(`Rollbox: no maneuver card: ${plan.error}.`);
    return { ok: false, reason: plan.error };
  }
  const click = linkActorClick();
  if (!click) {
    warn("CoC7's CoC7Link._onLinkActorClick is missing; no maneuver card was made.");
    return { ok: false, reason: "CoC7's opposed card can't be reached" };
  }
  if (!(await noteOnNotice(message, { answer, defence: defence?.id ?? null }))) {
    return { ok: false, reason: "the notice couldn't be updated" };
  }
  const uuids = [attacker.uuid, target.uuid];
  const watch = watchCard(uuids);
  watch.posted.then((posted) => { if (posted) noteOnNotice(message, { card: posted.id }); });
  const stopStarting = clickCardButton({ as: OPPOSED_CARD, actorUuids: uuids, action: "rollNoPlayers",
    fallback: "Rollbox: press Start Rolls on CoC7's opposed card." });
  let switched = false;
  try {
    if (fightSwitch) {
      switched = await setManeuver(defence, false);
      if (!switched) plan = maneuverRolls({ attacker, weapon, target, answer, defence, fightAsSkill: true });
    }
    await click(attacker, { check: "check", subtype: "opposed", combat: true, rolls: plan.rolls.join("&&") });
    // CoC7 doesn't wait for its card before returning; it reads Maneuver as it adds each row, before posting it.
    if (switched) await watch.posted;
    return { ok: true };
  } catch (error) {
    watch.stop();
    stopStarting();
    await noteOnNotice(message, { answer: null });
    warn("CoC7 couldn't make the maneuver card.", error);
    return { ok: false, reason: "CoC7 couldn't make the opposed card" };
  } finally {
    if (switched) await setManeuver(defence, true);
  }
}

// No response: CoC7 rolls the attacker's skill alone, with the Build dice; a success means the maneuver works (p. 105).
async function unopposedManeuver(message, attacker, weapon, target, bonus = 0) {
  if (!attacker || !target || !weapon) return { ok: false, reason: "the attacker or the target can't be found" };
  const own = maneuverDice(buildOf(attacker), buildOf(target));
  if (own.impossible) return { ok: false, reason: `${target.name} is too big for ${attacker.name}'s maneuver (p. 105)` };
  const skill = weaponSkillItem(attacker, weapon) ?? fightingSkill(attacker);
  if (!skill) return { ok: false, reason: `${weapon.name} has no skill on ${attacker.name}'s sheet` };
  if (!(await noteOnNotice(message, { answer: "none" }))) return { ok: false, reason: "the notice couldn't be updated" };
  const dice = Math.max(-2, Math.min(2, own.dice + (Number(bonus) > 0 ? 1 : 0)));
  if (await callActor(attacker, "skillCheck", skill.name, true, { poolModifier: dice })) return { ok: true };
  await noteOnNotice(message, { answer: null });
  return { ok: false, reason: "CoC7 couldn't roll the maneuver" };
}

/**
 * Presses the player's own row on the maneuver's opposed card once Start Rolls has run, as they would.
 * @param {Actor} target the player's character on the card
 * @param {Actor} attacker
 * @returns {() => void} stops the watch
 */
export function rollOwnSide(target, attacker) {
  if (!target?.uuid || !attacker?.uuid) return () => {};
  const mine = dotted(target.uuid);
  const hookId = Hooks.on("renderChatMessageHTML", (message, html) => {
    const load = message?.flags?.[COC7_ID]?.load;
    if (load?.as !== OPPOSED_CARD || load.isCombat !== true) return;
    const uuids = (load.actorUuids ?? []).map(dotted);
    if (!uuids.includes(mine) || !uuids.includes(dotted(attacker.uuid))) return;
    const button = Array.from(html?.querySelectorAll?.('[data-action="rollActor"]') ?? [])
      .find((node) => dotted(node.dataset.actorUuid) === mine);
    if (!button) return;
    stop();
    // CoC7 attaches the card's listeners after its own async render handler.
    setTimeout(() => { if (!button.disabled) pressControl(button); }, CLICK_DELAY_MS);
  });
  const timer = setTimeout(() => stop(), CARD_WAIT_MS * 4);
  function stop() {
    Hooks.off("renderChatMessageHTML", hookId);
    clearTimeout(timer);
  }
  return stop;
}

function noticeOfCard(cardId) {
  try {
    const recent = Array.from(game.messages?.contents ?? []).slice(-RECENT).reverse();
    for (const message of recent) {
      const notice = readManeuverNotice(message);
      if (notice?.card === cardId) return notice;
    }
  } catch {
    // no notice can be read
  }
  return null;
}

/**
 * Presses the tie's Advantage the rules give on a maneuver's opposed card, on the active Keeper's client.
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 * @returns {void}
 */
export function onOpposedRender(message, html) {
  if (!isActiveKeeper()) return;
  const load = message?.flags?.[COC7_ID]?.load;
  if (load?.as !== OPPOSED_CARD || load.isCombat !== true) return;
  if (advantaged.has(message?.id) || load.cardOpen !== true) return;
  const buttons = Array.from(html?.querySelectorAll?.('[data-action="setValue"][data-set="advantage"]') ?? []);
  if (!buttons.length || buttons.some((node) => node.classList?.contains("switched-on"))) return;
  const notice = noticeOfCard(message.id);
  if (!notice?.answer) return;
  advantaged.add(message.id);
  if (advantaged.size > ADVANTAGED_KEPT) advantaged.delete(advantaged.values().next().value);
  const value = notice.answer === "dodge" ? DEFENDER : ATTACKER;
  pressWhenReady(html, `[data-action="setValue"][data-set="advantage"][data-value="${value}"]`,
    `Rollbox: the maneuver tied; press ${value === DEFENDER ? "Advantage: Defender" : "Advantage: Attacker"} on CoC7's card.`);
}

/**
 * Answers a player's maneuver answer relayed to the Keeper's client, for a notice whose target they play.
 * @param {{noticeId: string, answer: string, weaponId?: string|null}} payload
 * @param {User} user the sending player
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function maneuverForPlayer({ noticeId, answer, weaponId = null } = {}, user) {
  if (!playerRollboxOn()) return { ok: false, reason: "the Player Rollbox is off" };
  const message = game.messages?.get?.(String(noticeId ?? "")) ?? null;
  const notice = readManeuverNotice(message);
  if (!notice || !ANSWERS.includes(answer) || !playsFor(actorFromUuid(notice.target), user)) {
    warn(`refused a maneuver answer from ${user?.name ?? "a player"}: not their character's maneuver.`);
    return { ok: false, reason: "not your character's maneuver" };
  }
  return makeManeuverCard(message, { answer, weaponId: weaponId ? String(weaponId) : null });
}

/**
 * Answers a maneuver: the card is made on the Keeper's client, through the relay from a player's.
 * @param {string} noticeId
 * @param {{answer: "dodge"|"fight"|"counter", weaponId?: string|null}} choice
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function answerManeuver(noticeId, choice) {
  if (isKeeper()) return makeManeuverCard(game.messages?.get?.(noticeId) ?? null, choice);
  const reply = await askKeeper("maneuver", { noticeId, answer: choice?.answer, weaponId: choice?.weaponId ?? null });
  if (!reply.ok) return { ok: false, reason: reply.reason };
  return reply.answer ?? { ok: false, reason: "the Keeper's Rollbox couldn't make the card" };
}
