/** The shared controls' setting, Simplified dice UI, as plain data for the module's settings.js. See docs/shared.md. */
import { PERSONAL } from "../utils.js";
import { setSimplifiedDice } from "./dice-picker.js";

/** The Simplified dice UI setting's registration data. */
export const DICE_SETTINGS = {
  rollboxSimplifiedDice: {
    name: "Simplified dice UI",
    hint: "Type dice into the Sanity loss and the improvised damage (e.g. 1D6+2, or 1D6+DB for damage) instead "
      + "of opening the dice picker. The preset buttons are hidden too.",
    scope: "user", type: Boolean, default: false, note: PERSONAL,
    requiresReload: false,
    onChange: (value) => setSimplifiedDice(value)
  }
};
