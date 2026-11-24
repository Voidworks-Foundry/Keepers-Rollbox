/** The Action flyout: its tabs, who acts, limits and Override, and its hooks. See docs/action-flyout.md. */
import { MODULE_ID, element, isActiveKeeper, isKeeper, warn } from "../../utils.js";
import { canUse, panelHere } from "../../player/index.js";
import { registerFlyout } from "../../panel/index.js";
import { currentTurn, hasActed, hasDived, inCombatFor, keeperDeciding } from "../../combat/index.js";
import { button, tabBar } from "../flyout.js";
import { attackState, attackTab } from "./attack.js";
import { maneuverState, maneuverTab } from "./maneuver.js";
import { spellState, spellTab } from "./spell.js";
import { castingMoved, onCastingWindow, onCastingWindowClosed } from "./spell-text.js";
import {
  currentTarget, diveChanged, onTargetChange, targetBox, targetChanged, targetToken, targetUpdated, tokenMoved
} from "./target.js";
import { DIVE_HOOK } from "../alert/index.js";
import { BOUT_REASON, downReason, hasStatus, isHeld } from "../../status/index.js";
import { RESTRAINED_REASON } from "./maneuver.js";
import { UNARMED, clearPickedWeapon, pickedWeapon, tokenOf, weaponsFor } from "./weapons.js";
import { promptBox } from "./prompt.js";

export { SETTINGS as REACH_SETTINGS } from "./attack.js";
export { SETTINGS as SPELL_SETTINGS } from "./spell-text.js";

const LIMITS = Object.freeze({ acted: "You've acted this round.", dived: "Dived for cover: no attack this round.",
  wait: "Not your turn: get ready, and act on your turn.", keeper: "Waiting for the Keeper",
  restrained: RESTRAINED_REASON, bout: BOUT_REASON });
// Waiting for one's turn greys only the act buttons, not the whole flyout.
const GREYED = new Set(["acted", "dived", "keeper", "down", "restrained", "bout"]);
// The limits the Keeper is held to as well, with an Override.
const OVERRIDDEN = new Set(["acted", "down", "restrained"]);
// Weapon rows stay pickable under every limit but the Keeper's first blow.
const WEAPON_ROWS = ".rollbox-action-weapon";
const ACT_BUTTONS = ".rollbox-action-go, .rollbox-action-aim, .rollbox-action-reload, .rollbox-action-load-one, "
  + ".rollbox-action-cast, .rollbox-action-cast-hidden";
const OVERRIDE_BUTTONS = "button[data-override]";
const KEEP_CLEAR = ".rollbox-action-tabs, .rollbox-action-warning, .rollbox-action-override-prompt, .rollbox-result";
const GREYED_CLASS = "rollbox-action-greyed";
const GREYED_BUTTON = "rollbox-action-greyed-button";

// Never greys an element holding an act button: an ancestor's opacity would keep Override grey while hovered.
function greySpent(root) {
  const acts = [...root.querySelectorAll(ACT_BUTTONS)];
  const holders = new Set();
  for (const node of acts) for (let up = node.parentElement; up && up !== root; up = up.parentElement) holders.add(up);
  const visit = (parent) => {
    for (const child of parent.children) {
      if (acts.includes(child) || child.matches(KEEP_CLEAR)) continue;
      if (holders.has(child)) visit(child);
      else child.classList.add(GREYED_CLASS);
    }
  };
  visit(root);
  for (const node of acts) node.classList.add(GREYED_BUTTON);
}

const ACTION_TABS = Object.freeze([
  { id: "attack", label: "Attack" },
  { id: "maneuver", label: "Maneuver" },
  { id: "spell", label: "Spell" }
]);

// Each open flyout's watcher, told a changed actor, or EVERY to redraw whoever acts.
const open = new Set();
const EVERY = Symbol("every");

/**
 * Redraws an open flyout when an item of its acting character changes (updateItem), so ammo follows CoC7.
 * @param {Item} item
 * @returns {void}
 */
