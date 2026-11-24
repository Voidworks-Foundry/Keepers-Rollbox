/** The Other flyout: its tabs and which one shows; each tab is its own file. See docs/other-flyout.md. */
import { element, warn } from "../../utils.js";
import { registerFlyout } from "../../panel/index.js";
import { canUse, panelHere, pickTarget as askTarget } from "../../player/index.js";
import { tabBar } from "../flyout.js";
import { renderOpposedRoll } from "../opposed/index.js";
import { renderItem } from "./item.js";
import { LuckSection } from "./luck.js";
import { assistColumns, assistGroupChanged, renderAssist } from "./assist.js";
import { playerAssistChanged } from "./player-assist.js";

export { registerAssistGroups } from "./assist-group.js";

/** Every tab, with the flyout's title while it is open and the player feature that allows it. */
const SECTIONS = Object.freeze([
  { id: "item", label: "Item", title: "Item check", feature: null },
  { id: "luck", label: "Luck", title: "Luck check", feature: null },
  { id: "opposed", label: "Opposed", title: "Opposed roll", feature: "opposed" },
  { id: "assist", label: "Assist", title: "Assist", feature: "assist" }
]);
// The Keeper's Opposed is its own menu button, so it is a player's tab only.
const KEEPER_TABS = Object.freeze(["item", "luck", "assist"]);
const PLAYER_TABS = Object.freeze(["opposed", "assist"]);
const FALLBACK = Object.freeze({ item: ["luck"] });

// Module state: the last tab chosen survives closing; the shown tab drives the character cards' columns.
let lastTab = null;
let shownTab = null;

/**
 * Returns the Other flyout's tabs for this user, in order; a player's only those `allowed` permits.
 * @param {User} [user]
 * @param {(feature: string) => boolean} [allowed]
 * @returns {{id: string, label: string, title: string}[]}
 */
export function tabsFor(user, allowed = canUse) {
  const ids = user?.isGM ? KEEPER_TABS : PLAYER_TABS.filter((id) => permitted(allowed, id));
  return ids.map((id) => {
    const { label, title } = SECTIONS.find((section) => section.id === id);
    return { id, label, title };
  });
}

/** Tells whether a player may use this tab; a permission check that throws counts as no. */
function permitted(allowed, id) {
  try {
    return allowed(SECTIONS.find((section) => section.id === id).feature) === true;
  } catch (error) {
    warn("couldn't read whether a player may use the Other flyout's tab.", error);
    return false;
  }
}

/**
 * Registers the Other flyout and its assist-group watch; does nothing when this client has no panel.
 * @returns {boolean} true when registered
 */
export function registerOtherFlyout() {
  if (!panelHere()) return false;
  lastTab = null;
  shownTab = null;
  if (typeof Hooks?.on === "function") {
    Hooks.on("updateActor", (actor, changes) => assistGroupChanged(actor, changes) || playerAssistChanged(actor, changes));
  }
  return registerFlyout("other", { title: "Other", render: renderOtherFlyout, columns: otherColumns });
}

/**
 * Returns the character cards' value columns while Other is open: Assist's on its tab, else null for the cards' own.
 * @param {Actor[]} actors
 * @returns {{label: string, value: (actor: Actor) => (number|string)}[]|null}
 */
export function otherColumns(actors = []) {
  return shownTab === "assist" ? assistColumns(actors) : null;
}

/**
 * Builds the whole flyout from scratch into the menu host's empty body; on `selectionChanged` Assist and Opposed keep
 * their choices.
 * @param {HTMLElement} body
 * @param {{actors: Actor[], everyone?: boolean, start?: {section?: string, plain?: boolean, send?: boolean},
 *   setTitle?: (text: string) => void, close?: () => void, selectionChanged?: boolean, cardChanged?: () => void,
 *   allowed?: (feature: string) => boolean, pickTarget?: Function}} context
 * @returns {{apply: (start: object) => void}|undefined} undefined with no actors or no tab
 */
export function renderOtherFlyout(body, { actors = [], everyone = false, start, setTitle = () => {}, close = () => {},
  selectionChanged = false, cardChanged = () => {}, allowed = canUse, pickTarget = askTarget } = {}) {
  if (!actors.length) return undefined;
  const keeper = game.user?.isGM === true;
  const tabs = tabsFor(game.user, allowed);
  if (!tabs.length) return undefined;
  if (start?.section && tabs.some((tab) => tab.id === start.section)) lastTab = start.section;
  const menu = new OtherFlyout(body, actors, tabs, { keeper, everyone, setTitle, close, cardChanged, pickTarget });
  menu.build(selectionChanged);
  if (start) menu.apply(start);
  return { apply: (next) => menu.apply(next) };
}

class OtherFlyout {
  constructor(body, actors, tabs, { keeper, everyone = false, setTitle, close, cardChanged, pickTarget }) {
    this.body = body;
    this.actors = actors;
    this.everyone = everyone === true;
    this.tabs = tabs;
    this.keeper = keeper;
    this.setTitle = setTitle;
    this.close = close;
    this.cardChanged = cardChanged;
    this.pickTarget = pickTarget;
    this.section = null;
    this.luck = null;
  }

  /** Tells whether a tab can be used for this selection: Item needs exactly one character. */
  usable(id) {
    if (!this.tabs.some((tab) => tab.id === id)) return false;
    if (id === "item") return this.actors.length === 1 && !this.everyone;
    return true;
  }

  /** Returns the tab to show: the last one chosen if usable, else its fallback, else this selection's default. */
  pick() {
    const preferred = this.actors.length === 1 && !this.everyone ? "item" : "luck";
    const order = [lastTab, ...(FALLBACK[lastTab] ?? []), preferred, ...this.tabs.map((tab) => tab.id)];
    return order.find((id) => id && this.usable(id)) ?? null;
  }

  build(selectionChanged) {
    this.tabBar = tabBar(this.tabs, { className: "rollbox-other-tabs", tabClass: "rollbox-other-tab", key: "section",
      onPick: (id) => {
        lastTab = id;
        this.show(id);
      },
      disabled: (id) => !this.usable(id) });
    this.content = element("div", "rollbox-other-section");
    this.body.append(this.tabBar.element, this.content);
    const section = this.pick();
    if (section) this.show(section, selectionChanged);
  }

  /** Draws a tab from scratch; `carry` keeps Assist's and Opposed's choices across a new selection. */
  show(id, carry = false) {
    const section = this.usable(id) ? id : this.pick();
    if (!section) return;
    this.section = section;
    shownTab = section;
    this.tabBar.select(section);
    this.content.replaceChildren();
    this.content.dataset.section = section;
    this.luck = null;
    const context = { actors: this.everyone ? [] : this.actors, close: this.close, selectionChanged: carry,
      cardChanged: this.cardChanged, targeting: !this.keeper, pickTarget: this.pickTarget };
    if (section === "item") renderItem(this.content, this.actors);
    else if (section === "assist") renderAssist(this.content, context);
    else if (section === "opposed") renderOpposedRoll(this.content, context);
    else {
      this.luck = new LuckSection(this.content, this.actors, { everyone: this.everyone });
      this.luck.build();
    }
    this.setTitle(this.tabs.find((tab) => tab.id === section).title);
    this.cardChanged();
  }

  /** Applies a starting state from a character sheet click; `plain` and `send` go to the Luck tab. */
  apply({ section, ...rest } = {}) {
    if (section && this.tabs.some((tab) => tab.id === section)) lastTab = section;
    if (section && section !== this.section) this.show(section);
    if (this.luck && (rest.plain || rest.send)) this.luck.apply(rest);
  }
}
