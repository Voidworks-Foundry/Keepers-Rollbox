import { element } from "../utils.js";

/**
 * Returns a status line, hidden while empty; `missing` shows red text, `note` plain text.
 * @param {string} [className] the flyout's own class, added to "rollbox-status"
 * @returns {{element: HTMLElement, missing: (text: string) => void, note: (text: string) => void,
 *   clear: () => void}}
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
