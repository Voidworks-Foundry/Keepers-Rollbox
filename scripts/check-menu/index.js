/**
 * Check menu: what the Keeper's Check button opens. The Keeper ticks one check (or two or more for a
 * combined roll, p. 92) from two tabs, Characteristic and Skill, sets the difficulty, dice, Blind and an optional
 * label (it can say "Idea" or "Know": those are INT and EDU checks), and sends it to the selected characters through
 * roll-requests/, which builds CoC7's own links and rolls NPCs for the Keeper. A click on the mini sheet can open it
 * with a characteristic ticked, or send at once (`apply`). Layout and rules: DESIGN.md, "Check menu". Keeper only:
 * registered only on the Keeper's client.
 */
import { element, getSetting, isKeeper } from "../utils.js";
import { registerMenu } from "../mini-sheet/index.js";
import {
  checkChoices, comparable, findSkillRow, groupBase, groupSkills, skillKey, withLevels
} from "../skill-values/index.js";
import { checkRequest, send } from "../roll-requests/index.js";
import {
  CHECK_TABS, button, filterRows, howRows, levels, line, requestLabel, runSend, segmented, sendSection, showResult
} from "../shared/index.js";

/** The status line, in red, while something required is missing (the buttons are greyed out until then). */
const MISSING = Object.freeze({ tick: "Tick a check to request it." });
/** Highest value the Keeper can type for an "Other skill…" that has no known base. */
const MAX_VALUE = 100;

/**
 * ready: plug the Check menu into the Keeper's panel. Does nothing for players or with the Rollbox
 * switch off (the panel isn't there either).
 * @returns {boolean} true when the menu was registered.
 */
export function registerCheckMenu() {
  if (!isKeeper() || !getSetting("rollboxEnabled")) return false;
  return registerMenu("check", { title: "Request a check", render: renderCheckMenu });
}

/**
 * The menu host's render: builds the whole menu from scratch for these characters. Called when the menu
 * opens and again when the selection changes while it is open.
 * @param {HTMLElement} body the flyout's body, already empty
 * @param {{actors: Actor[], start?: object}} context the selected characters, and a starting state (`apply`)
 * @returns {{apply: (start: object) => void}|undefined} the controller the menu host keeps while it is open
 */
export function renderCheckMenu(body, { actors = [], start } = {}) {
  if (!actors.length) return undefined;
  const menu = new CheckMenu(body, actors);
  menu.build();
  if (start) menu.apply(start);
  return { apply: (next) => menu.apply(next) };
}

// --- Small helpers -------------------------------------------------------------------------------

/**
 * What an "Other skill…" the Keeper typed stands for: a skill already listed (same name), or an
 * open-ended skill's specialisation at its group's base value ("Pilot (Boat)" → Pilot 1, Keeper Rulebook
 * p. 56), or `{ needsValue: true }` when neither, so the Keeper is asked for a value.
 * @param {string} text what the Keeper typed
 * @param {{name: string}[]} known the skills the Skill tab lists
 * @returns {{row?: object, check?: object, needsValue?: boolean}|null} null for empty text
 */
function otherSkill(text, known) {
  const name = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!name) return null;
  const row = findSkillRow(known, { name });
  if (row) return { row };
  const base = groupBase(name);
  if (base !== null) return { check: { kind: "skill", name, value: base } };
  return { needsValue: true, name };
}

// --- The menu ------------------------------------------------------------------------------------

class CheckMenu {
  /**
   * @param {HTMLElement} body
   * @param {Actor[]} actors
   */
  constructor(body, actors) {
    this.body = body;
    this.actors = actors;
    this.single = actors.length === 1;
    /** The two tabs' rows (skill-values): with several characters, without values (their skills: groupSkills). */
    this.choices = checkChoices(this.single ? actors[0] : null);
    /** Ticks persist across tabs: key → { check, name }, in the order ticked. */
    this.ticks = new Map();
    this.state = { tab: CHECK_TABS[0].id, all: true, difficulty: "regular", dice: 0, blind: false, label: "" };
    this.sending = false;
    this.rows = []; // { node, name } of the skill list, for search
    this.segments = []; // each row of buttons, marked pressed on update()
  }

