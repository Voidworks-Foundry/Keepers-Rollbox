/** Fight back and Counter, shared by the melee and maneuver alerts. See docs/alert-flyout.md. */
import { element } from "../../utils.js";
import { MANEUVER_GOALS, buildOf, maneuverDice } from "../../shared/index.js";
import {
  addAttacks, fightingSkill, fightingSkills, missingAttacks, setWeaponSkill, switchManeuverOn, unarmedOnSheet
} from "../../roll-requests/index.js";
import { addLine, askKeeperText, promptBox } from "../action/prompt.js";
import { alertButton, say } from "./alerts.js";

const NO_WEAPON = "No weapon";
const NO_MANEUVER_WEAPON = "No maneuver weapon";

// maneuverDice gives penalty dice as a negative number.
function buildText(build) {
  if (!build.known) return "Build: unknown, the Keeper decides the dice.";
  if (build.impossible) return "Build: they are 3 or more bigger; a maneuver can't move them.";
  const count = -build.dice;
  if (!count) return "Build: no penalty dice.";
  return `Build: ${count} penalty ${count === 1 ? "die" : "dice"}.`;
}

function addToSheet(name, actor) {
  const line = document.createDocumentFragment();
  line.append("Add ", element("b", "", name),
    ` to ${actor?.type === "character" && actor?.name ? `${actor.name}'s` : "its"} sheet?`);
  return line;
}

/**
 * Asks the Keeper to add or fix what Fight back or Counter lacks, then calls `onReady`; a player is told to ask.
 * @param {{node: HTMLElement, line: HTMLElement, me: Actor, keeper: boolean, kind: "fight"|"counter",
 *   onReady: (weapon: Item) => void}} ask
 */
function askForAttack({ node, line, me, keeper, kind, onReady }) {
  node.querySelector(".rollbox-alert-prompt")?.remove();
  const { punch, maneuver, skill } = missingAttacks(me);
  const unarmed = unarmedOnSheet(me);
  const switchOn = kind === "counter" ? (maneuver?.switchOn ?? null) : null;
  if (!keeper) {
    if (kind === "fight") return say(line, "Your sheet has no weapon to fight back with. Ask your Keeper to add a Punch.");
    return say(line, switchOn ? `Your ${switchOn.name} has Maneuver off. Ask your Keeper to switch it on.`
      : askKeeperText(punch ?? "maneuver weapon"));
  }
  const name = me.name ?? "The character";
  let box = null;
  const close = () => box?.remove();
  const carryOn = (weapon, failed) => {
    close();
    if (weapon) onReady(weapon);
    else say(line, `${failed}; see the console (F12).`);
  };
  const linkTo = kind === "fight" && unarmed && fightingSkill(me) ? fightingSkill(me) : null;
  if (switchOn) {
    box = promptBox({ lines: [`${name} has no maneuver weapon.`, `Switch Maneuver on for ${name}'s ${switchOn.name}?`],
      confirm: "Switch on", onCancel: close,
      onConfirm: async () => carryOn(await switchManeuverOn(switchOn) ? switchOn : null, "Maneuver couldn't be switched on") });
  } else if (linkTo) {
    // An unarmed weapon CoC7 can't list (its skill isn't on the sheet): link it, as the Action flyout's Fix does.
    box = promptBox({ lines: [`${unarmed.name} has no skill on ${name}'s sheet, so CoC7 can't fight back with it.`,
      `Link it to ${linkTo.name}?`], confirm: "Fix", onCancel: close,
    onConfirm: async () => carryOn(await setWeaponSkill(unarmed, linkTo) ? unarmed : null, "The skill couldn't be set") });
  } else {
    const adds = punch ?? "Punch";
    const lines = kind === "fight" ? [`${name} has no weapon to fight back with.`, addToSheet(adds, me)]
      : [`${name} has no maneuver weapon.`, addLine([adds], me), "Its Maneuver is switched on."];
    const choose = skill ? null : fightingSkills(me).map((each) => ({ id: each.id, name: each.name }));
    box = promptBox({ lines, confirm: "Add", skills: choose, onCancel: close,
      onConfirm: async (skillId) => {
        const linked = skillId ? Array.from(me.items ?? []).find((item) => item.id === skillId) : null;
        const [added] = await addAttacks(me, { punch: true, maneuver: kind === "counter", skill: linked });
        carryOn(added ?? null, `${adds} couldn't be added`);
      } });
  }
  box.classList.add("rollbox-alert-prompt");
  line.before(box);
  return undefined;
}

/** Returns a row of buttons to pick one from, the picked one marked. */
function pickRow(className, entries, picked, onPick) {
  const row = element("div", className);
  for (const entry of entries) {
    const node = alertButton(entry.name ?? "?", () => {
      row.querySelectorAll(".rollbox-alert-picked").forEach((each) => each.classList.remove("rollbox-alert-picked"));
      node.classList.add("rollbox-alert-picked");
      onPick(entry);
    });
    node.dataset.itemId = entry.id;
    if (entry === picked) node.classList.add("rollbox-alert-picked");
    row.append(node);
  }
  return row;
}

/**
 * Returns an alert's Fight back and Counter buttons and their option blocks; one block is open at a time.
 * @param {{node: HTMLElement, line: HTMLElement, me: Actor, attacker: Actor|null, keeper: boolean,
 *   control: Function, fightWeapons: Item[], fightWith: (weapon: Item) => void, counterWeapons: Item[],
 *   canCounter: (weapon: Item|null) => boolean, onGoal: (goal: object, weapon: Item|null) => void}} parts
 * @returns {{fightButton: HTMLButtonElement, counterButton: HTMLButtonElement, weapons: HTMLElement,
 *   counter: HTMLElement, open: (shown: HTMLElement|null) => void}} `open(null)` closes both blocks
 */
export function fightAndCounter({ node, line, me, attacker, keeper, control, fightWeapons, fightWith, counterWeapons,
  canCounter, onGoal }) {
  const weapons = element("div", "rollbox-alert-weapons");
  weapons.hidden = true;
  for (const weapon of fightWeapons) weapons.append(control(weapon.name ?? "?", () => fightWith(weapon)));

  const counter = element("div", "rollbox-alert-counter");
  counter.hidden = true;
  let counterWith = counterWeapons[0] ?? null;
  if (counterWeapons.length > 1) {
    counter.append(pickRow("rollbox-alert-weapons rollbox-alert-counter-weapons", counterWeapons, counterWith,
      (weapon) => { counterWith = weapon; }));
  }
  const goals = element("div", "rollbox-alert-goals");
  const build = maneuverDice(buildOf(me), buildOf(attacker));
  for (const goal of MANEUVER_GOALS) {
    const pick = control(goal.label, () => onGoal(goal, counterWith));
    pick.disabled = build.impossible;
    pick.dataset.off = String(build.impossible);
    goals.append(pick);
  }
  goals.append(element("p", "rollbox-alert-build", buildText(build)));
  counter.append(goals);

  const open = (shown) => {
    weapons.hidden = shown !== weapons || !weapons.hidden;
    counter.hidden = shown !== counter || !counter.hidden;
  };
  const armed = weapons.childElementCount > 0;
  const fight = control("Fight back", () => (armed ? open(weapons)
    : (open(null), askForAttack({ node, line, me, keeper, kind: "fight", onReady: fightWith }))));
  if (!armed) fight.title = NO_WEAPON;
  const counterReady = canCounter(counterWith);
  const counterButton = control("Counter", () => (counterReady ? open(counter)
    : (open(null), askForAttack({ node, line, me, keeper, kind: "counter", onReady: (weapon) => {
      counterWith = weapon;
      open(counter);
    } }))));
  if (!counterReady) counterButton.title = NO_MANEUVER_WEAPON;
  return { fightButton: fight, counterButton, weapons, counter, open };
}
