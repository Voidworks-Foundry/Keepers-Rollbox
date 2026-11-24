/** The Action flyout's Maneuver tab, run on CoC7's opposed card through Rollbox's notice. See docs/action-flyout.md. */
import { element, isKeeper } from "../../utils.js";
import { findSkillRow, skills } from "../../skill-values/index.js";
import {
  addAttacks, fightingSkill, fightingSkills, maneuverWeapons, missingAttacks, postManeuverNotice, setWeaponSkill,
  skillUnset, switchManeuverOn
} from "../../roll-requests/index.js";
import { aboutToAttack, asksFirst, attackMade } from "../../combat/index.js";
import { spendAttack } from "./attack.js";
import { hasStatus, isHeld, setRollboxStatus } from "../../status/index.js";
import { button, diceText, levelsNode, line, runSend, segmented, sendSection, showResult } from "../flyout.js";
import { BRAWL, distanceBetween, inReach, tokenOf } from "./weapons.js";
import { addLine, askKeeperText, promptBox } from "./prompt.js";
import { targetToken } from "./target.js";
import { MANEUVER_GOALS, buildOf, maneuverDice } from "../../shared/index.js";

export { maneuverDice };


/**
 * Returns a fresh Maneuver tab state, kept by the flyout across redraws.
 * @returns {{goal: string, goalPicked: boolean, pick: string|null, prompt: string|null, result: object|null}}
 */
export function maneuverState() {
  return { goal: MANEUVER_GOALS[0].id, goalPicked: false, pick: null, prompt: null, result: null };
}

/** Holds why a held character's Attack, Spell and every goal but Break free are greyed. */
export const RESTRAINED_REASON = "Restrained: you can only try to break free";
const NOT_HELD = "Not held: nothing to break free from";
const OUT_OF_REACH = "Out of reach";

// Break free has no target, so reach never greys it.
function goalBlock(actor, goal, reachable) {
  if (goal === "breakFree") return isHeld(actor) ? null : NOT_HELD;
  if (isHeld(actor)) return RESTRAINED_REASON;
  return reachable ? null : OUT_OF_REACH;
}

function overrideQuestion(actor, opponent, block) {
  const name = actor?.name ?? "They";
  if (block === RESTRAINED_REASON) return `${name} is restrained: they can only try to break free. Override?`;
  if (block === NOT_HELD) return `${name} isn't held: nothing to break free from. Override?`;
  return `${opponent?.name ?? "The target"} is out of reach. Override?`;
}

function skillRowFor(actor, weapon) {
  const rows = skills(actor);
  const id = weapon?.system?.skill?.main?.id;
  const own = id ? Array.from(actor.items ?? []).find((item) => item.id === id) : null;
  const skill = own ?? fightingSkill(actor);
  return (skill ? findSkillRow(rows, { name: skill.name }) : null) ?? findSkillRow(rows, BRAWL)
    ?? { name: skill?.name ?? BRAWL.name, value: null };
}

/**
 * Returns the Maneuver tab for one character; `limited` greys Attempt.
 * @param {{actor: Actor, target: {token: Token|null, text: string|null}, state?: object, redraw?: () => void,
 *   close?: () => void, limited?: boolean}} context
 * @returns {HTMLElement|null} null without a character
 */
