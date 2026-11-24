/** A right click on a character anywhere in Rollbox targets that character's token. See docs/shared.md. */
import { sameActor, warn } from "../utils.js";

/**
 * Returns the token a character stands for: its own if unlinked, else a selected one, else its first on the scene.
 * @param {Actor} actor
 * @returns {Token|null}
 */
export function tokenFor(actor) {
  if (!actor) return null;
  try {
    if (actor.isToken && actor.token?.object) return actor.token.object;
    const selected = Array.from(globalThis.canvas?.tokens?.controlled ?? [])
      .find((token) => sameActor(token?.actor, actor));
    return selected ?? Array.from(actor.getActiveTokens?.() ?? [])[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Makes this token the user's only Foundry target, as the Target tool does (fires `targetToken`).
 * @param {Token|null} token
 * @returns {boolean} true when targeted; false (one warning on a throw) otherwise
 */
export function targetOnly(token) {
  if (typeof token?.setTarget !== "function") return false;
  try {
    token.setTarget(true, { releaseOthers: true });
    return true;
  } catch (error) {
    warn("couldn't target that token.", error);
    return false;
  }
}

/**
 * Makes a right click on `node` target the character's token; the click goes no further.
 * @param {HTMLElement} node what shows the character
 * @param {Actor|(() => (Token|null))} who the character, or a function giving its token
 * @returns {HTMLElement} the node
 */
export function rightClickTargets(node, who) {
  node?.addEventListener?.("contextmenu", (event) => {
    event.preventDefault();
    // Stops here so a card holding the character doesn't also act on the click.
    event.stopPropagation();
    targetOnly(typeof who === "function" ? who() : tokenFor(who));
  });
  return node;
}
