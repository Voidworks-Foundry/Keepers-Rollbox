/** The target box on every Action tab, and following Foundry's targeting. See docs/action-flyout.md. */
import { element, isKeeper, numberOrNull, warn } from "../../utils.js";
import { attackDice } from "../../status/index.js";
import { pickTarget } from "../../player/index.js";
import { ownersOf } from "../../roll-requests/index.js";
import { diveDecision } from "../alert/index.js";
import { inMeleeWithOthers, isOutnumbered } from "../../combat/index.js";
import { distanceText, feetOf } from "../../shared/index.js";
import { button, diceText, textInput } from "../flyout.js";
import { distanceBetween, isFirearm, tokenOf } from "./weapons.js";

// A typed target is an object attack: CoC7's card runs with no target.
let typed = "";
// True between Target a token and the Keeper's next target, so Foundry's select tool can be put back.
let picking = false;
const listeners = new Set();

/**
 * Returns what the target box holds: the user's first Foundry target, a typed object, or nothing.
 * @returns {{token: Token|null, text: string|null}}
 */
export function currentTarget() {
  let token = null;
  try {
    token = Array.from(game.user?.targets ?? [])[0] ?? null;
  } catch {
    token = null;
  }
  const text = typed.trim();
  return { token: text ? null : token, text: text || null };
}

/**
 * Listens for target changes made outside the flyout.
 * @param {(change: object) => void} listener
 * @returns {() => void} stops listening
 */
export function onTargetChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function releaseTargets() {
  for (const token of Array.from(game.user?.targets ?? [])) {
    try {
      token.setTarget(false, { releaseOthers: false });
    } catch (error) {
      warn("couldn't release a target.", error);
    }
  }
}

/**
 * Makes this token the user's only Foundry target, which CoC7's attack card reads.
 * @param {Token} token
 * @returns {boolean} true when targeted
 */
export function targetToken(token) {
  if (typeof token?.setTarget !== "function") return false;
  try {
    token.setTarget(true, { releaseOthers: true });
    return true;
  } catch (error) {
    warn("couldn't target the token.", error);
    return false;
  }
}

/**
 * Sets a typed target and releases Foundry's targets, so CoC7's card has none; empty text clears it.
 * @param {string} text
 * @returns {void}
 */
export function setTypedTarget(text) {
  typed = String(text ?? "");
  if (typed.trim()) releaseTargets();
}

/**
 * Clears the typed target and the user's Foundry targets.
 * @returns {void}
 */
export function clearTarget() {
  typed = "";
  releaseTargets();
}

function activateTool(tool) {
  try {
    if (typeof ui?.controls?.activate !== "function") return false;
    ui.controls.activate({ control: "tokens", tool });
    return true;
  } catch (error) {
    warn(`couldn't switch Foundry's ${tool} tool.`, error);
    return false;
  }
}

// The Keeper gets Foundry's target tool, so the click targets instead of selecting and the panel keeps its actor.
async function startTargeting() {
  if (!isKeeper()) {
    const token = await pickTarget({ prompt: "Select your target", useCurrent: false });
    return token ? targetToken(token) : false;
  }
  picking = activateTool("target");
  return picking;
}

/**
 * Redraws the open flyout when a target's dive decision changes (the alert's DIVE_HOOK).
 * @returns {void}
 */
export function diveChanged() {
  for (const listener of listeners) listener();
}

/**
 * Redraws the open flyout when the target's character or its effects change; CoC7's status icons are effects.
 * @param {Actor|ActiveEffect} document
 * @returns {void}
 */
export function targetUpdated(document) {
  const actor = document?.documentName === "ActiveEffect" ? document.parent : document;
  const target = currentTarget().token?.actor;
  if (!actor || !target || (actor !== target && !(actor.id && actor.id === target.id))) return;
  for (const listener of listeners) listener();
}

/**
 * Tells the open flyout which token moved (updateToken), so distances follow the board.
 * @param {TokenDocument} document
 * @param {object} changes Foundry's update data
 * @returns {boolean} true when the listeners were told
 */
export function tokenMoved(document, changes) {
  if (!document || !changes || !("x" in changes || "y" in changes)) return false;
  for (const listener of listeners) listener({ moved: document });
  return true;
}

/**
 * Follows Foundry's targeting (targetToken): a token replaces a typed target, and the select tool comes back.
 * @param {User} user who targeted
 * @param {Token} _token
 * @param {boolean} targeted
 * @returns {void}
 */
export function targetChanged(user, _token, targeted) {
  if (user && user !== game.user) return;
  if (targeted) {
    typed = "";
    if (picking) {
      picking = false;
      activateTool("select");
    }
  }
  for (const listener of listeners) listener();
}

function awayText(measured) {
  const text = distanceText(measured);
  return text ? `${text} away` : null;
}

function targetFacts(actor, token, tab = "attack") {
  const target = token?.actor;
  const facts = [awayText(distanceBetween(tokenOf(actor), token))];
  if (tab === "spell") {
    const pow = numberOrNull(target?.system?.characteristics?.pow?.value);
    facts.push(pow === null ? null : `POW ${pow}`);
  } else {
    const build = numberOrNull(target?.system?.attribs?.build?.value);
    facts.push(build === null ? null : `Build ${build}`);
  }
  return facts.filter(Boolean).join(" · ");
}

