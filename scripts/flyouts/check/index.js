/** The Check flyout: tabs, ticks, options and Send; each tab's list is beside it. See docs/check-flyout.md. */
import { PERSONAL, actorKey, declareSettings, element, isKeeper, option, warn } from "../../utils.js";
import { howClicked, registerFlyout, rowShortcut } from "../../panel/index.js";
import { canUse, panelHere } from "../../player/index.js";
import { checkChoices } from "../../skill-values/index.js";
import { checkRequest, makeCheck, requestLink, send } from "../../roll-requests/index.js";
import {
  CHECK_TABS, OWN_RESULT, button, glyphButton, howRows, levels, levelsNode, line, runSend, segmented, sendLabel,
  sendSection, showResult, tabBar, whoLine
} from "../flyout.js";
import { characteristicPanel } from "./characteristic.js";
import { SkillTab } from "./skill.js";
import { SanityTab } from "./sanity.js";

const MISSING = Object.freeze({ tick: "Tick a check to request it." });
const CLEAR_TEXT = "Unpick every check";
const NO_OPPOSED = "You can't start an opposed roll.";
const LINK_COPIED = "Link copied";
const NO_LINK = "The roll link couldn't be copied.";

/** The flyout's personal settings, registered by settings.js. */
export const SETTINGS = declareSettings([
  { key: "rollboxCheckOpensOn", scope: "user", type: String,
    choices: { characteristic: "Characteristic", skill: "Skill", last: "Last used" }, default: "characteristic",
    section: "panel", label: "Check opens on", note: PERSONAL },
  { key: "rollboxListStyle", scope: "user", type: String, choices: { list: "List", tiles: "Tiles" }, default: "list",
    section: "panel", label: "List style",
    hint: "How characteristics and skills are shown in the flyouts: a list, or tiles to click.", note: PERSONAL }
]);

const TABS = Object.freeze([...CHECK_TABS, Object.freeze({ id: "sanity", label: "Sanity" })]);
// A tab missing here (Sanity) is never a player's.
const TAB_FEATURES = Object.freeze({ characteristic: "checks", skill: "checks" });
const FIRST_TAB = "characteristic";

const TITLES = Object.freeze({ check: "Request a check", combined: "Request a combined check",
  sanity: "Request a Sanity check", own: "Make a check", ownCombined: "Make a combined check" });
const MAKE_CHECK = "Make check";

const TAB_PANELS = Object.freeze({
  characteristic: (flyout) => characteristicPanel(flyout),
  skill: (flyout) => new SkillTab(flyout).build()
});

// Module state, so a redraw for a new selection keeps the tab, and "Last used" survives closing.
let lastTab = null;

/**
 * Returns the Check flyout's tabs for this user, in order: all for the Keeper, the allowed check tabs for a player.
 * @param {User} [user]
 * @returns {{id: string, label: string}[]} possibly none
 */
export function tabsFor(user) {
  if (user?.isGM === true) return [...TABS];
  return TABS.filter((tab) => Object.hasOwn(TAB_FEATURES, tab.id) && canUse(TAB_FEATURES[tab.id]) === true);
}

/** Returns the tab to start on: the last one on a redraw, else the setting's; the user's first when missing. */
function openingTab(tabs, selectionChanged) {
  const setting = option("rollboxCheckOpensOn");
  const wanted = selectionChanged || setting === "last" ? (lastTab ?? FIRST_TAB) : setting;
  return tabs.some((tab) => tab.id === wanted) ? wanted : tabs[0]?.id;
}

const tiles = () => option("rollboxListStyle") === "tiles";

/**
 * Registers the Check flyout with the panel; does nothing when this client has no panel.
 * @returns {boolean} true when registered
 */
export function registerCheckFlyout() {
  if (!panelHere()) return false;
  return registerFlyout("check", { title: "Request a check", render: renderCheckFlyout });
}

/**
 * Builds the whole flyout from scratch into the menu host's empty body, applying `start` if given.
 * @param {HTMLElement} body
 * @param {{actors: Actor[], everyone?: boolean, start?: object, selectionChanged?: boolean,
 *   setTitle?: (text: string) => void, open?: (id: string, start: object) => boolean}} context
 * @returns {{apply: (start: object) => void}|undefined} undefined with no actors or no tab
 */