export function itemChanged(item) {
  for (const watch of [...open]) watch(item?.parent ?? null);
}

function actorChanged(actor) {
  for (const watch of [...open]) watch(actor ?? null);
}

/**
 * Redraws every open flyout when who is in the encounter changes (createCombatant, deleteCombatant, deleteCombat).
 * @returns {void}
 */
export function encounterChanged() {
  for (const watch of [...open]) watch(EVERY);
}

/**
 * Redraws every open flyout when the turn or round moves (updateCombat).
 * @param {Combat} _combat
 * @param {object} changes Foundry's update data
 * @returns {boolean} true when the open flyouts were told
 */
export function combatChanged(_combat, changes) {
  if (!changes || !("turn" in changes || "round" in changes)) return false;
  encounterChanged();
  return true;
}

/**
 * Redraws every open flyout when Rollbox's scene flags change (updateScene), e.g. the first-blow wait.
 * @param {Scene} _scene
 * @param {object} changes Foundry's update data
 * @returns {boolean} true when the open flyouts were told
 */
export function sceneChanged(_scene, changes) {
  if (!changes?.flags || !(MODULE_ID in changes.flags)) return false;
  encounterChanged();
  return true;
}

/**
 * Clears every combatant's picked weapon when combat is deleted (deleteCombat); active Keeper only.
 * @param {Combat} combat the encounter Foundry deleted
 * @returns {Promise<number>} how many characters were cleared
 */
export async function clearPickedOnCombatEnd(combat) {
  if (!isActiveKeeper()) return 0;
  let cleared = 0;
  try {
    for (const combatant of Array.from(combat?.combatants ?? [])) {
      if (await clearPickedWeapon(combatant?.actor)) cleared += 1;
    }
  } catch (error) {
    warn("couldn't clear the picked weapons after combat.", error);
  }
  return cleared;
}

/**
 * Registers the Action flyout with the panel and its hooks at ready; a player's needs the Player Rollbox on.
 * @returns {boolean} true when registered
 */
export function registerActionFlyout() {
  if (!panelHere()) return false;
  if (typeof Hooks?.on === "function") {
    Hooks.on("targetToken", targetChanged);
    Hooks.on(DIVE_HOOK, diveChanged);
    for (const hook of ["updateActor", "createActiveEffect", "deleteActiveEffect"]) Hooks.on(hook, targetUpdated);
    Hooks.on("updateItem", itemChanged);
    Hooks.on("updateToken", tokenMoved);
    Hooks.on("updateToken", castingMoved);
    Hooks.on("deleteCombat", clearPickedOnCombatEnd);
    Hooks.on("updateActor", actorChanged);
    Hooks.on("updateCombat", combatChanged);
    Hooks.on("updateScene", sceneChanged);
    for (const hook of ["createCombatant", "deleteCombatant", "deleteCombat"]) Hooks.on(hook, encounterChanged);
    Hooks.on("renderApplicationV2", onCastingWindow);
    Hooks.on("closeApplicationV2", onCastingWindowClosed);
  }
  return registerFlyout("action", { title: "Action", render: renderActionFlyout });
}

/**
 * Builds the whole flyout for the selected characters (the menu host's render).
 * @param {HTMLElement} body the flyout's body, already empty
 * @param {{actors: Actor[], start?: {tab?: "attack"|"maneuver"|"spell"}, close?: () => void,
 *   setTitle?: (text: string) => void}} context
 * @returns {{apply: (start: object) => void}|undefined} the controller the menu host keeps while it is open
 */
export function renderActionFlyout(body, { actors = [], start, close = () => {}, setTitle = () => {} } = {}) {
  const list = Array.from(actors ?? []).filter(Boolean).slice(0, 2);
  if (!list.length || !canUse("actions")) return undefined;
  const menu = new ActionFlyout(body, list, close);
  setTitle("Action");
  menu.apply(start ?? {});
  return { apply: (next) => menu.apply(next) };
}

