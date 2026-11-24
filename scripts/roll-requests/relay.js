/**
 * The Keeper relay: a player's client asks the active Keeper's client over Foundry's module socket.
 * See docs/roll-requests.md.
 */
import { MODULE_ID, isActiveKeeper, isKeeper, tellKeeper, warn } from "../utils.js";

// Foundry v14: the channel a module gets by declaring "socket": true in module.json.
const CHANNEL = `module.${MODULE_ID}`;
const REPLY_TIMEOUT_MS = 20000;
const NO_KEEPER = "Rollbox: the Keeper needs to be online for this.";

/** The Keeper's side, by message type. */
let handlers = {};
/** A player's requests waiting for the Keeper's answer: id → resolve. */
const waiting = new Map();
// Ids carry the user id in front, so two players' requests never clash.
let counter = 0;

function socket() {
  const io = globalThis.game?.socket;
  return typeof io?.emit === "function" && typeof io?.on === "function" ? io : null;
}

function keeperOnline() {
  try {
    return Boolean(globalThis.game?.users?.activeGM);
  } catch {
    return false;
  }
}

/**
 * Asks the Keeper's client to do something and waits for its answer.
 * @param {string} type a message type the Keeper's side handles
 * @param {object} payload plain data only (uuids, never documents)
 * @param {{wait?: boolean, timeout?: number}} [options] `wait` false: don't wait; `timeout` in ms
 * @returns {Promise<{ok: boolean, reason?: string, answer?: *}>} `ok` false, with `reason`, when nothing answered
 */
export async function askKeeper(type, payload, { wait = true, timeout = REPLY_TIMEOUT_MS } = {}) {
  const io = socket();
  if (!io) {
    warn("Foundry's socket isn't available, so Rollbox can't reach the Keeper.");
    return { ok: false, reason: "the Keeper can't be reached" };
  }
  if (!keeperOnline()) {
    tellKeeper(NO_KEEPER);
    return { ok: false, reason: "no Keeper online" };
  }
  counter += 1;
  const id = `${game.user?.id ?? "user"}-${counter}`;
  const message = { type, id, userId: game.user?.id ?? null, payload };
  if (!wait) {
    io.emit(CHANNEL, message);
    return { ok: true };
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiting.delete(id);
      resolve({ ok: false, reason: "the Keeper's Rollbox didn't answer" });
    }, timeout);
    waiting.set(id, (answer) => {
      clearTimeout(timer);
      waiting.delete(id);
      resolve({ ok: true, answer });
    });
    io.emit(CHANNEL, message);
  });
}

// Security: the sender is the id Foundry's server adds (v14 `handleCustomSocket`), never one written in the message.
function senderOf(message, senderId) {
  if (typeof senderId !== "string" || !senderId) return null;
  if (message.userId && message.userId !== senderId) return null;
  return game.users?.get?.(senderId) ?? null;
}

async function onMessage(message, senderId) {
  if (!message || typeof message !== "object") return;
  if (message.type === "answer") {
    if (message.to !== game.user?.id) return;
    if (senderOf(message, senderId)?.isGM !== true) return;
    waiting.get(message.id)?.(message.answer);
    return;
  }
  if (!isActiveKeeper()) return;
  const handler = handlers[message.type];
  if (typeof handler !== "function") return;
  const user = senderOf(message, senderId);
  if (!user || user.isGM) return;
  let answer = null;
  try {
    answer = await handler(message.payload ?? {}, user);
  } catch (error) {
    warn(`couldn't do what ${user.name ?? "a player"} asked for.`, error);
  }
  socket()?.emit(CHANNEL, { type: "answer", id: message.id, to: user.id, answer });
}

/**
 * Adds a message type the Keeper's client answers; the handler must check itself that the player may ask for it.
 * @param {string} type
 * @param {(payload: object, user: User) => *} handler
 * @returns {boolean} false on a player's client or for a handler that isn't a function
 */
export function onKeeperRequest(type, handler) {
  if (!isKeeper() || typeof handler !== "function") return false;
  handlers = { ...handlers, [type]: handler };
  return true;
}

/**
 * Listens on Rollbox's socket channel; on the Keeper's client `keeper` holds each message type's handler.
 * @param {Record<string, (payload: object, user: User) => *>} [keeper]
 * @returns {boolean} false when Foundry's socket can't be reached
 */
export function registerRelay(keeper = {}) {
  const io = socket();
  if (!io) return false;
  handlers = isKeeper() ? { ...handlers, ...keeper } : {};
  waiting.clear();
  io.on(CHANNEL, onMessage);
  return true;
}
