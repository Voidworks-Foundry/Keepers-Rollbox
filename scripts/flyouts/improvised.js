/** The improvised weapon's skill choices, shared by the Item and Attack tabs. See docs/flyouts.md. */
import { NO_VALUE, element } from "../utils.js";
import { findSkillRow } from "../skill-values/index.js";

/** The pick value of the improvised weapon row. */
export const IMPROVISED = "improvised";

/** Skill choices in order, Brawl first as the default; `name` and `cocid` go into the request. */
export const IMPROVISED_SKILLS = Object.freeze([
  Object.freeze({ id: "brawl", label: "Brawl", name: "Fighting (Brawl)", cocid: "i.skill.fighting-brawl" }),
  Object.freeze({ id: "throw", label: "Throw", name: "Throw", cocid: "i.skill.throw" }),
  Object.freeze({ id: "other", label: "Other…" })
]);

/**
 * Returns the skill a choice means for a character: its own row, a valueless row off the sheet, or the list's pick.
 * @param {string} choice an IMPROVISED_SKILLS id; an unknown one counts as Brawl
 * @param {string} other an index into `rows`, or "" for none picked
 * @param {object[]} rows
 * @returns {{name: string, cocid?: string|null, value?: number|null}|null} null when "Other…" has none picked
 */
export function improvisedSkill(choice, other, rows) {
  const picked = IMPROVISED_SKILLS.find((skill) => skill.id === choice) ?? IMPROVISED_SKILLS[0];
  if (picked.id === "other") return other === "" ? null : rows[Number(other)] ?? null;
  return findSkillRow(rows, picked) ?? { name: picked.name, cocid: picked.cocid, value: null };
}

/**
 * Builds the other-skill select, one option per row with its value; each option's value is the row's index.
 * @param {object[]} rows
 * @param {{className: string, value?: string, onChange: (value: string) => void}} options
 * @returns {HTMLSelectElement}
 */
export function otherSkillList(rows, { className, value = "", onChange }) {
  const select = element("select", `rollbox-input ${className}`);
  select.setAttribute("aria-label", "Other skill");
  const placeholder = element("option", "", "Pick a skill…");
  placeholder.value = "";
  select.append(placeholder, ...rows.map((row, i) => {
    const option = element("option", "", `${row.name} (${row.value ?? NO_VALUE})`);
    option.value = String(i);
    return option;
  }));
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return select;
}