export function maneuverTab({ actor, target, state = maneuverState(), redraw = () => {}, close = () => {},
  limited = false } = {}) {
  if (!actor) return null;
  const root = element("div", "rollbox-action-maneuver");
  const opponent = target?.token?.actor ?? null;
  const weapons = maneuverWeapons(actor);
  if (!weapons.some((w) => w.id === state.pick)) state.pick = weapons[0]?.id ?? null;
  const weapon = weapons.find((w) => w.id === state.pick) ?? null;

  const reachable = inReach(weapon, target?.token ? distanceBetween(tokenOf(actor), target.token) : null);
  const blockOf = (goal) => goalBlock(actor, goal, reachable);
  // A greyed goal gives way to the first live one, unless picked on purpose for the Keeper's Override.
  if (blockOf(state.goal) && !state.goalPicked) {
    state.goal = MANEUVER_GOALS.find((g) => !blockOf(g.id))?.id ?? state.goal;
  }
  const goals = segmented({ choices: MANEUVER_GOALS.map((g) => [g.id, g.label]), get: () => state.goal,
    set: (value) => { state.goal = value; state.goalPicked = true; redraw(); }, label: "Goal" });
  goals.element.classList.add("rollbox-action-goals");
  for (const node of goals.buttons) {
    const block = blockOf(node.dataset.value);
    if (!block) continue;
    node.classList.add("rollbox-action-goal-greyed");
    node.title = block;
    if (!isKeeper()) node.disabled = true;
  }
  goals.sync();
  root.append(line("Goal", goals.element));

  // Several maneuver attacks (a creature's own) are picked as in the Attack tab; one is just named.
  if (weapons.length > 1) {
    const list = element("div", "rollbox-list rollbox-action-weapons rollbox-action-maneuvers");
    list.setAttribute("role", "radiogroup");
    list.setAttribute("aria-label", "Maneuver attack");
    for (const each of weapons) {
      const row = button("rollbox-row rollbox-action-weapon", "", () => { state.pick = each.id; redraw(); });
      row.dataset.pick = each.id;
      row.setAttribute("role", "radio");
      row.setAttribute("aria-checked", String(each.id === state.pick));
      row.classList.toggle("rollbox-action-weapon-picked", each.id === state.pick);
      const text = element("span", "rollbox-action-weapon-text");
      text.append(element("span", "rollbox-action-weapon-name", each.name ?? "?"));
      row.append(text, levelsNode("rollbox-action-weapon-values", skillRowFor(actor, each)));
      list.append(row);
    }
    root.append(list);
  }

  const skillRow = skillRowFor(actor, weapon);
  const skill = element("div", "rollbox-line rollbox-action-skill");
  skill.append(element("span", "rollbox-line-label", weapon && weapons.length === 1 ? weapon.name : "Skill"),
    element("span", "rollbox-action-weapon-name", skillRow.name), levelsNode("rollbox-action-weapon-values", skillRow));
  root.append(skill);

  const build = maneuverDice(buildOf(actor), buildOf(opponent));
  if (opponent) {
    const words = !build.known ? "Build unknown: no dice"
      : (build.impossible ? "Impossible: the target is 3 or more Build bigger" : (diceText(build.dice) || "No Build dice"));
    const row = element("div", "rollbox-line rollbox-action-build");
    row.append(element("span", "rollbox-line-label", "Build"),
      element("span", "", `${buildOf(actor) ?? "?"} vs ${buildOf(opponent) ?? "?"} · ${words}`));
    row.classList.toggle("rollbox-action-impossible", build.impossible);
    root.append(row);
  }

  const lacking = () => {
    if (!weapon) return "maneuver";
    return skillUnset(weapon) && fightingSkill(actor) ? "skill" : null;
  };
  const prompt = isKeeper() && state.prompt && state.prompt === lacking() ? keeperPrompt() : null;
  if (prompt) root.append(prompt);

  const goal = MANEUVER_GOALS.find((g) => g.id === state.goal) ?? MANEUVER_GOALS[0];
  const block = blockOf(goal.id);
  const go = button("rollbox-btn rollbox-primary rollbox-action-go",
    block === OUT_OF_REACH ? "Target out of reach" : `Attempt to ${goal.label.toLowerCase()}`, () => run());
  if (block) {
    go.title = block;
    go.classList.add("rollbox-action-greyed-button");
    // The Keeper may press it anyway; index.js's offerOverride asks first.
    if (isKeeper()) go.dataset.override = overrideQuestion(actor, opponent, block);
  }
  const cancel = button("rollbox-btn rollbox-action-cancel", "Cancel", () => close());
  cancel.dataset.keep = "";
  const sender = sendSection([go, cancel]);
  // `sending` lives in the tab's state, so a redraw while posting can't post a second notice.
  const menu = {
    get sending() { return state.sending === true; },
    set sending(value) { state.sending = value; },
    update: () => sender.ready(missing(), menu.sending || limited || Boolean(prompt) || (Boolean(block) && !isKeeper()))
  };
  const askForManeuver = () => {
    const { punch, maneuver } = missingAttacks(actor);
    if (maneuver?.switchOn) {
      return `Your ${maneuver.switchOn.name} has Maneuver off. Ask your Keeper to switch it on.`;
    }
    return askKeeperText(punch ?? "maneuver weapon");
  };
  const missing = () => {
    if (!opponent) return "A maneuver needs a character as the target: target a token.";
    if (build.impossible) return "The target is too big for a maneuver (p. 105).";
    if (!isKeeper() && !weapon) return askForManeuver();
    if (!isKeeper() && lacking() === "skill") return `Your ${weapon.name} has no skill set. Ask your Keeper to fix it.`;
    if (weapon && skillUnset(weapon) && !fightingSkill(actor)) {
      return `${weapon.name} has no skill on the sheet, so CoC7's card can't roll: set it on the weapon's sheet.`;
    }
    return null;
  };

  function keeperPrompt() {
    const name = actor.name ?? "The character";
    if (state.prompt === "maneuver") {
      const { punch, maneuver, skill: linked } = missingAttacks(actor);
      const unarmed = maneuver?.switchOn ?? null;
      if (unarmed) {
        return promptBox({ lines: [`${name} has no maneuver weapon.`,
          `Switch Maneuver on for ${name}'s ${unarmed.name}?`], confirm: "Switch on",
        onConfirm: () => switchOn(unarmed), onCancel: cancelPrompt });
      }
      const choose = linked ? null : fightingSkills(actor).map((s) => ({ id: s.id, name: s.name }));
      return promptBox({ lines: [`${name} has no maneuver weapon.`, addLine([punch ?? "Punch"], actor),
        "Its Maneuver is switched on."], confirm: "Add", skills: choose, onConfirm: (skillId) => addManeuver(skillId),
      onCancel: cancelPrompt });
    }
    const linked = fightingSkill(actor);
    return promptBox({ lines: [`${weapon.name} has no skill on ${name}'s sheet, so CoC7's card can't roll.`,
      `Link it to ${linked?.name ?? "Fighting (Brawl)"}?`], confirm: "Fix",
    onConfirm: async () => {
      state.prompt = null;
      if (await setWeaponSkill(weapon, linked)) run();
      else redraw();
    }, onCancel: cancelPrompt });
  }

  function cancelPrompt() {
    state.prompt = null;
    redraw();
  }

  // A weapon that just became the maneuver weapon asks for its skill first when CoC7 can't find it.
  function carryOn(maneuver) {
    state.pick = maneuver.id;
    if (skillUnset(maneuver) && fightingSkill(actor)) {
      state.prompt = "skill";
      redraw();
      return;
    }
    send(maneuver);
  }

  async function switchOn(unarmed) {
    state.prompt = null;
    if (!(await switchManeuverOn(unarmed))) {
      state.result = { lines: [`Maneuver couldn't be switched on for ${unarmed.name}; see the console (F12).`] };
      redraw();
      return;
    }
    carryOn(unarmed);
  }

  async function addManeuver(skillId) {
    const linked = skillId ? Array.from(actor.items ?? []).find((item) => item.id === skillId) : null;
    state.prompt = null;
    const [added] = await addAttacks(actor, { punch: true, maneuver: true, skill: linked });
    if (!added) {
      state.result = { lines: ["The Punch couldn't be added; see the console (F12)."] };
      redraw();
      return;
    }
    carryOn(added);
  }

  function run() {
    if (limited || missing() || (block && !isKeeper())) return undefined;
    const need = lacking();
    if (need) {
      if (!isKeeper()) return undefined;
      state.prompt = need;
      redraw();
      return undefined;
    }
    return send(weapon);
  }

  // The target answers Rollbox's notice on their alert; CoC7's opposed card follows.
  function send(maneuver) {
    return runSend(menu, async () => {
      // Out of combat the Keeper's About to attack comes first.
      let decision = null;
      if (opponent && asksFirst(actor, opponent)) {
        state.result = { lines: [isKeeper() ? "About to attack: answer the pop-up above the hotbar." : "Waiting for the Keeper…"] };
        redraw();
        decision = await aboutToAttack({ actor, target: opponent, kind: "maneuver" });
        if (decision?.how === "unanswered") return { lines: [`Nothing was sent: ${decision.reason}.`] };
      }
      if (target?.token) targetToken(target.token);
      const notice = await postManeuverNotice({ actor, weapon: maneuver, target: opponent, goal: state.goal });
      if (!notice) return { lines: ["The maneuver notice couldn't be posted; see the console (F12)."] };
      await spendAttack(actor);
      if (decision?.how !== "ignore") await attackMade({ actor, targets: [opponent].filter(Boolean) });
      if (decision?.how === "surprised") {
        return { lines: [`${opponent.name} is surprised: no response; ${actor.name} rolls the maneuver alone`
          + `${decision.bonus === "die" ? " with one bonus die" : ""}.`], restrain: state.goal === "restrain" };
      }
      return { lines: [`${opponent?.name ?? "The target"} answers: Dodge, Fight back or Counter. `
        + "CoC7's opposed card follows; roll your side there."], restrain: state.goal === "restrain" };
    }, (result) => {
      state.result = result ?? { lines: ["Something went wrong; see the console (F12)."] };
      redraw();
    });
  }

  if (state.result?.send) showResult(sender.result, state.result.send, state.result.words);
  else if (state.result?.lines) {
    sender.result.replaceChildren(...state.result.lines.map((text) => element("div", "rollbox-result-line", text)));
  }
  if (state.result?.restrain && opponent && isKeeper()) sender.result.append(restrainButton(opponent, redraw));
  menu.update();
  root.append(sender.element);
  return root;
}

// Pressed by the Keeper once CoC7's card shows the Restrain succeeded; the status card clears it.
function restrainButton(target, redraw) {
  const set = hasStatus(target, "restrained");
  const node = button("rollbox-btn rollbox-action-restrain", set ? `${target.name ?? "Target"}: Restrained`
    : `Set Restrained: ${target.name ?? "target"}`, async () => {
    await setRollboxStatus(target, "restrained", true);
    redraw();
  });
  node.disabled = set;
  return node;
}
