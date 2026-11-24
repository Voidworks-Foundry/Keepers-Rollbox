/** A spell's full text beside the Action flyout and beside CoC7's casting window. See docs/action-flyout.md. */
import { PERSONAL, declareSettings, element, option, warn } from "../../utils.js";
import { followTheme } from "../../panel/index.js";

// The choice keys are permanent once released.
const SPELL_TEXT_TAB = Object.freeze({ hover: "On hover", click: "On click", off: "Off" });
/** Declares this part's personal settings, registered by settings.js. */
export const SETTINGS = declareSettings([
  { key: "rollboxSpellTextTab", scope: "user", type: String, choices: SPELL_TEXT_TAB, default: "hover",
    section: "panel", label: "Spell text in the Spell tab",
    hint: "Show a spell's full description beside the Action flyout when you hover over it, when you click it, or never.",
    note: PERSONAL },
  { key: "rollboxSpellTextCasting", scope: "user", type: Boolean, default: true, section: "panel",
    label: "Show a spell's text while casting",
    hint: "While CoC7's casting window is open for a spell cast from Rollbox, the spell's description and the target's "
      + "distance show beside it.", note: PERSONAL }
]);

// CoC7 8.15: CoC7SpellVariablesDialog.DEFAULT_OPTIONS.classes.
const CASTING_WINDOW_CLASS = "spell-variables";
// How long after Rollbox's cast CoC7's window may open and still be taken as that spell's.
const CAST_WINDOW_MS = 15000;
const GAP = 8;

// Taken from the document's own window, so it is the page's in every context.
const Observer = () => document.defaultView?.MutationObserver ?? globalThis.MutationObserver;

/**
 * Returns how the Spell tab shows a spell's text.
 * @returns {"hover"|"click"|"off"}
 */
export function spellTextMode() {
  const mode = option("rollboxSpellTextTab");
  return Object.hasOwn(SPELL_TEXT_TAB, mode) ? mode : "hover";
}

/** Returns the description enriched as CoC7's sheet shows it, without secrets; plain text if enriching fails. */
async function spellBody(spell) {
  const body = element("div", "rollbox-spell-text-body");
  const raw = spell?.system?.description;
  const html = String((typeof raw === "object" ? raw?.value : raw) ?? "");
  if (!html.trim()) {
    body.append(element("p", "rollbox-hint", "No description on this spell."));
    return body;
  }
  try {
    const editor = globalThis.foundry?.applications?.ux?.TextEditor?.implementation;
    if (typeof editor?.enrichHTML !== "function") throw new Error("TextEditor.enrichHTML missing");
    body.innerHTML = await editor.enrichHTML(html, { secrets: false, relativeTo: spell });
  } catch (error) {
    warn("couldn't show the spell's description as CoC7 does; showing its plain text.", error);
    // An inert template: its HTML is parsed for the text only, nothing in it runs or loads.
    const parsed = document.createElement("template");
    parsed.innerHTML = html;
    body.append(element("p", "", parsed.content.textContent ?? ""));
  }
  return body;
}

async function textBox(spell, { title, foot } = {}) {
  const box = element("aside", "rollbox-spell-text");
  box.dataset.spell = spell?.id ?? "";
  box.setAttribute("role", "note");
  box.append(element("h4", "rollbox-spell-text-title", title ?? spell?.name ?? ""), await spellBody(spell));
  if (foot) box.append(element("div", "rollbox-spell-text-foot", foot));
  return box;
}

let shown = null;
// Each show gets a number, so a slow enrichment never puts back a box closed or replaced meanwhile.
let showCount = 0;

/**
 * Removes the Spell tab's text box, if any.
 * @returns {void}
 */
export function hideSpellText() {
  showCount += 1;
  shown?.box.remove();
  shown?.observer?.disconnect();
  shown = null;
}

/**
 * Returns the id of the spell whose text shows beside the flyout, or null.
 * @returns {string|null}
 */
export const spellTextShown = () => shown?.spellId ?? null;

/**
 * Shows a spell's text beside the Action flyout holding `from`; it goes when the flyout closes or redraws.
 * @param {Item} spell
 * @param {HTMLElement} from an element inside the flyout
 * @returns {Promise<boolean>} true when shown
 */