export function renderCheckFlyout(body, { actors = [], everyone = false, start, selectionChanged = false, setTitle,
  open } = {}) {
  const tabs = tabsFor(game.user);
  if (!actors.length || !tabs.length) return undefined;
  const menu = new CheckFlyout(body, actors, { tabs, tab: openingTab(tabs, selectionChanged), setTitle, open,
    everyone });
  menu.build();
  if (start) menu.apply(start);
  return { apply: (next) => menu.apply(next) };
}

class CheckFlyout {
  /**
   * @param {HTMLElement} body
   * @param {Actor[]} actors
   * @param {{tabs: {id: string, label: string}[], tab: string, setTitle?: Function, open?: Function,
   *   everyone?: boolean}} options
   */
  constructor(body, actors, { tabs, tab, setTitle, open, everyone = false }) {
    this.body = body;
    this.actors = actors;
    this.everyone = everyone === true;
    this.own = !isKeeper();
    this.single = actors.length === 1 && !this.everyone;
    this.choices = checkChoices(this.single ? actors[0] : null);
    // Ticks persist across tabs, in the order ticked.
    this.ticks = new Map();
    // A key can have several rows (a skill both listed and added); a tick marks them all.
    this.rowNodes = new Map();
    this.tiles = tiles();
    this.tabs = tabs;
    this.setTitle = typeof setTitle === "function" ? setTitle : () => {};
    this.openFlyout = typeof open === "function" ? open : null;
    this.state = { tab, all: true, difficulty: "regular", dice: 0, blind: false, label: "" };
    this.combinedAllowed = canUse("combined");
    this.sending = false;
    this.segments = [];
  }

  has(id) {
    return this.tabs.some((tab) => tab.id === id);
  }

  build() {
    const bar = tabBar(this.tabs, { className: "rollbox-check-tabs", tabClass: "rollbox-check-tab",
      onPick: (id) => this.showTab(id) });
    this.tabBar = bar;
    const tabs = bar.element;
    this.panels = Object.fromEntries(this.tabs.filter((tab) => TAB_PANELS[tab.id])
      .map((tab) => [tab.id, TAB_PANELS[tab.id](this)]));
    const what = element("div", "rollbox-section");
    what.append(tabs, ...Object.values(this.panels));
    const who = whoLine(this.actors, { everyone: this.everyone });
    // The Sanity tab has its own who line and send section, so each part shows on one side only.
    this.checkParts = [who];
    this.sanityParts = [];
    const after = [];
    if (Object.keys(this.panels).length) {
      const options = this.optionsBlock();
      const sender = this.sendBlock();
      this.checkParts.push(options, sender);
      after.push(options, sender);
    }
    if (this.has("sanity")) {
      this.sanity = new SanityTab(this.actors, { everyone: this.everyone });
      const { who: sanList, parts } = this.sanity.build();
      this.sanityParts.push(sanList, ...parts);
      after.push(...parts);
      this.body.append(sanList);
    }
    this.body.prepend(who);
    this.body.append(what, ...after);
    this.showTab(this.has(this.state.tab) ? this.state.tab : this.tabs[0].id);
  }

  showTab(id) {
    this.state.tab = id;
    lastTab = id;
    this.tabBar.select(id);
    for (const [tab, panel] of Object.entries(this.panels)) panel.hidden = tab !== id;
    const sanity = id === "sanity";
    for (const node of this.checkParts) node.hidden = sanity;
    for (const node of this.sanityParts) node.hidden = !sanity;
    this.update();
  }

  panel(id) {
    const panel = element("div", "rollbox-check-panel");
    panel.dataset.tab = id;
    panel.setAttribute("role", "tabpanel");
    return panel;
  }

  list(kind = "skill") {
    const node = element("div", "rollbox-list rollbox-check-list");
    if (this.tiles) node.classList.add("rollbox-check-tiles", `rollbox-check-tiles-${kind}`);
    return node;
  }