class ActionFlyout {
  constructor(body, actors, close) {
    this.body = body;
    this.actors = actors;
    this.close = close;
    this.actor = actors[0];
    // With two selected, the second is made the Keeper's Foundry target, which CoC7's card reads.
    this.target = actors[1] ?? null;
    this.aimAtTarget();
    this.tab = ACTION_TABS[0].id;
    this.states = new Map();
    const stop = onTargetChange((change) => {
      if (!this.body.isConnected) stop();
      else if (!change?.moved || this.involves(change.moved)) this.draw();
    });
    const watch = (actor) => {
      if (!this.body.isConnected) open.delete(watch);
      else if (actor === EVERY || (actor && (actor === this.actor || (actor.id && actor.id === this.actor?.id)))) this.draw();
    };
    open.add(watch);
  }

  /** Returns the acting character's own state for a tab, kept per character so Swap keeps each one's. */
  state(tab) {
    const key = this.actor.uuid ?? this.actor.id ?? this.actor.name;
    if (!this.states.has(key)) this.states.set(key, { attack: attackState(), maneuver: maneuverState(), spell: spellState() });
    return this.states.get(key)[tab];
  }

  apply({ tab } = {}) {
    if (ACTION_TABS.some((t) => t.id === tab)) this.tab = tab;
    this.draw();
  }

  weapon() {
    const pick = this.state("attack").pick ?? pickedWeapon(this.actor);
    if (!pick) return null;
    return weaponsFor(this.actor).find((entry) => (entry.weapon.id ?? UNARMED) === pick)?.weapon ?? null;
  }

  /** Returns why this tab can't act now, or null; the order decides which reason shows. */
  limit() {
    const keeper = isKeeper();
    if (!keeper && keeperDeciding()) return "keeper";
    if (downReason(this.actor)) return "down";
    if (!keeper && hasStatus(this.actor, "tempInsanity")) return "bout";
    if (hasActed(this.actor)) return "acted";
    if (this.tab !== "maneuver" && isHeld(this.actor)) return "restrained";
    if (this.tab === "attack" && hasDived(this.actor)) return "dived";
    if (!keeper && inCombatFor(this.actor) && !this.myTurn()) return "wait";
    return null;
  }

  myTurn() {
    const turn = currentTurn(this.actor)?.actor;
    return Boolean(turn) && (turn === this.actor || (turn.id !== undefined && turn.id === this.actor?.id));
  }

  involves(moved) {
    const same = (token) => Boolean(token) && (token === moved || token.document === moved
      || (token.id !== undefined && token.id === moved.id));
    return same(tokenOf(this.actor)) || same(currentTarget().token) || same(this.target ? tokenOf(this.target) : null);
  }

  /** Makes the target's token the Keeper's only Foundry target, so CoC7's card uses it. */
  aimAtTarget() {
    const token = this.target ? tokenOf(this.target) : null;
    if (token && currentTarget().token !== token) targetToken(token);
  }

  swap() {
    if (!this.target) return;
    [this.actor, this.target] = [this.target, this.actor];
    this.aimAtTarget();
    this.draw();
  }

