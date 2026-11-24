/** About to attack: the Keeper decides whether an attack out of combat is a surprise. See docs/combat.md. */
import { COC7_ID, MODULE_ID, actorFromUuid, dotted, isActiveKeeper, isKeeper, plays, sameActor, warn } from "../utils.js";
import { comparable, skills, tableSkill } from "../skill-values/index.js";
import {
  askKeeper, checkRequest, grantAutoHit, onKeeperRequest, ownersOf, send, watchCheck
} from "../roll-requests/index.js";
import { difficultyFor } from "../shared/index.js";
import { gameplayOn, runningCombat } from "./encounter.js";
import { tokenOf } from "./sight.js";
import { showPopup } from "./fight-boxes.js";
import { noticedDraw } from "./notice-cards.js";
import { holdPlayers } from "./waiting.js";

const SURPRISED_FLAG = "surprised";
const SURPRISE_MS = 600000;
const ANSWER_WAIT_MS = 600000;
const ROLL_WAIT_MS = 600000;
/**
 * Lists the skills that notice an attack coming, with their CoC IDs.
 * @type {readonly {name: string, cocid: string}[]}
 */
export const NOTICE_SKILLS = Object.freeze([
  Object.freeze({ name: "Spot Hidden", cocid: "i.skill.spot-hidden" }),
  Object.freeze({ name: "Listen", cocid: "i.skill.listen" }),
  Object.freeze({ name: "Psychology", cocid: "i.skill.psychology" })
]);
// CoC7 8.15: only the melee card has Automatic success.
const KINDS = Object.freeze(["melee", "ranged", "maneuver", "improvised"]);
const NO_AUTO = Object.freeze({
  ranged: "CoC7's ranged card has no automatic success: give one bonus die.",
  maneuver: "CoC7 has no automatic success for a maneuver: give one bonus die.",
  improvised: "An improvised weapon is a skill check: give one bonus die."
});

const STEALTH_BASE = tableSkill("Stealth", "i.skill.stealth")?.base;

// One pop-up per attacker and target; one taken off the page unanswered counts as Ignore.
const open = new Map();


const aboutToAttackOn = () => gameplayOn();

/**
 * Tells whether an attack asks the Keeper first: out of combat, between two characters with tokens on the scene.
 * @param {Actor} actor
 * @param {Actor} target
 * @returns {boolean}
 */
export function asksFirst(actor, target) {
  if (!actor || !target || sameActor(actor, target) || !aboutToAttackOn()
    || runningCombat([actor, target])) return false;
  return Boolean(tokenOf(actor) && tokenOf(target));
}

function cleanDecision(answer) {
  const how = ["surprised", "seen", "ignore"].includes(answer?.how) ? answer.how : null;
  if (!how) return null;
  return { how, bonus: how === "surprised" && ["auto", "die"].includes(answer.bonus) ? answer.bonus : null };
}

/**
 * Asks the Keeper whether the target sees the attack coming, before anything is rolled; a player's client waits.
 * @param {{actor: Actor, target: Actor, kind: "melee"|"ranged"|"maneuver"|"improvised"}} attack
 * @returns {Promise<{how: "surprised"|"seen"|"ignore", bonus: "auto"|"die"|null}|{how: "unanswered", reason: string}|null>}
 *   null when nothing is asked (the attack goes ahead as always)
 */
export async function aboutToAttack({ actor, target, kind = "melee" } = {}) {
  if (!asksFirst(actor, target)) return null;
  const sort = KINDS.includes(kind) ? kind : "melee";
  if (isKeeper()) return keeperAsks(actor, target, sort);
  const reply = await askKeeper("aboutToAttack", { actorUuid: actor.uuid, targetUuid: target.uuid, kind: sort },
    { timeout: ANSWER_WAIT_MS });
  const decision = reply.ok ? cleanDecision(reply.answer) : null;
  return decision ?? { how: "unanswered", reason: reply.reason ?? "the Keeper didn't answer" };
}


/**
 * Asks the Keeper about a player's relayed attack, only for a character the sender owns. Keeper only.
 * @param {{actorUuid: string, targetUuid: string, kind: string}} payload
 * @param {User} user the sender
 * @returns {Promise<object|null>}
 */
