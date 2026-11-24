/** The melee alert, answered by pressing CoC7's own choices on its defender card. See docs/alert-flyout.md. */
import { dotted, element, isActiveKeeper, tellKeeper } from "../../utils.js";
import { clearSurprise, surprisedBy } from "../../combat/index.js";
import {
  CLICK_DELAY_MS, CLICK_TRIES, counterWeapons, fightingSkill, meleeWeapons, pickFromCardList, pressCardButton,
  rollWhenChosen, unarmedOnSheet, weaponSkillItem
} from "../../roll-requests/index.js";
import {
  actorOf, alerts, answeredSurprise, closeAlert, controlList, dismissed, frame, readAttack, say, showAlert, whoAttacks
} from "./alerts.js";
import { fightAndCounter } from "./choices.js";

const itemIdOf = (uuid) => dotted(uuid).split(".").pop();

// Matches CoC7's own Fight back list: melee weapons whose skill is on the sheet.
function fightBackWeapons(actor) {
  return meleeWeapons(actor).filter((weapon) => weaponSkillItem(actor, weapon));
}

// CoC7's Maneuver list holds fighting skills: the weapon's own skill when CoC7 marks it fighting, else the character's.
function counterSkill(actor, weapon) {
  const own = weapon ? weaponSkillItem(actor, weapon) : null;
  if (own?.system?.properties?.fighting === true) return own;
  return fightingSkill(actor);
}

/**
 * Returns the melee alert, whose answers press the choice and then the roll on CoC7's defender card.
 * @param {object} attack readAttack's melee card
 * @param {Actor} me the target
 * @param {boolean} [keeper] the Keeper's alert for an NPC or creature
 * @returns {{node: HTMLElement, line: HTMLElement}}
 */
export function meleeAlert(attack, me, keeper = false) {
  const title = keeper ? `${me.name ?? "The target"} is being attacked` : "You are being attacked";
  const { node, line } = frame(attack.id, title, whoAttacks(attack, me, "attacks"));
  const { controls, control } = controlList();
  const busy = (on) => controls.forEach((each) => { each.disabled = on || each.dataset.off === "true"; });
  const answer = async (words, choose, ready) => {
    busy(true);
    say(line, `${words}: rolling on CoC7's card…`);
    const giveUp = () => { busy(false); say(line, `${words}: roll it on CoC7's card in chat.`); };
    const stop = rollWhenChosen(attack.id, ready, giveUp);
    if (!(await choose())) {
      stop();
      busy(false);
      say(line, `Choose ${words} on CoC7's card in chat.`);
    }
  };
  const press = (action) => async () => pressCardButton(attack.id, `[data-action="${action}"]`);
  const isItem = (id) => (load) => !load.isNoResponse && itemIdOf(load.itemUuid) === id;

  const fightWith = (weapon) => answer(`Fight back with ${weapon.name}`,
    () => pickFromCardList(attack.id, '[data-action="setFightBack"]', weapon.id), isItem(weapon.id));
  const choices = counterWeapons(me);
  const fallback = unarmedOnSheet(me);
  const { fightButton, counterButton, weapons, counter, open } = fightAndCounter({ node, line, me,
    attacker: actorOf(attack.attackerUuid), keeper, control, fightWeapons: fightBackWeapons(me), fightWith,
    counterWeapons: choices.length ? choices : (fallback ? [fallback] : []),
    canCounter: (weapon) => Boolean(counterSkill(me, weapon)),
    onGoal: (goal, weapon) => {
      const skill = counterSkill(me, weapon);
      if (!skill) return say(line, "No fighting skill on the sheet: choose Maneuver on CoC7's card in chat.");
      return answer(`Counter (${goal.label}${weapon ? `, ${weapon.name}` : ""})`,
        () => pickFromCardList(attack.id, '[data-action="setManeuvers"]', skill.id), isItem(skill.id));
    } });

  const actions = element("div", "rollbox-alert-actions");
  const dodgeId = Array.from(me.items ?? []).find((doc) => doc?.type === "skill" && doc.system?.isDodge === true)?.id;
  const dodge = control("Dodge", () => { open(null); answer("Dodge", press("dodge"), isItem(dodgeId)); });
  dodge.disabled = !dodgeId;
  dodge.dataset.off = String(!dodgeId);
  const none = control("No response", () => {
    open(null);
    answer("No response", press("setNoResponse"), (load) => load.isNoResponse === true);
  });
  actions.append(dodge, fightButton, counterButton, none);
  node.append(actions, weapons, counter, line);
  return { node, line };
}

// CoC7 actor types the Keeper answers for.
const keeperDefends = (actor) => ["npc", "creature"].includes(actor?.type);

// CoC7 still makes a defender card for a surprised target, so the active Keeper presses No response once.
function noResponse(attack, target) {
  if (!isActiveKeeper() || answeredSurprise.has(attack.id)) return;
  answeredSurprise.add(attack.id);
  const stop = rollWhenChosen(attack.id, (load) => load.isNoResponse === true, () => {
    tellKeeper("Rollbox: press No response on CoC7's defender card (the target was surprised).");
  });
  // The card may not be drawn in the chat log yet when it is created.
  let tries = CLICK_TRIES * 4;
  const attempt = () => {
    if (pressCardButton(attack.id, '[data-action="setNoResponse"]')) return clearSurprise(target);
    if (--tries > 0) return setTimeout(attempt, CLICK_DELAY_MS);
    stop();
    return undefined;
  };
  setTimeout(attempt, CLICK_DELAY_MS);
}

/**
 * Shows, keeps or closes the Keeper's melee alert for an NPC or creature a CoC7 card targets.
 * @param {ChatMessage} message
 * @returns {void}
 */
export function onKeeperCard(message) {
  const attack = readAttack(message);
  if (attack?.kind !== "melee") return;
  const target = actorOf(attack.targets[0]);
  if (attack.open && surprisedBy(target, attack.attackerUuid)) return noResponse(attack, target);
  if (!keeperDefends(target)) return;
  if (!attack.open) return closeAlert(attack.id);
  if (alerts.has(attack.id) || dismissed.has(attack.id)) return;
  showAlert(attack.id, meleeAlert(attack, target, true));
}
