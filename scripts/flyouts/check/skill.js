/** The Check flyout's Skill tab: the list, its search and adding an unlisted skill. See docs/check-flyout.md. */
import { element } from "../../utils.js";
import { comparable, findSkillRow, groupBase, groupSkills, skillKey, withLevels } from "../../skill-values/index.js";
import { button, filterRows, levelParts, searchBox } from "../flyout.js";

/** Highest value the Keeper can type for an added skill with no known base. */
const MAX_VALUE = 100;

/**
 * Resolves a typed skill name: a listed row, a specialisation at its group's base value, or one needing a value.
 * @param {string} text
 * @param {{name: string}[]} known
 * @returns {{row?: object, check?: object, needsValue?: boolean, name?: string}|null} null for empty text
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

/** Builds and runs the Skill tab, ticking through the Check flyout it is given. */
export class SkillTab {
  /**
   * @param {{actors: Actor[], single: boolean, choices: {skill: object[]}, panel: Function, list: Function,
   *   row: Function, tick: Function, ticks: Map}} flyout
   */
  constructor(flyout) {
    this.flyout = flyout;
    this.rows = [];
  }

  /** @returns {HTMLElement} */
  build() {
    const { flyout } = this;
    const panel = flyout.panel("skill");
    const search = searchBox({ className: "rollbox-check-search", onInput: (text) => this.filter(text) });
    this.search = search;
    search.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !this.addRow.hidden) this.addOther(search.value);
    });

    const list = flyout.list();
    this.addRow = button("rollbox-row rollbox-check-row rollbox-check-add", "", () => this.addOther(search.value));
    this.addRow.hidden = true;
    this.addName = element("span", "rollbox-check-name");
    this.addRow.append(this.addName);
    if (flyout.single) {
      this.addValues = element("span", "rollbox-check-values");
      this.addRow.append(this.addValues);
    }
    list.append(this.addRow);
    this.known = flyout.single ? flyout.choices.skill : groupSkills(flyout.actors);
    let divided = false;
    for (const skill of this.known) {
      if (flyout.single && !skill.trained && !divided) {
        divided = true;
        this.divider = element("div", "rollbox-divider rollbox-check-divider", "Untrained · base value");
        list.append(this.divider);
      }
      const node = flyout.row(skillKey(skill.name), { kind: "skill", name: skill.name, cocid: skill.cocid ?? null },
        skill.name, flyout.single ? skill : undefined);
      this.rows.push({ node, name: skill.name });
      list.append(node);
    }

    this.extra = flyout.list();
    this.extra.classList.add("rollbox-check-extra");
    panel.append(search, list, this.extra, this.askBlock());
    return panel;
  }

  /** Filters the list; with no row left, offers to add the typed name. */
  filter(text) {
    const shown = filterRows(this.rows, text, this.divider);
    const found = comparable(text) && !shown ? otherSkill(text, this.known) : null;
    this.addRow.hidden = !found;
    if (!found) return;
    const name = found.row?.name ?? found.check?.name ?? found.name;
    this.addName.textContent = `+ Add ${name}`;
    const base = found.check?.value;
    if (this.addValues) {
      this.addValues.replaceChildren(...(base === undefined ? [] : levelParts(withLevels(base))));
    }
  }

  /** Builds the value prompt for an added skill with no group base value. */
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

  clearSearch() {
    this.search.value = "";
    this.filter("");
  }

  addOther(text) {
    const found = otherSkill(text, this.known);
    this.valueLine.hidden = true;
    this.otherNote.textContent = "";
    if (!found) return;
    if (found.row) {
      const key = skillKey(found.row.name);
      this.flyout.tick(key, { kind: "skill", name: found.row.name, cocid: found.row.cocid ?? null }, found.row.name,
        true);
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

  /** Ticks an added skill and lists it under the list, replacing an earlier one of the same key. */
  addExtra(check, note) {
    const key = skillKey(check.name);
    [...this.extra.children].find((node) => node.dataset.key === key)?.remove();
    this.flyout.ticks.delete(key);
    const node = this.flyout.row(key, check, check.name, note);
    this.extra.append(node);
    this.otherNote.textContent = "";
    this.flyout.tick(key, check, check.name, true);
  }
}
