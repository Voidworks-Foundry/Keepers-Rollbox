/** Reads CoC7's check cards and watches for a character's next rolled check. See docs/roll-requests.md. */
import { COC7_ID, dotted } from "../utils.js";
import { checkResult } from "./coc7.js";

const CHECK_CARD = "CoC7Check";

/**
 * Returns the dotted uuid of a CoC7 check card's character, or null for any other message.
 * @param {ChatMessage} message
 * @returns {string|null}
 */
export function checkCardActor(message) {
  const load = message?.flags?.[COC7_ID]?.load;
  return load?.as === CHECK_CARD ? dotted(load.actorUuid) : null;
}

/**
 * Returns whether a CoC7 check result is of this characteristic key (`str`, `pow`, …), ignoring case.
 * @param {object|null} result coc7.js `checkResult`
 * @param {string} key
 * @returns {boolean}
 */
export const isCheckOf = (result, key) => Boolean(key) && String(result?.key ?? "").toLowerCase() === String(key).toLowerCase();

/**
 * Watches for the character's next rolled CoC7 check that `accepts` takes, then calls `onResult` once.
 * @param {Actor} actor
 * @param {{accepts: Function, onResult: Function, waitMs: number, onGiveUp?: Function, mine?: boolean,
 *   isFor?: (actorUuid: string) => boolean}} watch `mine`: only cards this user posted
 * @returns {() => void} stops the watch quietly
 */
export function watchCheck(actor, { accepts, onResult, waitMs, onGiveUp, mine = false, isFor }) {
  const sameActor = isFor ?? ((uuid) => dotted(uuid) === dotted(actor?.uuid));
  let done = false;
  const stop = () => {
    done = true;
    Hooks.off("createChatMessage", onCard);
    Hooks.off("updateChatMessage", onCard);
    clearTimeout(timer);
  };
  // Updates count too: CoC7's standby card is rolled after it is posted.
  const onCard = async (message) => {
    const load = message?.flags?.[COC7_ID]?.load;
    if (done || load?.as !== CHECK_CARD || (mine && message.isAuthor === false) || !sameActor(load.actorUuid)) return;
    const result = await checkResult(message);
    if (done || !result || !accepts(result)) return;
    stop();
    onResult(result);
  };
  const timer = setTimeout(() => {
    if (done) return;
    stop();
    onGiveUp?.();
  }, waitMs);
  Hooks.on("createChatMessage", onCard);
  Hooks.on("updateChatMessage", onCard);
  return stop;
}
