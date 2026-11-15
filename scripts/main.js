/**
 * keepers-rollbox: entry point.
 * Wiring only: each part of the module lives in its own folder. Settings register during init; the
 * Keeper's panel and its menus start at ready, because they need the users, the canvas and the players list.
 */
import { registerSettings, decorateSettingsConfig } from "./settings.js";
import { registerMiniSheet } from "./mini-sheet/index.js";
import { registerCheckMenu } from "./check-menu/index.js";
import { registerSanityMenu } from "./sanity-menu/index.js";
import { registerOtherMenu } from "./other-menu/index.js";
import { registerOpposedRoll } from "./opposed-roll/index.js";
import { registerAssist } from "./assist/index.js";

Hooks.once("init", () => {
  registerSettings();
});

Hooks.on("renderSettingsConfig", decorateSettingsConfig);

Hooks.once("ready", () => {
  registerMiniSheet();
  registerCheckMenu();
  registerSanityMenu();
  registerOtherMenu();
  registerOpposedRoll();
  registerAssist();
});
