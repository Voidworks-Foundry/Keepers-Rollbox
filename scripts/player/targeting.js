/** Picking a token by Foundry's own targeting, for players who can't select others' tokens. See docs/player.md. */
import { element, warn } from "../utils.js";

// Foundry v14 scene control and tool names.
const TARGET = Object.freeze({ control: "tokens", tool: "target" });
const SELECT = Object.freeze({ control: "tokens", tool: "select" });

// A new pick ends the one waiting, so two prompts never show at once.
let pending = null;

/**
 * Cancels the pick waiting now, as its Cancel button does.
 * @returns {boolean} true when a pick was waiting
 */
export function cancelPick() {
  if (!pending) return false;
  pending.finish(null, true);
  return true;
}

/**
 * Returns whether a pick is waiting now.
 * @returns {boolean}
 */
export const picking = () => pending !== null;

/**
 * Returns the user's first Foundry target, or null.
 * @returns {Token|null}
 */
export function targetedToken() {
  try {
    return Array.from(globalThis.game?.user?.targets ?? [])[0] ?? null;
  } catch {
    return null;
  }
}

function targetIds() {
  try {
    return Array.from(globalThis.game?.user?.targets ?? [], (token) => token?.id).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Returns the user's current target, or asks them to target a token with Foundry's Target tool.
 * @param {{prompt?: string, parent?: HTMLElement, useCurrent?: boolean, restore?: boolean}} [options]
 *   `useCurrent` false always asks; `restore` puts the earlier targets back once picked
 * @returns {Promise<Token|null>} null on Cancel, a closed scene, another pick, or no targeting to use
 */
export async function pickTarget({ prompt = "Select your target", parent, useCurrent = true, restore = false } = {}) {
  const current = useCurrent ? targetedToken() : null;
  if (current) return current;
  pending?.finish(null);
  const controls = globalThis.ui?.controls;
  if (!globalThis.canvas?.tokens || !controls) {
    warn("Foundry's targeting isn't available, so Rollbox can't ask for a target.");
    return null;
  }
  const before = { control: controls.control?.name ?? null, tool: controls.tool?.name ?? null };
  const targetsBefore = targetIds();
  return new Promise((resolve) => {
    let done = false;
    const bar = promptBar(prompt, () => finish(null, true));
    const onTarget = (user, token, targeted) => {
      if (targeted && isMe(user)) finish(token);
    };
    const onTearDown = () => finish(null);
    // One key press, one thing closed: Foundry doesn't also act on this Escape.
    const onKey = (event) => {
      if (event?.key !== "Escape" || event.repeat) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      finish(null, true);
    };
    const targetHook = Hooks.on("targetToken", onTarget);
    const tearDownHook = Hooks.on("canvasTearDown", onTearDown);
    globalThis.addEventListener?.("keydown", onKey, true);

    function finish(token, cancelled = false) {
      if (done) return;
      done = true;
      if (pending?.finish === finish) pending = null;
      Hooks.off("targetToken", targetHook);
      Hooks.off("canvasTearDown", tearDownHook);
      globalThis.removeEventListener?.("keydown", onKey, true);
      bar.remove();
      if (cancelled || (restore && token)) restoreTargets(targetsBefore);
      activate(before.tool && before.tool !== TARGET.tool ? before : SELECT);
      resolve(token ?? null);
    }

    pending = { finish };
    (parent ?? globalThis.document?.getElementById("interface") ?? globalThis.document?.body)?.append(bar);
    activate(TARGET, () => finish(null));
  });
}

function isMe(user) {
  const me = globalThis.game?.user;
  return Boolean(user && me) && (user === me || (user.id !== undefined && user.id === me.id));
}

function promptBar(prompt, onCancel) {
  const bar = element("div", "rollbox-targeting");
  bar.setAttribute("role", "status");
  bar.setAttribute("aria-live", "polite");
  const cancel = element("button", "rollbox-targeting-cancel", "Cancel");
  cancel.type = "button";
  cancel.addEventListener("click", onCancel);
  bar.append(element("span", "rollbox-targeting-prompt", prompt), cancel);
  return bar;
}

function activate({ control, tool }, onFail) {
  const fail = (error) => {
    warn(`couldn't switch to the ${tool} tool.`, error);
    onFail?.();
  };
  try {
    Promise.resolve(globalThis.ui.controls.activate({ control, tool })).catch(fail);
  } catch (error) {
    fail(error);
  }
}

function restoreTargets(ids) {
  try {
    globalThis.canvas.tokens.setTargets(ids, { mode: "replace" });
  } catch (error) {
    warn("couldn't put the targets back.", error);
  }
}