function playerTarget(token) {
  const owners = token?.actor ? ownersOf(token.actor) : null;
  return Boolean(owners?.length);
}

function diveText(token) {
  const name = token.name ?? token.actor?.name ?? "?";
  const decision = diveDecision(token.actor);
  if (decision === "dived") return `${name} dived for cover: Under cover goes on CoC7's card`;
  if (decision === "stood") return `${name} stands their ground`;
  return `Waiting: ${name} may dive for cover`;
}

// Point blank is a fifth of the attacker's DEX in feet, edge to edge.
function atPointBlank(actor, token) {
  const feet = feetOf(distanceBetween(tokenOf(actor), token));
  const dex = numberOrNull(actor?.system?.characteristics?.dex?.value);
  return feet !== null && dex !== null && feet <= dex / 5;
}

const effectText = (line) => `Effect: ${diceText(line.dice) || line.effect || "none"}`;

/** Returns the status and situation lines, then the net dice only when there is an effect. */
function statusBlock(actor, token, weapon) {
  let dice = { lines: [], net: 0, total: 0, toggles: [] };
  try {
    const firearm = isFirearm(weapon);
    dice = attackDice({ attacker: actor, target: token.actor, weapon,
      pointBlank: firearm && atPointBlank(actor, token),
      intoMelee: firearm && inMeleeWithOthers(token, actor),
      outnumbered: Boolean(weapon) && !firearm && isOutnumbered(token.actor) }) ?? dice;
  } catch (error) {
    warn("couldn't read the target's statuses.", error);
  }
  const toggles = dice.toggles ?? [];
  if (!dice.lines.length) return { element: null, net: 0, toggles };
  const block = element("div", "rollbox-action-statuses");
  for (const line of dice.lines) {
    const row = element("div", `rollbox-action-effect rollbox-action-effect-${line.kind ?? "other"}`);
    row.dataset.status = line.status;
    row.title = line.note;
    row.append(element("span", "rollbox-action-effect-name", line.name ?? line.status),
      element("span", "rollbox-action-effect-dice", effectText(line)));
    block.append(row);
  }
  if (dice.total || dice.net || toggles.some((t) => t !== "noPointBlank")) {
    const net = element("div", "rollbox-action-effect rollbox-action-net");
    net.append(element("span", "rollbox-action-effect-name", "On CoC7's attack card"),
      element("span", "rollbox-action-effect-dice", diceText(dice.total) || "no dice"));
    block.append(net);
  }
  return { element: block, net: dice.net ?? 0, toggles };
}

/**
 * Returns the target box for this character and weapon; `fixed` (two selected) drops Change and ×.
 * @param {{actor: Actor, weapon: Item|null, tab?: "attack"|"maneuver"|"spell", onChange?: () => void,
 *   fixed?: boolean}} context
 * @returns {HTMLElement|null} null without a character; `dataset.net` holds the slider's dice and
 *   `dataset.toggles` CoC7's card toggles to set, comma separated
 */
export function targetBox({ actor, weapon = null, tab = "attack", onChange = () => {}, fixed = false } = {}) {
  if (!actor) return null;
  const { token, text } = currentTarget();
  const box = element("div", "rollbox-section rollbox-action-target");
  box.append(element("div", "rollbox-caption", "Target"));
  box.dataset.net = "0";
  box.dataset.toggles = "";
  if (token) {
    const head = element("div", "rollbox-action-target-head");
    const who = element("div", "rollbox-action-target-who");
    who.append(element("span", "rollbox-action-target-name", token.name ?? token.actor?.name ?? "?"));
    const facts = targetFacts(actor, token, tab);
    if (facts) who.append(element("span", "rollbox-action-target-facts", facts));
    const change = button("rollbox-btn rollbox-action-small", "Change", async () => {
      if (await startTargeting()) onChange();
    });
    const clear = button("rollbox-btn rollbox-action-small", "×", () => { clearTarget(); onChange(); });
    clear.setAttribute("aria-label", "Clear the target");
    head.append(who);
    if (!fixed) head.append(change, clear);
    box.append(head);
    if (tab !== "spell") {
      const statuses = statusBlock(actor, token, tab === "attack" ? weapon : null);
      if (statuses.element) box.append(statuses.element);
      box.dataset.net = String(statuses.net);
      box.dataset.toggles = statuses.toggles.join(",");
    }
    if (tab === "attack" && isFirearm(weapon) && playerTarget(token)) {
      box.append(element("div", "rollbox-action-waiting", diveText(token)));
    }
    return box;
  }
  const pick = button("rollbox-btn rollbox-action-pick", "Target a token", async () => {
    if (await startTargeting()) onChange();
  });
  const input = textInput("rollbox-action-typed", "…or type a target, e.g. the table", "Type a target");
  input.value = text ?? "";
  input.addEventListener("change", () => { setTypedTarget(input.value); onChange(); });
  box.append(pick, input);
  if (tab === "spell" && !text) box.append(element("div", "rollbox-hint", "A spell may need no target."));
  return box;
}
