/** Presses buttons on CoC7's cards the way a person's click would. See docs/roll-requests.md. */
import { COC7_ID, dotted, tellKeeper, warn } from "../utils.js";

const WATCH_TIMEOUT_MS = 15000;
/** The wait before each try at a card's button: CoC7 8.15 attaches its listeners in an async render handler. */
export const CLICK_DELAY_MS = 250;
/** How many times a button is looked for before giving up. */
export const CLICK_TRIES = 8;

const RENDER_HOOK = "renderChatMessageHTML";
const CHOICE_WAIT_MS = 15000;

function cardActorUuids(load) {
  const list = Array.isArray(load?.actorUuids) ? load.actorUuids : [load?.actorUuid];
  return list.filter(Boolean).map(dotted);
}

/**
 * Returns whether the message is CoC7's card of this kind, about all these actors, posted by this user.
 * @param {ChatMessage} message
 * @param {string} as CoC7's `flags.CoC7.load.as`
 * @param {string[]} actorUuids dotted
 * @returns {boolean}
 */
export function isWantedCard(message, as, actorUuids) {
  const load = message?.flags?.[COC7_ID]?.load;
  if (load?.as !== as || message?.isAuthor === false) return false;
  const onCard = cardActorUuids(load);
  return actorUuids.every((uuid) => onCard.includes(uuid));
}

/**
 * Presses the button once it is on the rendered card, retrying; tells the Keeper `fallback` when it never is.
 * @param {HTMLElement} html
 * @param {string} selector
 * @param {string} fallback
 * @param {number} [triesLeft]
 * @returns {void}
 */
export function pressWhenReady(html, selector, fallback, triesLeft = CLICK_TRIES) {
  setTimeout(() => {
    const button = html?.querySelector?.(selector);
    if (button && !button.disabled) {
      pressControl(button);
      return;
    }
    if (triesLeft > 1) pressWhenReady(html, selector, fallback, triesLeft - 1);
    else tellKeeper(fallback);
  }, CLICK_DELAY_MS);
}

/**
 * Watches for the next CoC7 card of this kind about these actors (call it before asking CoC7) and presses its button.
 * @param {{as: string, actorUuids: string[], action: string, fallback: string}} watch
 * @returns {() => void} stops the watch quietly (no card is coming)
 */
export function clickCardButton({ as, actorUuids, action, fallback }) {
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
    pressWhenReady(html, `[data-action="${action}"]`, fallback);
  });
  return stop;
}

/**
 * Presses one of CoC7's card controls the way a person's click (or a slider's change) reaches it.
 * @param {HTMLElement} node the button (or, with "change", the slider)
 * @param {"click"|"change"} [type]
 * @returns {boolean} false when there is nothing to press
 */
export function pressControl(node, type = "click") {
  const view = node?.ownerDocument?.defaultView;
  if (!view || typeof node.dispatchEvent !== "function") return false;
  const event = type === "click" ? new view.MouseEvent("click", { bubbles: true, cancelable: true, view })
    : new view.Event(type, { bubbles: true });
  // CoC7 8.15 reads currentTarget after an await, which the browser has cleared by then for a script's event.
  Object.defineProperty(event, "currentTarget", { value: node });
  node.dispatchEvent(event);
  return true;
}

const ATTACKER = "A";
const DEFENDER = "D";
// CoC7 8.15 joins a sheet's opposed roll only to an open card under a day old (`joinGroupMessage`).
const JOIN_WINDOW_MS = 24 * 60 * 60 * 1000;
// Two presses set the roles from any start; more means someone else is pressing too.
const MOST_PRESSES = 4;

/**
 * Sets Attacker (the player's side) and Defender once a side joins an open opposed card; call it before asking CoC7.
 * @param {{playerUuid: string}} watch the player's side
 * @returns {() => void} stops the watch quietly (no card is coming)
 */
