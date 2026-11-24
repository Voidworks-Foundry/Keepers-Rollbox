/** What every alert shares: open alerts, their host and frame, reading CoC7's cards. See docs/alert-flyout.md. */
import { COC7_ID, actorFromUuid, dotted, element, warn } from "../../utils.js";
import { ownCharacter, panelHere, playerRollboxOn } from "../../player/index.js";
import { followTheme } from "../../panel/index.js";

// CoC7 8.15: card classes in `flags.CoC7.load.as`; DEFENDER is CoC7ChatCombatMelee's participant.target.
const MELEE_CARD = "CoC7ChatCombatMelee";
const RANGED_CARD = "CoC7ChatCombatRanged";
const DEFENDER = 1;

/** Holds the alerts showing now, by card or notice message id: `{ node, line }`. */
export const alerts = new Map();
/** Holds the cards closed or stood on, which never alert again. */
export const dismissed = new Set();
/** Holds the cards and notices answered for a surprised target, so each is answered once. */
export const answeredSurprise = new Set();
/** Holds the maneuver notices this client answered; their alert stays to say where to roll. */
export const answering = new Set();
let hostProvider = null;
/** Holds who may see alerts and whose character they are for; setPlayerAccess replaces it. */
export const access = { playerRollboxOn, ownCharacter, panelHere };

/**
 * Replaces the player part's access answers (a stub in tests); null restores them.
 * @param {{playerRollboxOn: Function, ownCharacter: Function, panelHere?: Function}|null} answers
 * @returns {void}
 */
export function setPlayerAccess(answers) {
  Object.assign(access, answers ? { panelHere: () => true, ...answers } : { playerRollboxOn, ownCharacter, panelHere });
}

// CoC7 8.15: mirrors CoC7DicePool#isRolled, which a card's plain load object doesn't have.
function poolRolled(pool) {
  return Array.isArray(pool?.rolledDice) && pool.rolledDice.some((dice) => dice?.rolled === true);
}

/**
 * Reads a CoC7 attack card.
 * @param {ChatMessage} message
 * @returns {{kind: "melee"|"shot", id: string, attackerUuid: string|null, targets: string[], open: boolean,
 *   load: object}|null} `targets` in the card's order; `open` until answered or rolled; null for any other message
 */
export function readAttack(message) {
  try {
    const load = message?.flags?.[COC7_ID]?.load;
    if (!message?.id || !load) return null;
    if (load.as === MELEE_CARD && load.participant === DEFENDER && load.targetUuid) {
      return { kind: "melee", id: message.id, attackerUuid: load.attackerUuid ?? null, targets: [dotted(load.targetUuid)],
        open: load.responded !== true && !poolRolled(load.dicePool), load };
    }
    if (load.as === RANGED_CARD && Array.isArray(load.targets)) {
      return { kind: "shot", id: message.id, attackerUuid: load.actorUuid ?? null,
        targets: load.targets.map((target) => dotted(target?.uuid)), open: load.weaponRolled !== true, load };
    }
  } catch {
    // an unreadable card is no attack
  }
  return null;
}

/**
 * Returns the character a card's uuid names: an actor, or a token's actor.
 * @param {string} uuid
 * @returns {Actor|null}
 */
export const actorOf = (uuid) => actorFromUuid(uuid);

/**
 * Returns whether a card's uuid names this character, its token's synthetic actor, or a token of it.
 * @param {string} uuid
 * @param {Actor} actor
 * @returns {boolean}
 */
export function sameCharacter(uuid, actor) {
  if (!uuid || !actor) return false;
  const text = dotted(uuid);
  if (actor.uuid && text === dotted(actor.uuid)) return true;
  if (actor.id && (text === `Actor.${actor.id}` || text.endsWith(`.Actor.${actor.id}`))) return true;
  const named = actorOf(text);
  return Boolean(named && (named === actor || (actor.id && named.id === actor.id)));
}

/**
 * Sets where alerts are drawn instead of Rollbox's own box above the players list.
 * @param {(() => HTMLElement|null)|null} provider null for Rollbox's own box
 * @returns {void}
 */
export function setAlertHost(provider) {
  hostProvider = typeof provider === "function" ? provider : null;
}

function ownHost() {
  let host = document.querySelector(".rollbox-alert-host");
  if (host) return host;
  host = element("div", "rollbox-panel rollbox-alert-host");
  followTheme(host);
  (document.getElementById("interface") ?? document.body).append(host);
  return host;
}

function host() {
  if (hostProvider) {
    try {
      const provided = hostProvider();
      if (provided?.nodeType === 1) return provided;
    } catch (error) {
      warn("the alert's host failed; showing the alert above the players list.", error);
    }
  }
  return ownHost();
}

/**
 * Draws an alert and remembers it by its card or notice.
 * @param {string} id message id
 * @param {{node: HTMLElement, line: HTMLElement}} shown
 * @returns {void}
 */
export function showAlert(id, shown) {
  host().append(shown.node);
  alerts.set(id, shown);
}

/**
 * Returns a button that never submits a form.
 * @param {string} text
 * @param {Function} onClick
 * @param {string} [className]
 * @returns {HTMLButtonElement}
 */
export function alertButton(text, onClick, className = "") {
  const node = element("button", `rollbox-btn ${className}`.trim(), text);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

/**
 * Removes an alert.
 * @param {string} id message id
 * @param {boolean} [dismiss] true keeps it from coming back for that card
 * @returns {void}
 */
export function closeAlert(id, dismiss = false) {
  if (dismiss) dismissed.add(id);
  const shown = alerts.get(id);
  if (!shown) return;
  shown.node.remove();
  alerts.delete(id);
}

/**
 * Returns an alert's frame (header, close button, subtitle) and a hidden line for the caller to place.
 * @param {string} id message id
 * @param {string} title
 * @param {string} [subtitle]
 * @returns {{node: HTMLElement, line: HTMLElement}}
 */
export function frame(id, title, subtitle) {
  const node = element("section", "rollbox-alert");
  node.dataset.messageId = id;
  node.setAttribute("role", "alert");
  const head = element("div", "rollbox-alert-head");
  head.append(element("h4", "rollbox-alert-title", title),
    alertButton("×", () => closeAlert(id, true), "rollbox-alert-close"));
  head.lastChild.setAttribute("aria-label", "Close");
  node.append(head);
  if (subtitle) node.append(element("div", "rollbox-alert-sub", subtitle));
  const line = element("p", "rollbox-alert-line");
  line.setAttribute("aria-live", "polite");
  line.hidden = true;
  return { node, line };
}

/**
 * Shows text on the alert's line; empty text hides it.
 * @param {HTMLElement} line
 * @param {string} text
 * @returns {void}
 */
export function say(line, text) {
  line.textContent = text;
  line.hidden = !text;
}

/**
 * Returns the sentence naming the attacker and target, or "" when the attacker can't be read.
 * @param {{attackerUuid: string|null}} attack
 * @param {Actor} me
 * @param {string} verb
 * @returns {string}
 */
export function whoAttacks(attack, me, verb) {
  const attacker = actorOf(attack.attackerUuid);
  return attacker?.name ? `${attacker.name} ${verb} ${me.name ?? "you"}.` : "";
}

/**
 * Returns a button maker that keeps every button in a list, so an answer can grey them all while it runs.
 * @returns {{controls: HTMLButtonElement[], control: (text: string, onClick: Function, className?: string) =>
 *   HTMLButtonElement}}
 */
export function controlList() {
  const controls = [];
  const control = (text, onClick, className) => {
    const made = alertButton(text, onClick, className);
    controls.push(made);
    return made;
  };
  return { controls, control };
}