  build() {
    const tabs = element("div", "rollbox-check-tabs");
    tabs.setAttribute("role", "tablist");
    this.tabButtons = CHECK_TABS.map((tab) => {
      const node = button("rollbox-btn rollbox-tab rollbox-check-tab", tab.label, () => this.showTab(tab.id));
      node.dataset.tab = tab.id;
      node.setAttribute("role", "tab");
      return node;
    });
    tabs.append(...this.tabButtons);
    this.panels = {
      characteristic: this.listPanel("characteristic"),
      skill: this.skillPanel()
    };
    const what = element("div", "rollbox-section");
    what.append(tabs, ...Object.values(this.panels));
    const who = element("p", "rollbox-menu-who", this.actors.map((actor) => actor.name ?? "").join(", "));
    who.title = who.textContent;
    this.body.append(who, what, this.optionsBlock(), this.sendBlock());
    this.showTab(this.state.tab);
    this.update();
  }

  showTab(id) {
    this.state.tab = id;
    for (const node of this.tabButtons) node.setAttribute("aria-selected", String(node.dataset.tab === id));
    for (const [tab, panel] of Object.entries(this.panels)) panel.hidden = tab !== id;
  }

  // --- Lists ---

  panel(id) {
    const panel = element("div", "rollbox-check-panel");
    panel.dataset.tab = id;
    panel.setAttribute("role", "tabpanel");
    return panel;
  }

  list() {
    return element("div", "rollbox-list rollbox-check-list");
  }

  /** One tickable row. `values` is shown only for one character. */
  row(key, check, name, values, title) {
    const node = element("label", "rollbox-row rollbox-check-row");
    node.dataset.key = key;
    if (title) node.title = title;
    const box = element("input");
    box.type = "checkbox";
    box.checked = this.ticks.has(key);
    box.addEventListener("change", () => this.tick(key, check, name, box.checked));
    node.append(box, element("span", "rollbox-check-name", name));
    if (values !== undefined) node.append(element("span", "rollbox-check-values", values));
    return node;
  }

  /** The Characteristic tab: one tickable row per characteristic, with its values for one character. */
  listPanel(id) {
    const panel = this.panel(id);
    const list = this.list();
    for (const choice of this.choices[id]) {
      list.append(this.row(choice.key, choice.check, choice.name, this.single ? levels(choice) : undefined));
    }
    panel.append(list);
    return panel;
  }