export async function aboutToAttackForPlayer({ actorUuid, targetUuid, kind } = {}, user) {
  const actor = actorFromUuid(actorUuid);
  const target = actorFromUuid(targetUuid);
  if (!actor || !target || !plays(actor, user) || !asksFirst(actor, target)) return null;
  return keeperAsks(actor, target, KINDS.includes(kind) ? kind : "melee");
}

/**
 * Tells whether the Keeper decided this character is surprised by this attacker.
 * @param {Actor} target
 * @param {string} attackerUuid
 * @returns {boolean}
 */
export function surprisedBy(target, attackerUuid) {
  return surpriseOf(target, attackerUuid) !== null;
}

/**
 * Returns the surprise the Keeper decided for this target and attacker; it lapses after ten minutes.
 * @param {Actor} target
 * @param {string} attackerUuid
 * @returns {{attacker: string, at: number, bonus: "auto"|"die"|null}|null}
 */
export function surpriseOf(target, attackerUuid) {
  let mark = null;
  try {
    mark = target?.getFlag?.(MODULE_ID, SURPRISED_FLAG) ?? null;
  } catch {
    mark = null;
  }
  if (!mark?.attacker || !attackerUuid) return null;
  if (dotted(mark.attacker) !== dotted(attackerUuid) || Date.now() - Number(mark.at ?? 0) >= SURPRISE_MS) return null;
  return { attacker: String(mark.attacker), at: Number(mark.at), bonus: ["auto", "die"].includes(mark.bonus) ? mark.bonus : null };
}

async function markSurprised(target, attacker, on, bonus = null) {
  try {
    if (on) await target.setFlag(MODULE_ID, SURPRISED_FLAG, { attacker: attacker.uuid, at: Date.now(), bonus });
    else if (target.getFlag?.(MODULE_ID, SURPRISED_FLAG)) await target.unsetFlag(MODULE_ID, SURPRISED_FLAG);
  } catch (error) {
    warn("couldn't mark the target surprised.", error);
  }
}

/**
 * Removes the target's surprise mark once its attack is answered or combat starts. Active GM only.
 * @param {Actor} target
 * @returns {Promise<void>}
 */
export async function clearSurprise(target) {
  if (!isActiveKeeper() || !target?.getFlag?.(MODULE_ID, SURPRISED_FLAG)) return;
  await markSurprised(target, null, false);
}

function stealthOf(actor) {
  try {
    const row = skills(actor).find((skill) => comparable(skill.name) === comparable("Stealth"));
    return Number.isFinite(row?.value) ? row.value : STEALTH_BASE;
  } catch {
    return STEALTH_BASE;
  }
}

function playerRolls(target) {
  return (ownersOf(target) ?? []).some((user) => user?.active === true);
}

function onSheet(target, skill) {
  try {
    return skills(target).some((row) => row.onSheet && comparable(row.name) === comparable(skill.name));
  } catch {
    return false;
  }
}

// CoC7 8.15: a skill result's key is the item's uuid; a skill missing from the sheet rolls raw, as `type: "value"`.
function isSkill(result, skill, rawRoll = false) {
  if (rawRoll && result?.type === "value") return true;
  if (result?.type !== "skill" || !result.key) return false;
  try {
    const item = globalThis.fromUuidSync?.(result.key) ?? null;
    if (!item) return !result.name || comparable(String(result.name)) === comparable(skill.name);
    const cocid = item?.flags?.[COC7_ID]?.cocidFlag?.id;
    return cocid === skill.cocid || comparable(item?.name ?? "") === comparable(skill.name);
  } catch {
    return false;
  }
}

function watchRoll(target, skill, onResult) {
  const rawRoll = !onSheet(target, skill);
  return watchCheck(target, { waitMs: ROLL_WAIT_MS, accepts: (result) => isSkill(result, skill, rawRoll),
    onResult: (result) => onResult(result.isSuccess === true) });
}

