/**
 * The Other menu's Item section (the Item menu until 0.1.1), for one selected character. The Keeper picks one of the
 * character's weapons (one row per skill it uses) or names an improvised weapon with its skill and optional
 * damage, sets the difficulty, dice and Blind, and sends it through roll-requests/ as an ordinary skill check
 * labelled with the weapon, never CoC7's weapon link (which starts its attack card and ignores the options).
 * For weapon rolls with no token to target, such as shooting a lock. Layout and rules: DESIGN.md, "Other menu".
 */
import { NO_VALUE, element, warn } from "../utils.js";
import { findSkillRow, sameSkill, skills } from "../skill-values/index.js";
import { damageText, improvisedRequest, send, weaponRequest, weaponSkills } from "../roll-requests/index.js";
import {
  NO_DICE, button, customDice, dicePicker, hideWhenSimplified, howRows, levels, line, requestLabel, runSend, segmented,
  sendSection, showResult, tidyDice, valueBox, valueLine, withHalfBonus
} from "../shared/index.js";

const IMPROVISED = "improvised";
/** The improvised weapon's skill choices: Fighting (Brawl) by default, Throw, or any other skill. */
const IMPROVISED_SKILLS = Object.freeze([
  { id: "brawl", name: "Fighting (Brawl)", short: "Brawl", cocid: "i.skill.fighting-brawl" },
  { id: "throw", name: "Throw", short: "Throw", cocid: "i.skill.throw" },
  { id: "other", name: "Other…", short: "Other…" }
]);
/** A thrown object adds half the damage bonus (Keeper Rulebook, weapons table: thrown weapons add ½DB). */
const THROW = IMPROVISED_SKILLS.find((s) => s.id === "throw");
/** The damage quick-picks under the damage line: one die of each size plus the damage bonus. */
const QUICK_DAMAGE = Object.freeze([3, 4, 6, 8, 10]);
/** The status line, in red, while something required is missing (the buttons are greyed out until then). */
const MISSING = Object.freeze({
  pick: "Pick a weapon, or an improvised weapon.",
  what: "Type what the improvised weapon is.",
  skill: "Pick the skill it uses.",
  damage: "Damage is dice, e.g. 1D6, 1D6+2 or 1D6+DB."
});

/** Gives each menu's radio buttons their own group name. */
let menuCount = 0;

/**
 * The Item section, built from scratch for the selected character. One character only: with any other number the
 * Other menu greys the section out, and this draws nothing.
 * @param {HTMLElement} body the section's place, already empty
 * @param {Actor[]} actors the selected characters
 */
export function renderItem(body, actors = []) {
  if (actors.length !== 1 || !actors[0]) return;
  new ItemMenu(body, actors[0]).build();
}

// --- Small helpers -------------------------------------------------------------------------------

/** The character's weapons, A–Z. Foundry's Collection iterates its documents. */
function weaponsOf(actor) {
  try {
    return Array.from(actor.items ?? []).filter((item) => item?.type === "weapon")
      .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
  } catch {
    return [];
  }
}

// --- The menu ------------------------------------------------------------------------------------

class ItemMenu {
  /**
   * @param {HTMLElement} body
   * @param {Actor} actor
   */
  constructor(body, actor) {
    this.body = body;
    this.actor = actor;
    this.group = `rollbox-item-${++menuCount}`;
    this.skillRows = skills(actor);
    /**
     * One row per weapon and skill (roll-requests' weaponSkills: a knife that can be thrown gives a Fighting
     * (Brawl) row and a Throw row), each with that skill's row from skill-values (its base value when it isn't on
     * the sheet) and its own pick value.
     */
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
    this.half = false; // the damage bonus is halved (Throw)
  }

  build() {
    const what = element("div", "rollbox-section");
    what.append(this.listBlock(), this.improvisedBlock());
    this.body.append(what, this.damageBlock(), this.optionsBlock(), this.sendBlock());
    this.update();
  }

  // --- Weapons ---

  listBlock() {
    const list = element("div", "rollbox-list rollbox-item-list");
    list.setAttribute("role", "radiogroup");
    list.setAttribute("aria-label", "Weapon");
    if (!this.weapons.length) {
      list.append(element("div", "rollbox-hint rollbox-item-hint", `No weapons on ${this.actor.name ?? "this character"}'s sheet.`));
    }
    for (const { weapon, skill, row, pick } of this.weapons) {
      const node = this.row(pick, weapon.name ?? "?", skill ? (row?.name ?? skill.name) : "no skill set",
        skill ? levels(row) : "");
      node.querySelector("input").disabled = !skill;
      list.append(node);
    }
    list.append(this.row(IMPROVISED, "+ Improvised weapon"));
    return list;
  }