  /** One character: trained first, a divider, then the rest at base value. Several: A–Z, no values. */
  skillPanel() {
    const panel = this.panel("skill");
    const search = element("input", "rollbox-input rollbox-check-search");
    this.search = search;
    search.type = "search";
    search.placeholder = "Search skills";
    search.setAttribute("aria-label", "Search skills");
    search.addEventListener("input", () => this.filter(search.value));
    search.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !this.addRow.hidden) this.addOther(search.value);
    });

    const list = this.list();
    // Shown when the search matches no listed skill: adds the typed name.
    this.addRow = button("rollbox-row rollbox-check-row rollbox-check-add", "", () => this.addOther(search.value));
    this.addRow.hidden = true;
    this.addName = element("span", "rollbox-check-name");
    this.addRow.append(this.addName);
    if (this.single) {
      this.addValues = element("span", "rollbox-check-values");
      this.addRow.append(this.addValues);
    }
    list.append(this.addRow);
    this.known = this.single ? this.choices.skill : groupSkills(this.actors);
    let divided = false;
    for (const skill of this.known) {
      if (this.single && !skill.trained && !divided) {
        divided = true;
        this.divider = element("div", "rollbox-divider rollbox-check-divider", "Untrained · base value");
        list.append(this.divider);
      }
      const node = this.row(skillKey(skill.name), { kind: "skill", name: skill.name, cocid: skill.cocid ?? null },
        skill.name, this.single ? levels(skill) : undefined);
      this.rows.push({ node, name: skill.name });
      list.append(node);
    }

    this.extra = element("div");
    panel.append(search, list, this.extra, this.askBlock());
    return panel;
  }

  /** The skill search: hides rows that don't match; with none left, offers "+ Add <typed name>". */
  filter(text) {
    const shown = filterRows(this.rows, text, this.divider);
    const found = comparable(text) && !shown ? otherSkill(text, this.known) : null;
    this.addRow.hidden = !found;
    if (!found) return;
    const name = found.row?.name ?? found.check?.name ?? found.name;
    this.addName.textContent = `+ Add ${name}`;
    const base = found.check?.value;
    if (this.addValues) {
      this.addValues.textContent = base === undefined ? "" : levels(withLevels(base));
    }
  }

  /** Asked only when an added skill isn't listed and has no group base value (p. 56). */
  askBlock() {
    const block = element("div", "rollbox-check-other");
    this.valueLine = element("div", "rollbox-line rollbox-check-ask");
    this.valueLine.hidden = true;
    this.valueText = element("span", "rollbox-hint rollbox-check-hint");
    this.valueInput = element("input", "rollbox-input rollbox-check-other-value");
    this.valueInput.type = "number";
    this.valueInput.min = "0";
    this.valueInput.max = String(MAX_VALUE);
    this.valueInput.setAttribute("aria-label", "Value to roll an NPC at");
    const addValue = button("rollbox-btn rollbox-check-small", "Add", () => this.addOtherWithValue());
    this.valueLine.append(this.valueText, this.valueInput, addValue);

    this.otherNote = element("div", "rollbox-check-error");
    block.append(this.valueLine, this.otherNote);
    return block;
  }

  /** The search is empty again, so the whole list shows (after a skill was added). */
  clearSearch() {
    this.search.value = "";
    this.filter("");
  }

  /** "+ Add <name>": any skill or specialisation the Keeper typed in the search, e.g. "Pilot (Boat)". */
  addOther(text) {
    const found = otherSkill(text, this.known);
    this.valueLine.hidden = true;
    this.otherNote.textContent = "";
    if (!found) return;
    if (found.row) {
      const key = skillKey(found.row.name);
      const box = this.rows.find(({ node }) => node.dataset.key === key)?.node.querySelector("input");
      if (box && !box.checked) {
        box.checked = true;
        this.tick(key, { kind: "skill", name: found.row.name, cocid: found.row.cocid ?? null }, found.row.name, true);
      }
      this.clearSearch();
      return;
    }
    if (found.check) {
      this.addExtra(found.check, `base ${found.check.value}`);
      this.clearSearch();
      return;
    }
    this.pendingName = found.name;
    this.valueText.textContent = `No base value known for ${found.name}. Value to roll an NPC at:`;
    this.valueInput.value = "";
    this.valueLine.hidden = false;
    this.valueInput.focus?.();
  }

  addOtherWithValue() {
    const value = Number(this.valueInput.value);
    if (this.valueInput.value === "" || !Number.isFinite(value) || value < 0 || value > MAX_VALUE) {
      this.otherNote.textContent = `Type a value from 0 to ${MAX_VALUE}.`;
      return;
    }
    this.addExtra({ kind: "skill", name: this.pendingName, value: Math.trunc(value) }, `${Math.trunc(value)}%`);
    this.valueLine.hidden = true;
    this.clearSearch();
  }

  /** A typed skill, ticked, shown under the list so it can be unticked. */
  addExtra(check, note) {
    const key = skillKey(check.name);
    [...this.extra.children].find((node) => node.dataset.key === key)?.remove();
    this.ticks.delete(key);
    const node = this.row(key, check, check.name, note);
    node.querySelector("input").checked = true;
    this.extra.append(node);
    this.otherNote.textContent = "";
    this.tick(key, check, check.name, true);
  }

  tick(key, check, name, on) {
    if (on) this.ticks.set(key, { check, name });
    else this.ticks.delete(key);
    this.update();
  }

  // --- Options ---

  /** How: combined (All / Any), Difficulty and Dice with the Blind toggle, then Label. */
  optionsBlock() {
    const block = element("div", "rollbox-section rollbox-check-options");

    const combined = segmented({ choices: [["all", "All of them"], ["any", "Any one"]],
      get: () => (this.state.all ? "all" : "any"), set: (value) => { this.state.all = value === "all"; this.update(); } });
    this.segments.push(combined);
    this.combinedLine = line("Combined roll", combined.element);
    this.combinedLine.classList.add("rollbox-check-combined");

    this.how = howRows(this.state, () => this.update());
    this.segments.push(this.how);

    const label = element("input", "rollbox-input rollbox-check-label-input");
    this.labelInput = label;
    label.type = "text";
    label.placeholder = "Label (optional), e.g. notice the hidden knife";
    label.setAttribute("aria-label", "Label shown to the player");
    label.addEventListener("input", () => { this.state.label = label.value; this.update(); });

    block.append(this.combinedLine, this.how.element, label);
    return block;
  }

  // --- Sending ---

  sendBlock() {
    this.whisperButton = button("rollbox-btn rollbox-check-action rollbox-primary", "", () => this.send("whisper"));
    const chat = button("rollbox-btn rollbox-check-action", "Send to chat", () => this.send("chat"));
    const link = button("rollbox-btn rollbox-check-action rollbox-check-link rollbox-icon-action", "",
      () => this.send("link"));
    link.setAttribute("aria-label", "Copy link");
    this.linkButton = link;
    const glyph = element("i", "fa-solid fa-link");
    glyph.setAttribute("aria-hidden", "true");
    link.append(glyph);
    this.sender = sendSection([this.whisperButton, chat, link]);
    return this.sender.element;
  }

  /** The request for the current ticks and options, through roll-requests' checkRequest. */
  request() {
    if (!this.ticks.size) return null;
    const combined = this.ticks.size > 1;
    return checkRequest({
      checks: [...this.ticks.values()].map((t) => t.check),
      all: this.state.all,
      difficulty: this.state.difficulty,
      dice: this.state.dice,
      blind: this.state.blind && !combined,
      label: this.state.label
    });
  }

  send(mode) {
    const request = this.request();
    const targets = this.actors;
    if (!request || !targets.length) return;
    runSend(this, () => send(request, targets, { mode }),
      (result) => showResult(this.sender.result, result, { what: "Check", mode }));
  }

  // --- Redraw of the parts that depend on the state ---

  update() {
    const count = this.ticks.size;
    const combined = count > 1;
    for (const row of this.segments) row.sync();
    this.combinedLine.hidden = !combined;
    // CoC7 always shows combined cards, so Blind is off and can't be pressed while two or more are ticked.
    this.how.blind.disabled = combined;
    this.how.blind.on = this.state.blind && !combined;
    this.whisperButton.textContent = requestLabel(this.actors);
    // Greyed out until everything required is there; the red line says what is missing.
    this.sender.ready(!count ? MISSING.tick : null, this.sending);
  }

  // --- A starting state, from a click on the mini sheet (Void, 2026-11-15) ---

  /**
   * Tick a characteristic, as a click on the mini sheet asks. Unless `add`, every other tick is cleared first;
   * `plain` puts the options back to a Regular check with no dice, not blind and no label; `send` then sends it
   * ("whisper" as Request from player, or "link" to copy it); `focus: "link"` puts the focus on Copy link.
   * @param {{tick?: string, add?: boolean, plain?: boolean, send?: "whisper"|"link", focus?: "link"}} start
   *   `tick` is a row's key, e.g. "characteristic:str".
   */
  apply({ tick, add = false, plain = false, send, focus } = {}) {
    const choice = this.choices.characteristic.find((row) => row.key === tick);
    if (!add) {
      this.ticks.clear();
      for (const box of this.body.querySelectorAll(".rollbox-check-row input")) box.checked = false;
    }
    if (choice) {
      this.showTab("characteristic");
      const box = this.panels.characteristic.querySelector(`[data-key="${choice.key}"] input`);
      if (box) box.checked = true;
      this.ticks.set(choice.key, { check: choice.check, name: choice.name });
    }
    if (plain) {
      Object.assign(this.state, { difficulty: "regular", dice: 0, blind: false, label: "" });
      this.labelInput.value = "";
    }
    this.update();
    if (send) this.send(send);
    if (focus === "link") this.linkButton.focus?.();
  }
}
