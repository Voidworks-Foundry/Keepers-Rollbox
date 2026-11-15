/**
 * Blind toggle: a tall button to the right of a menu's Difficulty and Dice rows, spanning both, with "Blind"
 * written sideways. Click it on (highlighted), click it off; the menu reads `on` into its request's blind
 * option. Used by shared/menu.js's howRows (the Check and Item menus).
 */
import { element } from "../utils.js";

/**
 * The toggle.
 * @param {{onChange?: (on: boolean) => void}} [options] after the Keeper clicks it.
 * @returns {{element: HTMLButtonElement, on: boolean, disabled: boolean}} `on` and `disabled` can be set by the
 *   menu (a combined check turns Blind off); setting them doesn't call onChange.
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
 * The rows (Difficulty, Dice) in a column with the toggle beside them, as tall as both.
 * @param {HTMLElement[]} rows
 * @param {{element: HTMLElement}} toggle
 */
export function withBlind(rows, toggle) {
  const root = element("div", "rollbox-how");
  const column = element("div", "rollbox-how-rows");
  column.append(...rows);
  root.append(column, toggle.element);
  return root;
}
