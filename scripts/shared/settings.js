/**
 * The shared controls' setting, as plain data for settings.js: "Simplified dice UI". It sits in the "Keeper's
 * Rollbox" section, after the panel's switch. On, the Custom buttons with their dice pickers and the preset
 * rows are gone, and the Keeper types into the value lines.
 */
import { PERSONAL } from "../utils.js";
import { setSimplifiedDice } from "./dice-picker.js";

export const DICE_SETTINGS = {
  rollboxSimplifiedDice: {
    name: "Simplified dice UI",
    hint: "Type dice into the Sanity loss and the improvised damage (e.g. 1D6+2, or 1D6+DB for damage) instead "
      + "of opening the dice picker. The preset buttons are hidden too.",
    scope: "user", type: Boolean, default: false, note: PERSONAL,
    // Read when a menu is drawn, and switched at once in any open menu when changed: no reload.
    requiresReload: false,
    onChange: (value) => setSimplifiedDice(value)
  }
};