export async function showSpellText(spell, from) {
  const flyout = from?.closest?.(".rollbox-flyout");
  if (!spell || !flyout?.parentElement) return false;
  hideSpellText();
  const count = showCount;
  const box = await textBox(spell);
  if (count !== showCount || !from.isConnected || flyout.hidden) return false;
  box.classList.add("rollbox-spell-text-beside");
  flyout.after(box);
  // The box goes with the flyout: hidden, or redrawn so the row it came from is gone.
  const observer = new (Observer())(() => {
    if (flyout.hidden || !from.isConnected) hideSpellText();
  });
  observer.observe(flyout, { attributes: true, attributeFilter: ["hidden"], childList: true, subtree: true });
  shown = { box, observer, spellId: spell.id ?? null };
  return true;
}

// The cast Rollbox started last, for the casting window that opens next.
let casting = null;
let castHost = null;
// Kept so a token's move can work the distance line out again.
let castFoot = null;

function footText(distance) {
  try {
    return typeof distance === "function" ? distance() : distance;
  } catch {
    return null;
  }
}

/**
 * Redraws the casting box's distance line when a token moves (updateToken).
 * @param {TokenDocument} _document
 * @param {object} changes
 * @returns {boolean} true when the line was redrawn
 */
export function castingMoved(_document, changes) {
  if (!castFoot || !changes || !("x" in changes || "y" in changes)) return false;
  const box = castHost?.querySelector?.(".rollbox-spell-text");
  if (!box) return false;
  const text = footText(castFoot);
  let foot = box.querySelector(".rollbox-spell-text-foot");
  if (!text) {
    foot?.remove();
    return true;
  }
  if (!foot) {
    foot = element("div", "rollbox-spell-text-foot");
    box.append(foot);
  }
  foot.textContent = text;
  return true;
}

/**
 * Notes a cast Rollbox is about to start, so the casting window CoC7 opens for it gets the spell's text.
 * @param {Item} spell
 * @param {{distance?: string|(() => string|null)|null}} [options] a function is worked out again when a token moves
 * @returns {void}
 */
export function noteCasting(spell, { distance = null } = {}) {
  casting = spell ? { spell, distance, at: Date.now() } : null;
}

function castingHost() {
  if (castHost?.isConnected) return castHost;
  castHost = element("div", "rollbox-panel rollbox-spell-cast-host");
  followTheme(castHost);
  (document.getElementById("interface") ?? document.body).append(castHost);
  return castHost;
}

function placeBeside(host, windowElement) {
  const rect = windowElement.getBoundingClientRect();
  const width = host.offsetWidth || 320;
  const right = rect.right + GAP + width <= (document.defaultView?.innerWidth ?? Infinity);
  host.style.left = `${Math.max(0, right ? rect.right + GAP : rect.left - GAP - width)}px`;
  host.style.top = `${Math.max(0, rect.top)}px`;
}

/**
 * Shows the spell's text beside CoC7's casting window opened for Rollbox's cast (renderApplicationV2).
 * @param {foundry.applications.api.ApplicationV2} app
 * @returns {Promise<void>}
 */
export async function onCastingWindow(app) {
  const node = app?.element;
  if (!node?.classList?.contains(CASTING_WINDOW_CLASS)) return;
  const cast = casting;
  if (!cast || Date.now() - cast.at > CAST_WINDOW_MS || option("rollboxSpellTextCasting") === false) return;
  casting = null;
  const host = castingHost();
  const box = await textBox(cast.spell, { title: `${cast.spell.name ?? ""} · rules`, foot: footText(cast.distance) });
  if (!node.isConnected) return;
  host.replaceChildren(box);
  castFoot = cast.distance;
  host.dataset.app = String(app.id ?? "");
  placeBeside(host, node);
  // The box closes with the window and follows it when dragged.
  const observer = new (Observer())(() => {
    if (!node.isConnected) {
      observer.disconnect();
      if (host.dataset.app === String(app.id ?? "")) {
        host.replaceChildren();
        castFoot = null;
      }
      return;
    }
    placeBeside(host, node);
  });
  observer.observe(node.parentElement ?? document.body, { childList: true });
  observer.observe(node, { attributes: true, attributeFilter: ["style"] });
}

/**
 * Removes the casting text when CoC7's casting window closes (closeApplicationV2).
 * @param {foundry.applications.api.ApplicationV2} app
 * @returns {void}
 */
export function onCastingWindowClosed(app) {
  if (!castHost || castHost.dataset.app !== String(app?.id ?? "")) return;
  castHost.replaceChildren();
  delete castHost.dataset.app;
  castFoot = null;
}
