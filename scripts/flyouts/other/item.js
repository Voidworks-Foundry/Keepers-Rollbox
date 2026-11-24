/**
 * The Other flyout's Item tab: one character's weapon or an improvised weapon, sent as a labelled skill check.
 * See docs/other-flyout.md.
 */
import { element, warn } from "../../utils.js";
import { findSkillRow, sameSkill, skills } from "../../skill-values/index.js";
import { damageText, improvisedRequest, send, weaponRequest, weaponSkills } from "../../roll-requests/index.js";
import { button, howRows, levelsNode, line, runSend, segmented, sendLabel, sendSection, showResult } from "../flyout.js";
import { IMPROVISED, IMPROVISED_SKILLS, improvisedSkill, otherSkillList } from "../improvised.js";
import {
  NO_DICE, customDice, dicePicker, hideWhenSimplified, tidyDice, valueBox, valueLine, withHalfBonus
} from "../../shared/index.js";

// A thrown object adds half the damage bonus (Keeper Rulebook weapons table).
const THROW = IMPROVISED_SKILLS.find((s) => s.id === "throw");
/** Die sizes of the damage quick-picks, each one die plus the damage bonus. */
const QUICK_DAMAGE = Object.freeze([3, 4, 6, 8, 10]);
const MISSING = Object.freeze({
  pick: "Pick a weapon, or an improvised weapon.",
  what: "Type what the improvised weapon is.",
  skill: "Pick the skill it uses.",
  damage: "Damage is dice, e.g. 1D6, 1D6+2 or 1D6+DB."
});

// Gives each flyout's radio buttons their own group name.
let menuCount = 0;

/**
 * Builds the Item tab from scratch for the one selected character; draws nothing for any other number.
 * @param {HTMLElement} body
 * @param {Actor[]} actors
 * @returns {void}
 */
export function renderItem(body, actors = []) {
  if (actors.length !== 1 || !actors[0]) return;
  new ItemFlyout(body, actors[0]).build();
}

/** Returns the character's weapons, A–Z, or none when its items can't be read. */
function weaponsOf(actor) {
  try {
    return Array.from(actor.items ?? []).filter((item) => item?.type === "weapon")
      .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
  } catch {
    return [];
  }
}

class ItemFlyout {
  /**
   * @param {HTMLElement} body
   * @param {Actor} actor
   */
  constructor(body, actor) {
    this.body = body;
    this.actor = actor;
    this.group = `rollbox-item-${++menuCount}`;
    this.skillRows = skills(actor);
    // One row per weapon and skill it uses: a throwable knife gives a Brawl row and a Throw row.
    this.weapons = weaponsOf(actor).flatMap((weapon) => {
      let choices = [{ which: "main", skill: null }];
      try {
        choices = weaponSkills(actor, weapon);
      } catch (error) {
        warn(`could not read the skill of ${weapon.name}.`, error);
      }
      return choices.map(({ which, skill }) => ({ weapon, which, skill, pick: `${weapon.id}#${which}`,
        row: skill ? findSkillRow(this.skillRows, skill) : null }));
    });
    this.state = { pick: null, what: "", skill: IMPROVISED_SKILLS[0].id, other: "",
      difficulty: "regular", dice: 0, blind: false };
    this.sending = false;
    this.half = false;
  }

  build() {
    const what = element("div", "rollbox-section");
    what.append(this.listBlock(), this.improvisedBlock());
    this.body.append(what, this.damageBlock(), this.optionsBlock(), this.sendBlock());
    this.update();
  }

  listBlock() {
    const list = element("div", "rollbox-list rollbox-item-list");
    list.setAttribute("role", "radiogroup");
    list.setAttribute("aria-label", "Weapon");
    if (!this.weapons.length) {
      list.append(element("div", "rollbox-hint rollbox-item-hint", `No weapons on ${this.actor.name ?? "this character"}'s sheet.`));
    }
    for (const { weapon, skill, row, pick } of this.weapons) {
      const node = this.row(pick, weapon.name ?? "?", skill ? (row?.name ?? skill.name) : "no skill set",
        skill ? levelsNode("rollbox-item-values", row) : "");
      node.querySelector("input").disabled = !skill;
      list.append(node);
    }
    list.append(this.row(IMPROVISED, "+ Improvised weapon"));
    return list;
  }

  row(value, name, skillName, values) {
    const node = element("label", "rollbox-row rollbox-item-row");
    node.dataset.pick = value;
    const radio = element("input");
    radio.type = "radio";
    radio.name = this.group;
    radio.value = value;
    radio.addEventListener("change", () => {
      if (radio.checked) this.pick(value);
    });
    const text = element("span", "rollbox-item-text");
    text.append(element("span", "rollbox-item-name", name));
    if (skillName !== undefined) text.append(element("span", "rollbox-item-skill", skillName));
    node.append(radio, text);
    if (values !== undefined) node.append(values?.nodeType ? values : element("span", "rollbox-item-values", values));
    return node;
  }

  pick(value) {
    this.state.pick = value;
    this.update();
  }

