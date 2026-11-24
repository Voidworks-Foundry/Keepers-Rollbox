/** The button builders the flyouts and shared controls use. See docs/shared.md. */
import { element, glyph } from "../utils.js";

/**
 * Returns a button that never submits a form.
 * @param {string} className
 * @param {string} text
 * @param {(event: MouseEvent) => void} onClick
 * @returns {HTMLButtonElement}
 */
export function button(className, text, onClick) {
  const node = element("button", className, text);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

/**
 * Returns a button showing a Font Awesome glyph, with visible words (`text`) or a screen-reader `label`.
 * @param {string} className
 * @param {string} icon the glyph's Font Awesome class, e.g. "fa-crosshairs"
 * @param {(event: MouseEvent) => void} onClick
 * @param {{text?: string, textClass?: string, label?: string, tooltip?: string}} [words]
 * @returns {HTMLButtonElement}
 */
export function glyphButton(className, icon, onClick, { text, textClass = "", label, tooltip } = {}) {
  const node = button(className, "", onClick);
  node.append(glyph(icon));
  if (text) node.append(element("span", textClass, text));
  if (label) node.setAttribute("aria-label", label);
  if (tooltip) node.dataset.tooltip = tooltip;
  return node;
}