  /** Builds one tickable row or tile; `values` is a levels row or a short note, for one character only. */
  row(key, check, name, values) {
    const node = this.tiles ? this.tile(name, values)
      : this.listRow(name, values, (on) => this.tick(key, check, name, on));
    node.dataset.key = key;
    const nodes = this.rowNodes.get(key) ?? new Set();
    nodes.add(node);
    this.rowNodes.set(key, nodes);
    this.mark(key);
    const act = (event, right) => {
      const action = rowShortcut(howClicked(event, right));
      // A plain click on a list row is the tick box's own; anything else is the shortcut's alone.
      if (action === "tick" && !right && !this.tiles && !event.shiftKey && !event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      if (action) this.rowAction(action, key, check, name);
    };
    node.addEventListener("click", (event) => act(event, false));
    node.addEventListener("contextmenu", (event) => act(event, true));
    return node;
  }

  listRow(name, values, onToggle) {
    const node = element("label", "rollbox-row rollbox-check-row");
    const box = element("input");
    box.type = "checkbox";
    box.addEventListener("change", () => onToggle(box.checked));
    node.append(box, element("span", "rollbox-check-name", name));
    if (typeof values === "object" && values !== null) node.append(levelsNode("rollbox-check-values", values));
    else if (values !== undefined) node.append(element("span", "rollbox-check-values", values));
    return node;
  }

  tile(name, values) {
    const node = element("button", "rollbox-check-tile");
    node.type = "button";
    node.title = name;
    node.append(element("span", "rollbox-check-name", name));
    if (typeof values === "object" && values !== null) {
      const known = values.value !== null && values.value !== undefined;
      node.append(element("span", "rollbox-check-tile-value", known ? String(values.value) : levels(values)));
      if (known) node.append(element("span", "rollbox-check-values", `${values.half} · ${values.fifth}`));
    } else if (values !== undefined) {
      node.append(element("span", "rollbox-check-values", values));
    }
    return node;
  }

  mark(key) {
    const on = this.ticks.has(key);
    for (const node of this.rowNodes.get(key) ?? []) {
      const box = node.querySelector("input");
      if (box) box.checked = on;
      else node.setAttribute("aria-pressed", String(on));
    }
  }

  tick(key, check, name, on) {
    if (on && !this.combinedAllowed) this.untickAll();
    if (on) this.ticks.set(key, { check, name });
    else this.ticks.delete(key);
    this.mark(key);
    this.update();
  }

  untickAll() {
    const keys = [...this.ticks.keys()];
    this.ticks.clear();
    for (const key of keys) this.mark(key);
  }

  rowAction(action, key, check, name) {
    if (action === "tick") return this.tick(key, check, name, !this.ticks.has(key));
    if (action === "add") return this.tick(key, check, name, true);
    if (action === "combinedNow") {
      this.tick(key, check, name, true);
      return this.send();
    }
    if (action === "send") return this.sendOne(check);
    if (action === "copy") return this.copyLink(check);
    return this.opposed(key, action === "opposedNow");
  }

  /** Opens Opposed with this check as the first character's side; `create` makes the card at once. */
  opposed(key, create) {
    if (!isKeeper() && !canUse("opposed")) return this.say(NO_OPPOSED);
    const first = this.actors[0];
    const start = { first: actorKey(first), picks: { [actorKey(first)]: key }, create };
    const opened = this.actors.length <= 2 && this.openFlyout?.("opposed", start) === true;
    if (!opened) this.say("Opposed can't be opened for this selection.");
  }

  say(text) {
    this.sender?.result.replaceChildren(element("div", "rollbox-result-line", text));
  }

  /** Builds the options; a player's own check gets only the combined row. */
  optionsBlock() {
    const block = element("div", "rollbox-section rollbox-check-options");

    const combined = segmented({ choices: [["all", "All of them"], ["any", "Any one"]],
      get: () => (this.state.all ? "all" : "any"), set: (value) => { this.state.all = value === "all"; this.update(); } });
    this.segments.push(combined);
    this.combinedLine = line("Combined roll", combined.element, this.clearButton());
    this.combinedLine.classList.add("rollbox-check-combined");

    this.how = howRows(this.state, () => this.update(), { own: this.own });
    this.segments.push(this.how);
    if (this.own) {
      block.append(this.combinedLine, this.how.element);
      return block;
    }

    const label = element("input", "rollbox-input rollbox-check-label-input");
    this.labelInput = label;
    label.type = "text";
    label.placeholder = "Label (optional), e.g. notice the hidden knife";
    label.setAttribute("aria-label", "Label shown to the player");
    label.addEventListener("input", () => { this.state.label = label.value; this.update(); });

    block.append(this.combinedLine, this.how.element, label);
    return block;
  }

  clearButton() {
    return glyphButton("rollbox-btn rollbox-check-clear", "fa-arrow-rotate-left", () => {
      this.untickAll();
      this.update();
    }, { label: CLEAR_TEXT, tooltip: CLEAR_TEXT });
  }

  sendBlock() {
    this.whisperButton = button("rollbox-btn rollbox-check-action rollbox-primary", "", () => this.send());
    this.sender = sendSection([this.whisperButton]);
    return this.sender.element;
  }

  request() {
    if (!this.ticks.size) return null;
    const combined = this.ticks.size > 1;
    return checkRequest({
      checks: [...this.ticks.values()].map((t) => t.check),
      all: this.state.all,
      difficulty: this.state.difficulty,
      dice: this.state.dice,
      blind: this.state.blind && !combined && !this.own,
      label: this.own ? "" : this.state.label
    });
  }

  send() {
    this.dispatch(this.request());
  }

  /** Sends just this check as a plain Regular one, leaving the ticks and options as they are. */
  sendOne(check) {
    this.dispatch(checkRequest({ checks: [check] }));
  }

  /** Copies this check's CoC7 roll link, with the flyout's options, to the clipboard; the Keeper's only. */
  async copyLink(check) {
    if (this.own) return;
    const { difficulty, dice, blind, label } = this.state;
    const link = requestLink(checkRequest({ checks: [check], difficulty, dice, blind, label }), this.actors[0]);
    // Foundry v14: game.clipboard is public, but a browser without clipboard access rejects the write.
    const copy = globalThis.game?.clipboard?.copyPlainText;
    if (!link || typeof copy !== "function") return this.say(NO_LINK);
    try {
      await copy.call(game.clipboard, link);
      globalThis.ui?.notifications?.info?.(LINK_COPIED);
    } catch (error) {
      warn("the roll link couldn't be copied.", error);
      this.say(NO_LINK);
    }
  }

  dispatch(request) {
    const targets = this.actors;
    if (!request || !targets.length) return;
    if (this.own) {
      runSend(this, () => makeCheck(request, targets[0]),
        (result) => showResult(this.sender.result, result, OWN_RESULT));
      return;
    }
    runSend(this, () => send(request, targets),
      (result) => showResult(this.sender.result, result, { what: "Check" }));
  }

  update() {
    const count = this.ticks.size;
    const combined = count > 1;
    let title = combined ? TITLES.combined : TITLES.check;
    if (this.own) title = combined ? TITLES.ownCombined : TITLES.own;
    if (this.state.tab === "sanity") title = TITLES.sanity;
    this.setTitle(title);
    if (!this.sender) return;
    for (const row of this.segments) row.sync();
    this.combinedLine.hidden = !combined;
    // CoC7 8.15: combined cards are always public, so Blind is off while two or more are ticked.
    this.how.blind.disabled = combined;
    this.how.blind.on = this.state.blind && !combined;
    this.whisperButton.textContent = this.own ? MAKE_CHECK : sendLabel(this.actors, { everyone: this.everyone });
    // A theme that hides the title (Art Deco) marks a combined check on the button from this.
    this.whisperButton.toggleAttribute("data-combined", combined);
    this.sender.ready(!count ? MISSING.tick : null, this.sending);
  }

  /**
   * Applies a starting state from a character sheet click: ticks a characteristic or hands it to the Sanity tab.
   * @param {{tab?: "sanity", tick?: string, add?: boolean, plain?: boolean, send?: boolean}} start
   */
  apply({ tab, tick, add = false, plain = false, send } = {}) {
    if (tab === "sanity") {
      if (!this.sanity) return;
      this.showTab("sanity");
      this.sanity.apply({ plain, send });
      return;
    }
    if (!this.panels.characteristic) return;
    const choice = this.choices.characteristic.find((row) => row.key === tick);
    if (!add || !this.combinedAllowed) this.untickAll();
    if (choice) {
      this.showTab("characteristic");
      this.ticks.set(choice.key, { check: choice.check, name: choice.name });
      this.mark(choice.key);
    }
    if (plain) {
      Object.assign(this.state, { difficulty: "regular", dice: 0, blind: false, label: "" });
      if (this.labelInput) this.labelInput.value = "";
    }
    this.update();
    if (send) this.send();
  }
}