  draw() {
    const redraw = () => this.draw();
    const reason = this.limit();
    const limited = reason !== null && !isKeeper();
    const overriding = isKeeper() && OVERRIDDEN.has(reason);
    const spent = overriding || (limited && GREYED.has(reason));
    const root = element("div", "rollbox-action");
    root.classList.toggle("rollbox-action-acted", spent);
    root.append(this.tabRow());
    if (this.target) root.append(this.pairRow());
    const target = currentTarget();
    const box = targetBox({ actor: this.actor, weapon: this.tab === "attack" ? this.weapon() : null, tab: this.tab,
      onChange: redraw, fixed: Boolean(this.target) });
    root.append(box);
    const context = { actor: this.actor, target, state: this.state(this.tab), redraw, close: this.close, limited };
    let content = null;
    if (this.tab === "attack") {
      content = attackTab({ ...context, net: Number(box.dataset.net) || 0,
        toggles: (box.dataset.toggles ?? "").split(",").filter(Boolean) });
    }
    else if (this.tab === "maneuver") content = maneuverTab(context);
    else content = spellTab(context);
    if (content) root.append(content);
    if (reason) {
      root.append(element("div", "rollbox-hint rollbox-action-warning",
        overriding ? this.keeperWarning(reason) : this.playerWarning(reason)));
    }
    // Greyed here for buttons a tab doesn't redraw; each tab also refuses to send.
    if (limited) {
      for (const node of root.querySelectorAll(ACT_BUTTONS)) {
        node.disabled = true;
        if (GREYED.has(reason)) node.title = this.playerWarning(reason);
      }
    }
    if (limited && reason === "keeper") {
      for (const node of root.querySelectorAll(`${WEAPON_ROWS}, ${ACT_BUTTONS}`)) {
        node.disabled = true;
        node.title = LIMITS.keeper;
      }
    }
    if (spent) greySpent(root);
    if (overriding) {
      for (const node of root.querySelectorAll(ACT_BUTTONS)) {
        node.dataset.override ||= this.overrideQuestion(reason);
        node.title ||= this.keeperWarning(reason);
      }
    }
    if (isKeeper()) this.offerOverride(root);
    this.body.replaceChildren(root);
  }

  playerWarning(reason) {
    return reason === "down" ? downReason(this.actor) : LIMITS[reason];
  }

  keeperWarning(reason) {
    const name = this.actor.name ?? "They";
    if (reason === "down") return `${name} is ${String(downReason(this.actor)).toLowerCase()}.`;
    if (reason === "restrained") return `${name} is restrained: they can only try to break free.`;
    return `${name} acted this round.`;
  }

  overrideQuestion(reason) {
    if (reason === "acted") return `${this.actor.name ?? "They"} has already acted this round. Override?`;
    return `${this.keeperWarning(reason)} Override?`;
  }

  /** Makes every button carrying `data-override` ask its question first; Confirm lets that one press through. */
  offerOverride(root) {
    const marked = [...root.querySelectorAll(OVERRIDE_BUTTONS)];
    if (!marked.length) return;
    const words = new Map();
    for (const node of marked) {
      node.classList.add("rollbox-action-override");
      words.set(node, [...node.childNodes]);
      node.addEventListener("mouseenter", () => node.replaceChildren("Override"));
      node.addEventListener("mouseleave", () => node.replaceChildren(...words.get(node)));
    }
    // On the flyout, while capturing, so it runs before the button's own handler.
    root.addEventListener("click", (event) => {
      const pressed = event.target?.closest?.(OVERRIDE_BUTTONS);
      if (!pressed || !root.contains(pressed) || pressed.disabled) return;
      if (this.overrideOnce) {
        this.overrideOnce = false;
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      root.querySelector(".rollbox-action-override-prompt")?.remove();
      const box = promptBox({ lines: [pressed.dataset.override],
        confirm: "Confirm",
        onConfirm: () => {
          box.remove();
          pressed.replaceChildren(...words.get(pressed));
          this.overrideOnce = true;
          pressed.click();
        },
        onCancel: () => box.remove() });
      box.classList.add("rollbox-action-override-prompt");
      const warning = root.querySelector(".rollbox-action-warning");
      if (warning) warning.before(box);
      else root.append(box);
    }, true);
  }

  pairRow() {
    const row = element("div", "rollbox-action-pair");
    const acting = element("div", "rollbox-action-acting");
    acting.append(element("span", "rollbox-caption", "Acting"),
      element("span", "rollbox-action-acting-name", this.actor.name ?? "?"));
    const swap = button("rollbox-btn rollbox-action-swap", "⇅ Swap", () => this.swap());
    swap.setAttribute("aria-label", "Swap who acts and who is the target");
    row.append(acting, swap);
    return row;
  }

  tabRow() {
    const bar = tabBar(ACTION_TABS, { className: "rollbox-action-tabs", tabClass: "rollbox-action-tab",
      onPick: (id) => {
        this.tab = id;
        this.draw();
      } });
    bar.select(this.tab);
    return bar.element;
  }
}
