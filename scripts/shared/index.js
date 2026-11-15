/**
 * Shared controls: the public surface of scripts/shared/, the controls and helpers more than one menu uses (the
 * menus' DOM helpers and Send flow, the status line, the value line, the compact dice picker; the Blind toggle comes
 * with howRows). Other parts import from here only, never from the files beside it. Its one setting is in
 * settings.js, which the module's settings.js imports as it does every part's.
 */
export {
  CHECK_TABS, DIFFICULTY_LABELS, button, diceChoices, diceText, filterRows, howRows, levels, line, requestLabel, runSend,
  segmented, sendSection, showResult, textInput
} from "./menu.js";
export { statusLine } from "./status-line.js";
export { captioned, tidyDice, valueBox, valueLine } from "./value-line.js";
export { NO_DICE, customDice, dicePicker, hideWhenSimplified, withHalfBonus } from "./dice-picker.js";
