/** The module's entry point: registers the settings at init and starts each part at ready. See docs/main.md. */
import { registerSettings, decorateSettingsConfig } from "./settings.js";
import { alertSlot, registerPanel } from "./panel/index.js";
import { registerActionFlyout } from "./flyouts/action/index.js";
import { registerCheckFlyout } from "./flyouts/check/index.js";
import { registerAssistGroups, registerOtherFlyout } from "./flyouts/other/index.js";
import { registerOpposedRoll } from "./flyouts/opposed/index.js";
import { registerBeingAttacked, setAlertHost } from "./flyouts/alert/index.js";
import { registerCombat } from "./combat/index.js";
import { registerKeeperRelay } from "./roll-requests/index.js";
import { registerSetupCheck } from "./setup/index.js";
import { warn } from "./utils.js";

// A part that throws is reported and skipped, so the parts after it still start.
function start(name, register) {
  try {
    return register();
  } catch (error) {
    warn(`${name} couldn't start.`, error);
    return false;
  }
}

Hooks.once("init", () => {
  registerSettings();
});

Hooks.on("renderSettingsConfig", decorateSettingsConfig);

Hooks.once("ready", () => {
  start("the Keeper relay", registerKeeperRelay);
  start("the players' assist groups", registerAssistGroups);
  const panel = start("the panel", registerPanel);
  start("the Action flyout", registerActionFlyout);
  start("the Check flyout", registerCheckFlyout);
  start("the Other flyout", registerOtherFlyout);
  start("the Opposed roll", registerOpposedRoll);
  start("combat", registerCombat);
  if (panel) start("the alert's place on the panel", () => setAlertHost(alertSlot));
  start("the being-attacked alert", registerBeingAttacked);
  start("the setup check", registerSetupCheck);
});
