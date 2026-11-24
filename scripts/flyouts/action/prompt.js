import { element } from "../../utils.js";
import { button } from "../flyout.js";

/**
 * Returns a prompt box with confirm and Cancel, and a skill picker when `skills` is given.
 * @param {{lines: (string|Node)[], confirm: string, skills?: object[], onConfirm: Function, onCancel: Function}} prompt
 * @returns {HTMLElement}
 */
export function promptBox({ lines, confirm, skills = null, onConfirm, onCancel }) {
  const box = element("div", "rollbox-section rollbox-action-prompt");
  box.setAttribute("role", "alertdialog");
  for (const part of lines) {
    const row = element("div", "rollbox-action-prompt-line");
    row.append(part);
    box.append(row);
  }
  let pick = null;
  if (skills?.length) {
    pick = document.createElement("select");
    pick.className = "rollbox-action-prompt-skill";
    pick.setAttribute("aria-label", "Which skill");
    for (const skill of skills) pick.append(new Option(skill.name, skill.id));
    const row = element("label", "rollbox-line");
    row.append(element("span", "rollbox-line-label", "Skill"), pick);
    box.append(row);
  }
  const row = element("div", "rollbox-actions");
  const yes = button("rollbox-btn rollbox-primary rollbox-action-prompt-yes", confirm, () => onConfirm(pick?.value ?? null));
  const no = button("rollbox-btn rollbox-action-prompt-no", "Cancel", () => onCancel());
  no.dataset.keep = "";
  row.append(yes, no);
  box.append(row);
  return box;
}

/**
 * Returns the question adding these items to the sheet, the names in bold.
 * @param {string[]} names
 * @param {Actor} actor
 * @returns {DocumentFragment}
 */
export function addLine(names, actor) {
  const line = document.createDocumentFragment();
  line.append("Add ");
  names.forEach((name, i) => {
    if (i) line.append(" and ");
    line.append(element("b", "", name));
  });
  line.append(` to ${actor?.name ? `${actor.name}'s` : "the"} sheet?`);
  return line;
}

/**
 * Returns what a player reads when their sheet lacks an item.
 * @param {string} name
 * @returns {string}
 */
export function askKeeperText(name) {
  return `Your sheet has no ${name}. Ask your Keeper to add it.`;
}
