/**
 * Card buttons: after Rollbox asks CoC7 for a card on the Keeper's screen (an opposed card, an NPC's
 * Sanity card), this clicks the card's first Keeper button so the Keeper doesn't have to: Start rolls on
 * the opposed card, the Sanity roll on an NPC's Sanity card. CoC7 does the rolling when its own button is
 * clicked. If the card or the button doesn't show up, the Keeper is told to click it.
 *
 * Internal: relies on CoC7's card flags (`flags.CoC7.load.as`, `.actorUuids`, `.actorUuid`) and button
 * names (`data-action`). Listed in the build guide's Internal API registry.
 */
import { COC7_ID, tellKeeper } from "../utils.js";

/** How long to wait for CoC7 to post the card before telling the Keeper. */
const WATCH_TIMEOUT_MS = 15000;
/**
 * CoC7 attaches the card's click listeners in its own async `renderChatMessageHTML` handler, after
 * awaiting the actors (`hooks/render-chat-message-html.js`), so a click in the same tick would do nothing.
 * Wait this long before the first try, then try again at the same pace.
 */
export const CLICK_DELAY_MS = 250;
/** Tries before giving up on finding the button. */
export const CLICK_TRIES = 8;

const RENDER_HOOK = "renderChatMessageHTML";

/** The actor uuids a CoC7 card is about. CoC7 stores them with `/` or `.`; compare with dots. */
function cardActorUuids(load) {
  const list = Array.isArray(load?.actorUuids) ? load.actorUuids : [load?.actorUuid];
  return list.filter(Boolean).map((uuid) => String(uuid).replace(/\//g, "."));
}

/** True when the message is the CoC7 card of this kind, for all these actors, posted by this user. */
function isWantedCard(message, as, actorUuids) {
  const load = message?.flags?.[COC7_ID]?.load;
  if (load?.as !== as || message?.isAuthor === false) return false;
  const onCard = cardActorUuids(load);
  return actorUuids.every((uuid) => onCard.includes(uuid));
}

/** Wait, then click the button when it's there; tell the Keeper when it never is. */
function clickWhenReady(html, action, fallback, triesLeft = CLICK_TRIES) {
  setTimeout(() => {
    const button = html?.querySelector?.(`[data-action="${action}"]`);
    if (button && !button.disabled) {
      button.click();
      return;
    }
    if (triesLeft > 1) clickWhenReady(html, action, fallback, triesLeft - 1);
    else tellKeeper(fallback);
  }, CLICK_DELAY_MS);
}

/**
 * Watch for the next CoC7 card of this kind about these actors, and click one of its buttons once.
 * Call it just before asking CoC7 for the card. The watch ends after one card or `WATCH_TIMEOUT_MS`.
 * @param {{as: string, actorUuids: string[], action: string, fallback: string}} watch
 *   `as`: CoC7's card class name (`flags.CoC7.load.as`); `action`: the button's `data-action`;
 *   `fallback`: what to tell the Keeper if it can't be clicked.
 * @returns {() => void} stops the watch quietly, for when CoC7 fails to make the card, so the Keeper isn't
 *   told to click a card that never comes. Without Foundry's hooks the Keeper is told at once.
 */
export function clickCardButton({ as, actorUuids, action, fallback }) {
  if (typeof Hooks?.on !== "function" || typeof Hooks?.off !== "function") {
    tellKeeper(fallback);
    return () => {};
  }
  let hookId = null;
  const stop = () => {
    Hooks.off(RENDER_HOOK, hookId);
    clearTimeout(timer);
  };
  const timer = setTimeout(() => {
    stop();
    tellKeeper(fallback);
  }, WATCH_TIMEOUT_MS);
  hookId = Hooks.on(RENDER_HOOK, (message, html) => {
    if (!isWantedCard(message, as, actorUuids)) return;
    stop();
    clickWhenReady(html, action, fallback);
  });
  return stop;
}