function keeperAsks(actor, target, kind) {
  const key = `${dotted(actor.uuid)}>${dotted(target.uuid)}`;
  const shown = open.get(key);
  if (shown?.card?.isConnected) return shown.asking;
  if (shown) shown.finish({ how: "ignore", bonus: null });
  let entry = null;
  const asking = new Promise((resolve) => {
    const a = actor.name ?? "Someone";
    const t = target.name ?? "the target";
    let stopRoll = () => {};
    const popup = showPopup({ kind: "aboutToAttack", key });
    let done = false;
    const finish = async (decision) => {
      if (done) return;
      done = true;
      stopRoll();
      popup.close();
      if (open.get(key) === entry) open.delete(key);
      // The players stay locked while an answered attack goes on to its First blow card; Ignore starts none.
      if (decision.how !== "ignore") holdPlayers(`attack:${key}`, {});
      holdPlayers(`about:${key}`, null);
      if (decision.how === "surprised") {
        await markSurprised(target, actor, true, decision.bonus);
        // Recorded on the Keeper's client, so a player's client can never grant itself an automatic hit.
        if (decision.bonus === "auto") grantAutoHit(actor.uuid);
      } else {
        await markSurprised(target, actor, false);
      }
      resolve(decision);
    };
    const sawDraw = noticedDraw(target, actor.uuid);
    const decide = [
      { label: "Surprised", run: () => surprised(null) },
      { label: "Saw it coming", main: sawDraw, run: () => finish({ how: "seen", bonus: null }) },
      { label: "Ignore", run: () => finish({ how: "ignore", bonus: null }) }
    ];
    const surprised = (failed) => {
      stopRoll();
      const noAuto = NO_AUTO[kind] ?? null;
      popup.draw({ title: `${t} is surprised`,
        text: failed ? `${t} failed ${failed}: surprised, no response.` : `${t} is surprised: no response.`,
        sections: [{ buttons: [
          { label: "Automatic hit", main: true, disabled: Boolean(noAuto), title: noAuto ?? "CoC7's Automatic success "
            + "on its attack card (a fumble still fails).", run: () => finish({ how: "surprised", bonus: "auto" }) },
          { label: "One bonus die", main: true, title: "One more bonus die on CoC7's attack card.",
            run: () => finish({ how: "surprised", bonus: "die" }) }
        ] }] });
    };
    const roll = async (skill) => {
      const request = checkRequest({ checks: [{ kind: "skill", name: skill.name }], all: false,
        difficulty: difficultyFor(Number(stealthOf(actor)) || STEALTH_BASE), label: "Notice" });
      popup.draw({ title: `${a} is about to attack ${t}`, text: `Waiting for ${t}'s ${skill.name}…`, waiting: true,
        sections: [{ buttons: decide }] });
      stopRoll = watchRoll(target, skill, (seen) => (seen ? finish({ how: "seen", bonus: null }) : surprised(skill.name)));
      // A target no player online plays is rolled for the Keeper at once: a request whispered to an offline player
      // would be the Keeper's to click, and CoC7 rolls a Keeper's click for the selected token, not the target.
      const sent = await send(request, [target], playerRolls(target) ? {} : { keeperRolls: true });
      if (!sent.requested.length && !sent.rolled.length) {
        stopRoll();
        popup.draw({ title: `${a} is about to attack ${t}`, text: `The ${skill.name} roll couldn't be sent: decide.`,
          sections: [{ buttons: decide }] });
      }
    };
    const opening = sawDraw ? `${t} saw ${a} draw a weapon: Saw it coming is chosen.`
      : `Out of combat. Does ${t} see it coming?`;
    popup.draw({ title: `${a} is about to attack ${t}`, text: opening,
      sections: [
        { label: `Roll to notice (${playerRolls(target) ? `${t} rolls` : "you roll, privately"})`,
          buttons: NOTICE_SKILLS.map((skill) => ({ label: skill.name, run: () => roll(skill) })) },
        { label: "Or decide", buttons: decide }
      ],
      onDismiss: () => finish({ how: "ignore", bonus: null }) });
    entry = { card: popup.card, finish };
    holdPlayers(`about:${key}`, { card: popup.card });
  });
  entry.asking = asking;
  open.set(key, entry);
  return asking;
}

/**
 * Listens for the relay's "aboutToAttack" message. Call at ready.
 * @returns {boolean} false for players
 */
export function registerAboutToAttack() {
  if (!isKeeper()) return false;
  onKeeperRequest("aboutToAttack", aboutToAttackForPlayer);
  return true;
}
