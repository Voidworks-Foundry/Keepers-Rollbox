/**
 * Status line: the line just above a menu's buttons. It shows only when something is missing, in red ("Type
 * what the improvised weapon is"), while the send buttons are greyed out; otherwise it is hidden (Void,
 * 2026-11-14: no summary of what will be sent). The Opposed view also shows its tie line here, not in red.
 */
import { element } from "../utils.js";

/**
 * @param {string} [className] the menu's own class, added to "rollbox-status".
 * @returns {{element: HTMLElement, missing: (text: string) => void, note: (text: string) => void,
 *   clear: () => void}} `missing` shows red text; `note` plain text; `clear` hides the line.
 */
export function statusLine(className = "") {
  const node = element("p", `rollbox-status ${className}`.trim());
  node.setAttribute("aria-live", "polite");
  const show = (text, missing) => {
    node.textContent = text;
    node.classList.toggle("rollbox-status-missing", missing);
    node.hidden = !text;
  };
  show("", false);
  return {
    element: node,
    missing: (text) => show(text, true),
    note: (text) => show(text, false),
    clear: () => show("", false)
  };
}
