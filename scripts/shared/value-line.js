/** The editable value line a flyout's presets, pickers and typing share. See docs/shared.md. */
import { element } from "../utils.js";

/**
 * Tidies typed dice the way every flyout writes them: no spaces, upper case, "1/2DB" written "½DB".
 * @param {string} text
 * @returns {string}
 */
export function tidyDice(text) {
  return String(text ?? "").replace(/\s+/g, "").toUpperCase().replace(/1\/2DB/g, "½DB");
}

/**
 * Returns an editable value line that checks its text with the flyout's rule.
 * @param {object} options
 * @param {string} options.label read out
 * @param {string} [options.value] the starting text
 * @param {string} [options.empty] what an empty line stands for, and becomes on confirm
 * @param {(text: string) => string|null} [options.check] the tidied value, or null to refuse
 * @param {() => void} [options.onChange] after typing or confirming, not after set()
 * @returns {{element: HTMLInputElement, readonly text: string, readonly value: string|null,
 *   set: (text: string) => void}} `value` is null while the rule refuses the text
 */
export function valueLine({ label, value = "", empty = "0", check = (text) => text, onChange = () => {} } = {}) {
  const input = element("input", "rollbox-value");
  input.type = "text";
  input.spellcheck = false;
  input.autocomplete = "off";
  input.setAttribute("aria-label", label);

  const read = () => {
    const text = input.value.trim();
    return check(text || empty);
  };

  // `size` is the fallback for CSS field-sizing.
  const mark = () => {
    const bad = read() === null;
    input.classList.toggle("rollbox-value-invalid", bad);
    input.setAttribute("aria-invalid", String(bad));
    input.size = Math.max(1, input.value.length);
  };

  const confirm = () => {
    const checked = read();
    const shown = input.value.trim() ? (checked ?? input.value) : empty;
    if (input.value !== shown) input.value = shown;
    mark();
    onChange();
  };

  input.addEventListener("input", () => {
    mark();
    onChange();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    confirm();
    input.blur();
  });
  input.addEventListener("blur", confirm);

  input.value = value;
  mark();
  return {
    element: input,
    get text() {
      return input.value;
    },
    get value() {
      return read();
    },
    set(text) {
      input.value = String(text ?? "");
      mark();
    }
  };
}

/**
 * Puts a small caption under a value line.
 * @param {{element: HTMLElement}} line
 * @param {string} caption
 * @returns {HTMLElement}
 */
export function captioned(line, caption) {
  const part = element("div", "rollbox-value-part");
  part.append(line.element, element("span", "rollbox-value-caption", caption));
  return part;
}

/**
 * Puts value lines (or captioned parts) side by side in the shaded box, with "/" between them.
 * @param {HTMLElement[]} parts
 * @returns {HTMLElement}
 */
export function valueBox(parts) {
  const box = element("div", "rollbox-value-box");
  parts.forEach((part, i) => {
    if (i) box.append(element("span", "rollbox-value-sep", "/"));
    box.append(part);
  });
  return box;
}