  /** One pickable row: the weapon's name, its skill and that skill's values. */
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
    if (values !== undefined) node.append(element("span", "rollbox-item-values", values));
    return node;
  }

  pick(value) {
    this.state.pick = value;
    this.update();
  }

  // --- Improvised weapon ---

  improvisedBlock() {
    this.improvised = element("div", "rollbox-item-improvised");

    const what = element("input", "rollbox-input rollbox-item-what");
    what.type = "text";
    what.placeholder = "What is it? e.g. Candlestick";
    what.setAttribute("aria-label", "What the improvised weapon is");
    what.addEventListener("input", () => { this.state.what = what.value; this.update(); });

    this.skillButtons = segmented({ choices: IMPROVISED_SKILLS.map((s) => [s.id, s.short]), get: () => this.state.skill,
      set: (value) => { this.state.skill = value; this.update(); } });
    const skill = line("Skill", this.skillButtons.element);

    // "Other…": any skill the character can roll, trained first, missing ones at base value.
    this.otherSelect = element("select", "rollbox-input rollbox-item-other");
    this.otherSelect.setAttribute("aria-label", "Other skill");
    const placeholder = element("option", "", "Pick a skill…");
    placeholder.value = "";
    this.otherSelect.append(placeholder, ...this.skillRows.map((row, i) => {
      const option = element("option", "", `${row.name} (${row.value ?? NO_VALUE})`);
      option.value = String(i);
      return option;
    }));
    this.otherSelect.addEventListener("change", () => { this.state.other = this.otherSelect.value; this.update(); });

    this.skillLine = element("div", "rollbox-line rollbox-item-chosen");

    this.improvised.append(what, skill, this.otherSelect, this.skillLine);
    return this.improvised;
  }

  /**
   * Damage, for an improvised weapon (optional): the damage line, the quick-picks under it, and the Custom
   * damage button with the compact picker. "0" (None) is no damage roll; anything else is checked by
   * roll-requests' own damage rule.
   */
  damageBlock() {
    this.damage = element("div", "rollbox-section");
    this.damageLine = valueLine({ label: "Damage", value: NO_DICE, onChange: () => this.update(),
      check: (text) => {
        const formula = tidyDice(text);
        return formula === NO_DICE ? NO_DICE : damageText(formula);
      } });
    this.damageLine.element.classList.add("rollbox-item-damage");

    // Quick-picks: a click fills the damage line, which the Keeper can still change.
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

  /** True when the improvised weapon is thrown, so it adds half the damage bonus. */
  thrown() {
    const skill = this.improvisedSkill();
    return Boolean(skill) && sameSkill(skill, THROW);
  }

  /** A quick-pick's formula: "1D6+DB", or "1D6+½DB" for a thrown object. */
  quickFormula(faces) {
    return `1D${faces}+${this.thrown() ? "½DB" : "DB"}`;
  }

  /** The improvised weapon's skill row (from skill-values), or null when "Other…" has none picked. */
  improvisedSkill() {
    const choice = IMPROVISED_SKILLS.find((s) => s.id === this.state.skill) ?? IMPROVISED_SKILLS[0];
    if (choice.id === "other") return this.state.other === "" ? null : this.skillRows[Number(this.state.other)] ?? null;
    return findSkillRow(this.skillRows, choice) ?? { name: choice.name, cocid: choice.cocid, value: null };
  }

  // --- Options ---

  /** How: Difficulty and Dice with the Blind toggle beside them. */
  optionsBlock() {
    const block = element("div", "rollbox-section");
    this.how = howRows(this.state, () => this.update());
    block.append(this.how.element);
    return block;
  }

  // --- Sending ---

  sendBlock() {
    const whisper = button("rollbox-btn rollbox-item-action rollbox-primary", requestLabel([this.actor]),
      () => this.send("whisper"));
    const chat = button("rollbox-btn rollbox-item-action", "Send to chat", () => this.send("chat"));
    this.sender = sendSection([whisper, chat]);
    return this.sender.element;
  }

  /** The request for the current pick and options, through roll-requests; null when it isn't complete. */
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

  /** The picked weapon row, or null. */
  picked() {
    return this.weapons.find(({ pick }) => pick === this.state.pick) ?? null;
  }

  send(mode) {
    const request = this.request();
    if (!request) return;
    runSend(this, () => send(request, [this.actor], { mode }),
      (result) => showResult(this.sender.result, result, { what: "Item check", mode }));
  }

  // --- Redraw of the parts that depend on the state ---

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
        element("span", "rollbox-item-values", levels(skill)));
    }
    // To or from Throw: a damage bonus on the line becomes half or whole, as the picker's toggle does.
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
    // Greyed out until everything required is there; the red line says what is missing.
    this.sender.ready(improvised && damage === null ? MISSING.damage : this.missing(), this.sending);
  }

  /** What still has to be picked or typed before it can be sent, or null. */
  missing() {
    if (this.state.pick === IMPROVISED) {
      if (!this.state.what.trim()) return MISSING.what;
      if (!this.improvisedSkill()) return MISSING.skill;
      return null;
    }
    return this.picked()?.skill ? null : MISSING.pick;
  }
}
