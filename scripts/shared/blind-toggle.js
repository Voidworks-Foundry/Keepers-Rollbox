/** The Blind toggle beside a flyout's Difficulty and Dice rows. See docs/shared.md. */
import { element } from "../utils.js";

/**
 * Returns a Blind toggle button.
 * @param {{onChange?: (on: boolean) => void}} [options]
 * @returns {{element: HTMLButtonElement, on: boolean, disabled: boolean}} setting `on` or `disabled` doesn't call
 *   onChange
 */
export function blindToggle({ onChange = () => {} } = {}) {
  const node = element("button", "rollbox-btn rollbox-blind", "Blind");
  node.type = "button";
  node.setAttribute("aria-pressed", "false");
  let on = false;
  node.addEventListener("click", () => {
    if (node.disabled) return;
    on = !on;
    node.setAttribute("aria-pressed", String(on));
    onChange(on);
  });
  return {
    element: node,
    get on() {
      return on;
    },
    set on(value) {
      on = value === true;
      node.setAttribute("aria-pressed", String(on));
    },
    get disabled() {
      return node.disabled;
    },
    set disabled(value) {
      node.disabled = value === true;
    }
  };
}

/**
 * Lays the rows out in a column with the toggle beside them, as tall as all of them.
 * @param {HTMLElement[]} rows
 * @param {{element: HTMLElement}} toggle
 * @returns {HTMLElement}
 */
export function withBlind(rows, toggle) {
  const root = element("div", "rollbox-how");
  const column = element("div", "rollbox-how-rows");
  column.append(...rows);
  root.append(column, toggle.element);
  return root;
}
