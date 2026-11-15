/**
 * Editable value line: a large line of plain text the Keeper clicks and types into, with no box, border or
 * outline, only a cursor. It holds a value such as a Sanity loss ("1D6"), improvised damage ("1D6+DB") or
 * Assist's number to beat; the presets, quick-picks and the compact dice picker write into it, and typing
 * into it is read back by them. Enter or clicking away confirms: empty becomes 0, and a value the menu's rule
 * accepts is written back tidied ("1d6" → "1D6"). Text the rule refuses turns red, and `value` is null, so
 * the menu blocks Send. It builds text only; CoC7 and Foundry roll it.
 */
import { element } from "../utils.js";

/** Typed dice tidied the way every menu writes them: no spaces, upper case, "1/2DB" written "½DB". */
export function tidyDice(text) {
  return String(text ?? "").replace(/\s+/g, "").toUpperCase().replace(/1\/2DB/g, "½DB");
}

/**
 * A value line.
 * @param {object} options
 * @param {string} options.label what it is, read out (e.g. "SAN lost on a success").
 * @param {string} [options.value] the starting text.
 * @param {string} [options.empty] what an empty line stands for, and becomes on confirm ("0").
 * @param {(text: string) => string|null} [options.check] the menu's rule: the tidied value, or null to refuse.
 * @param {() => void} [options.onChange] after the Keeper types or confirms (not after set()).
 * @returns {{element: HTMLInputElement, readonly text: string, readonly value: string|null,
 *   set: (text: string) => void}} `text` is what the line shows; `value` is the checked value (an empty
 *   line counts as `empty`), or null while the rule refuses it.
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

  /** Red while the rule refuses the text; the width follows the text (CSS field-sizing does it too). */
  const mark = () => {
    const bad = read() === null;
    input.classList.toggle("rollbox-value-invalid", bad);
    input.setAttribute("aria-invalid", String(bad));
    input.size = Math.max(1, input.value.length);
  };

  /** Enter or clicking away: empty becomes `empty`; an accepted value is written back tidied. */
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
    /** Show this text (a preset or the picker). Doesn't call onChange: the caller redraws. */
    set(text) {
      input.value = String(text ?? "");
      mark();
    }
  };
}

/**
 * One value line with a small caption under it ("success"), for a row such as the Sanity loss "0 / 1D6".
 * @param {{element: HTMLElement}} line
 * @param {string} caption
 */
export function captioned(line, caption) {
  const part = element("div", "rollbox-value-part");
  part.append(line.element, element("span", "rollbox-value-caption", caption));
  return part;
}

/**
 * The large line's box: the lines (or captioned parts) side by side, centred, with "/" between them.
 * @param {HTMLElement[]} parts
 */
export function valueBox(parts) {
  const box = element("div", "rollbox-value-box");
  parts.forEach((part, i) => {
    if (i) box.append(element("span", "rollbox-value-sep", "/"));
    box.append(part);
  });
  return box;
}