  improvisedBlock() {
    this.improvised = element("div", "rollbox-item-improvised");

    const what = element("input", "rollbox-input rollbox-item-what");
    what.type = "text";
    what.placeholder = "What is it? e.g. Candlestick";
    what.setAttribute("aria-label", "What the improvised weapon is");
    what.addEventListener("input", () => { this.state.what = what.value; this.update(); });

    this.skillButtons = segmented({ choices: IMPROVISED_SKILLS.map((s) => [s.id, s.label]), get: () => this.state.skill,
      set: (value) => { this.state.skill = value; this.update(); } });
    const skill = line("Skill", this.skillButtons.element);

    this.otherSelect = otherSkillList(this.skillRows, { className: "rollbox-item-other",
      onChange: (value) => { this.state.other = value; this.update(); } });

    this.skillLine = element("div", "rollbox-line rollbox-item-chosen");

    this.improvised.append(what, skill, this.otherSelect, this.skillLine);
    return this.improvised;
  }

  /** Builds the optional damage line; NO_DICE is no damage roll, anything else follows roll-requests' rule. */
  damageBlock() {
    this.damage = element("div", "rollbox-section");
    this.damageLine = valueLine({ label: "Damage", value: NO_DICE, onChange: () => this.update(),
      check: (text) => {
        const formula = tidyDice(text);
        return formula === NO_DICE ? NO_DICE : damageText(formula);
      } });
    this.damageLine.element.classList.add("rollbox-item-damage");

    const quick = element("div", "rollbox-segmented rollbox-item-quick");
    quick.setAttribute("role", "group");
    quick.setAttribute("aria-label", "Common damage");
    const pickDamage = (formula) => {
      this.damageLine.set(formula);
      this.update();
    };
    const none = button("rollbox-btn rollbox-segment", "None", () => pickDamage(NO_DICE));
    none.dataset.formula = NO_DICE;
    this.quickPicks = QUICK_DAMAGE.map((faces) => {
      const node = button("rollbox-btn rollbox-segment", "", () => pickDamage(this.quickFormula(faces)));
      node.dataset.faces = String(faces);
      return node;
    });
    this.quickPicks.unshift(none);
    quick.append(...this.quickPicks);
    hideWhenSimplified(quick);

    this.damagePicker = dicePicker({ label: "Damage", line: this.damageLine, damageBonus: true,
      onChange: () => this.update() });
    this.custom = customDice({ label: "Custom damage", pickers: [this.damagePicker] });

    this.damage.append(element("div", "rollbox-caption", "Damage (optional)"), valueBox([this.damageLine.element]),
      quick, this.custom.element);
    return this.damage;
  }

  thrown() {
    const skill = this.improvisedSkill();
    return Boolean(skill) && sameSkill(skill, THROW);
  }

  quickFormula(faces) {
    return `1D${faces}+${this.thrown() ? "½DB" : "DB"}`;
  }

  improvisedSkill() {
    return improvisedSkill(this.state.skill, this.state.other, this.skillRows);
  }

  optionsBlock() {
    const block = element("div", "rollbox-section");
    this.how = howRows(this.state, () => this.update());
    block.append(this.how.element);
    return block;
  }

  sendBlock() {
    const whisper = button("rollbox-btn rollbox-item-action rollbox-primary", sendLabel([this.actor]), () => this.send());
    this.sender = sendSection([whisper]);
    return this.sender.element;
  }

  /** Returns the request for the current pick and options, or null while incomplete. */
  request() {
    const options = { difficulty: this.state.difficulty, dice: this.state.dice, blind: this.state.blind };
    if (this.state.pick === IMPROVISED) {
      const skill = this.improvisedSkill();
      const damage = this.damageLine.value;
      if (!this.state.what.trim() || !skill || damage === null) return null;
      return improvisedRequest({ what: this.state.what, skill: { name: skill.name, cocid: skill.cocid ?? null },
        damage: damage === NO_DICE ? "" : damage, ...options });
    }
    const picked = this.picked();
    return picked?.skill ? weaponRequest({ weaponId: picked.weapon.id, skill: picked.which, ...options }) : null;
  }

  picked() {
    return this.weapons.find(({ pick }) => pick === this.state.pick) ?? null;
  }

  send() {
    const request = this.request();
    if (!request) return;
    runSend(this, () => send(request, [this.actor]),
      (result) => showResult(this.sender.result, result, { what: "Item check" }));
  }

  update() {
    this.skillButtons.sync();
    this.how.sync();
    const improvised = this.state.pick === IMPROVISED;
    this.improvised.hidden = !improvised;
    this.damage.hidden = !improvised;
    this.otherSelect.hidden = this.state.skill !== "other";
    const skill = this.improvisedSkill();
    this.skillLine.replaceChildren();
    if (skill) {
      this.skillLine.append(element("span", "rollbox-item-name", skill.name),
        levelsNode("rollbox-item-values", skill));
    }
    // Switching to or from Throw halves or restores a damage bonus already on the line.
    const half = this.thrown();
    if (half !== this.half) {
      this.half = half;
      this.damageLine.set(withHalfBonus(this.damageLine.text, half));
      this.damagePicker.halfBonus(half);
    }
    this.custom.sync();
    const damage = this.damageLine.value;
    for (const node of this.quickPicks) {
      const formula = node.dataset.faces ? this.quickFormula(node.dataset.faces) : node.dataset.formula;
      if (node.dataset.faces) node.textContent = formula;
      node.setAttribute("aria-pressed", String(damage === formula));
    }
    this.sender.ready(improvised && damage === null ? MISSING.damage : this.missing(), this.sending);
  }

  /** Returns what is still missing before sending, or null. */
  missing() {
    if (this.state.pick === IMPROVISED) {
      if (!this.state.what.trim()) return MISSING.what;
      if (!this.improvisedSkill()) return MISSING.skill;
      return null;
    }
    return this.picked()?.skill ? null : MISSING.pick;
  }
}