export function setRolesWhenJoined({ playerUuid }) {
  if (!playerUuid) return () => {};
  const player = dotted(playerUuid);
  const since = Date.now();
  let cardId = null;
  let presses = 0;
  let hookId = null;
  let goneId = null;
  const stop = () => {
    Hooks.off(RENDER_HOOK, hookId);
    if (goneId !== null) Hooks.off("deleteChatMessage", goneId);
    clearTimeout(timer);
  };
  const timer = setTimeout(stop, JOIN_WINDOW_MS);
  goneId = Hooks.on("deleteChatMessage", (message) => {
    if (cardId && message?.id === cardId) stop();
  });
  hookId = Hooks.on(RENDER_HOOK, (message, html) => {
    const load = message?.flags?.[COC7_ID]?.load;
    // CoC7 saves each side under its uuid with "/" for "."; its portraits carry the uuid with dots.
    const sides = Object.entries(load?.actorRolls ?? {}).map(([uuid, roll]) => ({
      key: dotted(uuid), role: roll?.participant ?? "" }));
    if (!cardId) {
      // The card this request made: CoC7's opposed card by this user, newer than the request, the player's side alone.
      const fresh = !(Number(message?.timestamp) < since - 1000);
      if (load?.as !== "CoC7ChatOpposedMessage" || message.isAuthor === false || !fresh || sides.length !== 1
        || sides[0].key !== player) return undefined;
      cardId = message.id;
    }
    if (message?.id !== cardId) return undefined;
    if (load?.cardOpen !== true || load.isRolling === true) return stop();
    const own = sides.find((side) => side.key === player);
    const joined = sides.find((side) => side.key !== player);
    if (!own || !joined) return undefined;
    if (own.role === ATTACKER && joined.role === DEFENDER) return stop();
    if (presses >= MOST_PRESSES) {
      tellKeeper("Rollbox: set Attacker and Defender on the opposed card.");
      return stop();
    }
    presses += 1;
    pressWhenReady(html, `.actor-portrait[data-actor-uuid="${joined.key}"] [data-action="participant"]`,
      "Rollbox: set Attacker and Defender on the opposed card.");
    return undefined;
  });
  return stop;
}
// Security: the id goes into a selector, so only Foundry's plain letters and digits.
const safeId = (messageId) => /^[A-Za-z0-9]+$/.test(String(messageId));

function cardCopies(messageId) {
  if (!safeId(messageId)) return [];
  const copies = Array.from(document.querySelectorAll(`[data-message-id="${messageId}"]`));
  return copies.sort((a, b) => Number(Boolean(b.closest(".chat-scroll"))) - Number(Boolean(a.closest(".chat-scroll"))));
}

/**
 * Presses one of CoC7's buttons on any rendered copy of a card, as the player would.
 * @param {string} messageId
 * @param {string} selector
 * @returns {boolean} false when no copy of the card or the button is on the page
 */
export function pressCardButton(messageId, selector) {
  if (!safeId(messageId)) return false;
  try {
    for (const card of document.querySelectorAll(`[data-message-id="${messageId}"]`)) {
      const target = card.querySelector(selector);
      if (target && !target.disabled) {
        pressControl(target);
        return true;
      }
    }
  } catch (error) {
    warn("couldn't press the button on CoC7's card.", error);
  }
  return false;
}

/**
 * Waits for CoC7's defender card to show the answer chosen, then presses its `targetRoll` button.
 * @param {string} messageId
 * @param {(load: object) => boolean} ready whether the card's `flags.CoC7.load` shows the answer
 * @param {() => void} onGiveUp
 * @returns {() => void} stops the watch
 */
export function rollWhenChosen(messageId, ready, onGiveUp) {
  let done = false;
  const press = (html) => {
    done = true;
    stop();
    let tries = CLICK_TRIES;
    const attempt = () => {
      const button = html?.querySelector?.('[data-action="targetRoll"]');
      if (button && !button.disabled) return pressControl(button);
      if (--tries > 0) return setTimeout(attempt, CLICK_DELAY_MS);
      return onGiveUp();
    };
    setTimeout(attempt, CLICK_DELAY_MS);
  };
  const hookId = Hooks.on(RENDER_HOOK, (message, html) => {
    if (!done && message?.id === messageId && ready(message.flags?.[COC7_ID]?.load ?? {})) press(html);
  });
  const timer = setTimeout(() => { if (!done) { stop(); onGiveUp(); } }, CHOICE_WAIT_MS);
  function stop() {
    Hooks.off(RENDER_HOOK, hookId);
    clearTimeout(timer);
  }
  const shown = game.messages?.get?.(messageId);
  if (shown && ready(shown.flags?.[COC7_ID]?.load ?? {})) {
    const html = cardCopies(messageId).find((copy) => copy.querySelector('[data-action="targetRoll"]'));
    if (html) press(html);
  }
  return stop;
}

/**
 * Opens CoC7's dropdown under a card's Fight back or Maneuver button and presses the entry for an item.
 * @param {string} messageId
 * @param {string} opener the card's button that opens the list
 * @param {string} itemId
 * @returns {Promise<boolean>} false when the list or the entry never shows
 */
export async function pickFromCardList(messageId, opener, itemId) {
  const copy = cardCopies(messageId).find((each) => each.closest(".chat-scroll") && each.querySelector(opener));
  if (!copy) return false;
  pressControl(copy.querySelector(opener));
  for (let tries = 0; tries < CLICK_TRIES * 2; tries += 1) {
    await new Promise((resolve) => { setTimeout(resolve, CLICK_DELAY_MS / 2); });
    const entry = document.getElementById(`dropdown-${messageId}`)
      ?.querySelector(`[data-action="setItem"][data-item-id="${itemId}"]`);
    if (entry) {
      pressControl(entry);
      return true;
    }
  }
  return false;
}
