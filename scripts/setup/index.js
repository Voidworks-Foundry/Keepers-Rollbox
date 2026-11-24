/** The setup check's registration, the login check, checks of what is added, and Check now. See docs/setup.md. */
import { KEEPER, MODULE_ID, declareSettings, isActiveKeeper, isKeeper, option, warn } from "../utils.js";
import { isReloadable } from "../shared/index.js";
import { actorKind } from "../roll-requests/index.js";
import { scanSetup } from "./scan.js";
import { openWindow, showNotice } from "./window.js";

export { scanSetup } from "./scan.js";
export { closeNotice, closeWindow, showNotice } from "./window.js";

/** The Setup check switch, declared for settings.js to register. */
export const SETTINGS = declareSettings([
  { key: "rollboxSetupCheck", scope: "world", type: Boolean, default: true, section: "setup",
    label: "Setup check at login",
    hint: "Looks over weapons and sheets a few seconds after you log in. Answers Rollbox is sure of are saved at once "
      + "(how a firearm reloads, CoC7's Maneuver back on a weapon a fight back left off); questions wait for your OK.",
    note: KEEPER }
]);

/** The Check now settings menu's key and labels. */
export const CHECK_NOW = Object.freeze({ key: "rollboxSetupCheckNow", name: "Check setup now", label: "Check now",
  icon: "fa-solid fa-list-check", note: KEEPER });

// Waits out Foundry's own startup work.
const SETUP_DELAY_MS = 4000;
// Lets a batch of additions make one notice.
const ADDED_DELAY_MS = 1500;

/**
 * Scans every sheet and opens the setup window, whatever the setting; Keeper only.
 * @returns {Promise<HTMLElement|null>} the window
 */
export async function checkNow() {
  if (!isKeeper()) return null;
  const { issues, ms } = await scanSetup();
  return openWindow(issues, { ms });
}

/**
 * Scans every sheet and shows the notice when anything needs setting up; active Keeper only, with the setting on.
 * @returns {Promise<{issues: object[], saved: number, ms: number}|null>}
 */
export async function checkAtLogin() {
  if (!isActiveKeeper() || option("rollboxSetupCheck") === false) return null;
  const scan = await scanSetup();
  showNotice(scan.issues);
  return scan;
}

const added = { actors: new Set(), weapons: new Set() };
let addedTimer = null;

function checkAddedSoon({ actor = null, weapon = null }) {
  if (!isActiveKeeper() || option("rollboxSetupCheck") === false) return;
  if (actor) added.actors.add(actor);
  if (weapon) added.weapons.add(weapon);
  clearTimeout(addedTimer);
  addedTimer = setTimeout(async () => {
    const actors = new Set(added.actors);
    const weapons = new Set(added.weapons);
    added.actors.clear();
    added.weapons.clear();
    try {
      const sheets = new Set([...actors, ...[...weapons].map((item) => item.parent).filter(Boolean)]);
      const { issues } = await scanSetup([...sheets]);
      const shown = issues.filter((issue) => actors.has(issue.actor)
        || [...weapons].some((item) => item.id === issue.weapon?.id && item.parent === issue.actor));
      if (shown.length) showNotice(shown);
    } catch (error) {
      warn("the setup check of an added weapon or sheet failed.", error);
    }
  }, ADDED_DELAY_MS);
}

/**
 * Queues a check of a firearm just added to a sheet: the createItem hook.
 * @param {Item} item
 * @returns {void}
 */
export function itemAdded(item) {
  if (item?.parent && isReloadable(item)) checkAddedSoon({ weapon: item });
}

function actorAdded(actor) {
  if (actorKind(actor)) checkAddedSoon({ actor });
}

/**
 * Hooks the checks of what is added and schedules the login check; at ready, Keeper clients only.
 * @returns {boolean} true when registered
 */
export function registerSetupCheck() {
  if (!isKeeper() || typeof Hooks?.on !== "function") return false;
  Hooks.on("createItem", itemAdded);
  Hooks.on("createActor", actorAdded);
  setTimeout(() => {
    checkAtLogin().catch((error) => warn("the setup check failed.", error));
  }, SETUP_DELAY_MS);
  return true;
}

// Foundry v14: a settings menu's type must be an ApplicationV2; this one's render runs the check instead.
function checkNowMenuType() {
  const Base = globalThis.foundry?.applications?.api?.ApplicationV2;
  if (typeof Base !== "function") return null;
  return class SetupCheckNow extends Base {
    async render() {
      await checkNow();
      return this;
    }
  };
}

/**
 * Registers the Keeper-only Check now settings menu; at init.
 * @returns {boolean} true when registered
 */
export function registerCheckNowMenu() {
  const type = checkNowMenuType();
  if (!type || typeof game.settings?.registerMenu !== "function") return false;
  try {
    game.settings.registerMenu(MODULE_ID, CHECK_NOW.key, { name: CHECK_NOW.name, label: CHECK_NOW.label,
      icon: CHECK_NOW.icon, type, restricted: true });
    return true;
  } catch (error) {
    warn("couldn't add the Check now button.", error);
    return false;
  }
}
