/**
 * Attacks, reloads and spells through CoC7's own methods, and the toggles Rollbox sets on its attack card.
 * See docs/roll-requests.md.
 */
import {
  COC7_ID, KEEPER, PERSONAL, declareSettings, isKeeper, numberOrNull, option, plays, tellKeeper, warn
} from "../utils.js";
import { playerRollboxOn } from "../player/index.js";
import { CLICK_DELAY_MS, pressControl } from "./card-buttons.js";
import { askKeeper } from "./relay.js";
import { MAX_DICE } from "./links.js";

/** The settings for whether attacks roll at once, registered by settings.js. */
export const SETTINGS = declareSettings([
  { key: "rollboxAutoRollNpc", scope: "world", type: Boolean, default: true, section: "gameplay",
    label: "Roll NPC attacks at once",
    hint: "When you attack with an NPC or creature through Rollbox, Rollbox presses the roll button on CoC7's attack "
      + "card after setting its toggles. Off: the card waits for you to press it.",
    note: KEEPER },
  { key: "rollboxAutoRollAttacks", scope: "world", type: Boolean, default: true, section: "gameplay",
    label: "Roll investigators' attacks at once",
    hint: "When you attack for an investigator through Rollbox, Rollbox presses the roll button on CoC7's attack card "
      + "after its toggles are set. Off: the card waits for the roll. Each player chooses for their own attacks (Roll "
      + "my attacks at once).",
    note: KEEPER },
  { key: "rollboxRollMyAttacks", scope: "user", type: Boolean, default: true, section: "playerRollbox",
    label: "Roll my attacks at once",
    hint: "For players: when you attack through your Rollbox, Rollbox presses the roll button on CoC7's attack card "
      + "once its toggles are set. Off: the card waits for you to press it. The Keeper's own attacks follow the two "
      + "Roll … attacks at once settings in Gameplay rules.",
    note: PERSONAL }
]);

// Security: a player's card gets Automatic success only from this record on the Keeper's client, never from the player.
const granted = new Map();
const GRANT_MS = 600000;

/**
 * Records that the Keeper granted this attacker CoC7's Automatic success for their next attack card.
 * @param {string} actorUuid
 * @returns {void}
 */
export function grantAutoHit(actorUuid) {
  if (actorUuid) granted.set(String(actorUuid).replaceAll("/", "."), { at: Date.now() });
}

function takeAutoHit(actorUuid) {
  const key = String(actorUuid ?? "").replaceAll("/", ".");
  const grant = granted.get(key);
  granted.delete(key);
  return Boolean(grant) && Date.now() - grant.at < GRANT_MS;
}

const MELEE_CARD = "CoC7ChatCombatMelee";
const RANGED_CARD = "CoC7ChatCombatRanged";
// CoC7 8.15: the attacker's melee card; the defender's own card has participant 1.
const MELEE_INITIATOR = 0;
const TICK_TIMEOUT_MS = 15000;
const RENDER_HOOK = "renderChatMessageHTML";

const idOf = (uuid) => String(uuid ?? "").split(".").pop();

const MAX_SHOTS = 10;

const shotsOn = (message) => (Array.isArray(message?.flags?.[COC7_ID]?.load?.shots)
  ? message.flags[COC7_ID].load.shots.length : 0);

/** Whether a card is the attacker's unrolled card for this weapon; `withShots` while Rollbox adds shots to it. */
function isAttackCard(message, actorUuid, weaponId, anyAuthor = false, withShots = false) {
  const load = message?.flags?.[COC7_ID]?.load;
  if (!load || (!anyAuthor && message?.isAuthor === false) || idOf(load.itemUuid) !== weaponId) return false;
  if (load.as === MELEE_CARD) {
    const rolled = Array.from(load.dicePool?.rolledDice ?? []).some((die) => die?.rolled === true);
    return load.participant === MELEE_INITIATOR && load.attackerUuid === actorUuid && !rolled;
  }
  return load.as === RANGED_CARD && load.actorUuid === actorUuid && load.weaponRolled !== true
    && (withShots || !(load.shots?.length > 0));
}

const isOn = (node) => node?.classList?.contains("switched-on") === true;

const loadOf = (message) => message?.flags?.[COC7_ID]?.load ?? {};
const activeTarget = (message) => (Array.isArray(loadOf(message).targets)
  ? loadOf(message).targets.find((target) => target?.active) ?? {} : {});
function keyOn(message, key, ranged) {
  const keys = ranged ? activeTarget(message).poolKeys : loadOf(message).poolKeys;
  return Array.isArray(keys) && keys.includes(key);
}
const savedDice = (message, ranged) => numberOrNull(ranged ? activeTarget(message).poolModifier
  : loadOf(message).poolModifier) ?? 0;

// CoC7 redraws the card after every change, so one toggle is set per render; a second click would read stale flags.
function tickSteps({ aiming, reloading, cover, pointBlank, noPointBlank, inMelee, outnumbered, autoSuccess, dice },
  ranged) {
  const steps = [];
  const target = ".ranged-targets-option.active";
  const targetKey = (key) => (html) => html.querySelector(
    `${target} [data-action="toggleTargetKey"][data-set="${key}"]`);
  const press = (node) => pressControl(node);
  if (ranged && aiming) {
    steps.push({ name: "Aiming", find: (html) => html.querySelector('[data-action="toggleValue"][data-set="aiming"]'),
      done: isOn, apply: (node) => pressControl(node), seen: (message) => loadOf(message).aiming === true });
  }
  if (ranged && cover) {
    steps.push({ name: "Under cover",
      find: (html) => html.querySelector(`${target} [data-action="toggleTargetKey"][data-set="cover"]`),
      done: isOn, apply: (node) => pressControl(node), seen: (message) => keyOn(message, "cover", true) });
  }
  // CoC7 ticks Point blank itself measuring centre to centre; Rollbox measures edge to edge, so it may differ.
  if (ranged && pointBlank) {
    steps.push({ name: "Point blank", find: targetKey("pointBlankRange"), done: isOn, apply: press,
      seen: (message) => keyOn(message, "pointBlankRange", true) });
  }
  if (ranged && noPointBlank) {
    steps.push({ name: "Point blank off (mace spray)", find: targetKey("pointBlankRange"), done: (node) => !isOn(node),
      apply: press, seen: (message) => !keyOn(message, "pointBlankRange", true) });
  }
  if (ranged && inMelee) {
    steps.push({ name: "In melee", find: targetKey("inMelee"), done: isOn, apply: press,
      seen: (message) => keyOn(message, "inMelee", true) });
  }
  // A player's copy of the card lacks CoC7's keeper-only block, so their client reads Automatic success from the flags.
  if (!ranged && autoSuccess) {
    const button = '[data-action="toggleValue"][data-set="isAutoSuccess"]';
    steps.push({ name: "Automatic success", find: (html) => html.querySelector(button) ?? html,
      done: (node, message) => loadOf(message).isAutoSuccess === true || (node.matches?.(button) && isOn(node)),
      apply: (node) => { if (node.matches?.(button)) press(node); },
      seen: (message) => loadOf(message).isAutoSuccess === true });
  }
  if (!ranged && outnumbered) {
    steps.push({ name: "Outnumbered",
      find: (html) => html.querySelector('[data-action="togglePoolKey"][data-set="outnumbered"]'), done: isOn,
      apply: press, seen: (message) => keyOn(message, "outnumbered", false) });
  }
  if (ranged && reloading) {
    steps.push({ name: "Reloading",
      find: (html) => html.querySelector(`${target} [data-action="toggleTargetKey"][data-set="reloading"]`),
      done: isOn, apply: (node) => pressControl(node), seen: (message) => keyOn(message, "reloading", true) });
  }
  if (dice) {
    let wanted = null;
    const slider = ranged ? `${target} input[type="range"][data-set="poolModifier"]` : 'input[type="range"][name="poolModifier"]';
    steps.push({ name: "the dice", find: (html) => html.querySelector(slider),
      // The card starts from the weapon's own bonus dice; Rollbox's dice go on top of them, within two either way.
      done: (node) => {
        const now = numberOrNull(node.value) ?? 0;
        wanted ??= Math.max(-MAX_DICE, Math.min(MAX_DICE, now + dice));
        return now === wanted;
      },
      apply: (node) => {
        node.value = String(wanted);
        pressControl(node, "change");
      },
      seen: (message) => {
        const now = savedDice(message, ranged);
        wanted ??= Math.max(-MAX_DICE, Math.min(MAX_DICE, now + dice));
        return now === wanted;
      } });
  }
  return steps;
}

// After the toggles: CoC7 gives each shot the target's dice as it is added.
function shotSteps(shots) {
  if (!(shots > 1)) return [];
  const press = (selector) => (html) => {
    const node = html.querySelector(selector);
    if (node && !node.disabled) pressControl(node);
  };
  return [
    { name: "Multi. Shots", find: (html) => html.querySelector('[data-action="toggleValue"][data-set="multipleShots"]'),
      done: isOn, apply: (node) => pressControl(node), owner: true },
    { name: `${shots} shots (the target's Shoot, ${shots} times)`, find: (html) => html,
      done: (node, message) => shotsOn(message) >= shots,
      apply: press('.ranged-targets-option.active [data-action="range-initiator-shoot"]'), owner: true },
    { name: "the bottom Shoot", find: (html) => html.querySelector('.ranged-shots [data-action="range-initiator-roll"]'),
      done: () => false, apply: (node) => pressControl(node), once: true, owner: true }
  ];
}

function rollStep(ranged) {
  const find = ranged
    ? (html) => html.querySelector('.ranged-targets-option.active [data-action="range-initiator-roll"]')
      ?? html.querySelector('[data-action="range-initiator-roll"]')
    : (html) => html.querySelector('[data-action="attackerRoll"]');
  return { name: "Roll", find, done: () => false, apply: (node) => { if (!node.disabled) pressControl(node); },
    once: true, owner: true };
}

function autoRolls(actor) {
  if (["npc", "creature"].includes(actor?.type)) return isKeeper() && option("rollboxAutoRollNpc") !== false;
  if (actor?.type !== "character") return false;
  return option(isKeeper() ? "rollboxAutoRollAttacks" : "rollboxRollMyAttacks") !== false;
}

/** Sets the toggles, shots and roll on the attack card when it renders; returns a quiet stop. */
function tickCard({ actorUuid, weaponId, ranged, ticks, anyAuthor = false, roll = false }) {
  const shots = ranged ? cleanShots(ticks?.shots) : 0;
  const steps = [...tickSteps(ticks, ranged), ...shotSteps(shots)];
  // Multi-shot's bottom Shoot already rolls every shot.
  if (roll && shots < 2) steps.push(rollStep(ranged));
  if (!steps.length) return () => {};
  // The toggles are Keeper-only on CoC7's cards, so the Keeper's client does the whole list, shots after them.
  if (!isKeeper() && steps.some((step) => !step.owner)) {
    askKeeper("ticks", { actorUuid, weaponId, ranged, ticks }, { wait: false });
    return roll && shots < 2 ? waitThenRoll({ actorUuid, weaponId, ranged, steps }) : () => {};
  }
  const left = () => steps.filter((step) => step.name !== "Roll").map((step) => step.name).join(", ");
  const fallback = () => tellKeeper(left() ? `Rollbox: set ${left()} on CoC7's attack card before Roll.`
    : "Rollbox: press Roll on CoC7's attack card.");
  let hookId = null;
  const stop = () => {
    Hooks.off(RENDER_HOOK, hookId);
    clearTimeout(timer);
  };
  const timer = setTimeout(() => {
    stop();
    fallback();
  }, TICK_TIMEOUT_MS);
  hookId = Hooks.on(RENDER_HOOK, (message, html) => {
    if (!isAttackCard(message, actorUuid, weaponId, anyAuthor, shots > 1)) return;
    // CoC7 attaches the card's listeners after its own async render handler.
    setTimeout(() => {
      while (steps.length) {
        const node = steps[0].find(html);
        if (!node) return;
        if (steps[0].done(node, message)) {
          steps.shift();
          continue;
        }
        steps[0].apply(node);
        if (steps[0].once) steps.shift();
        if (steps.length) return;
      }
      stop();
    }, CLICK_DELAY_MS);
  });
  return stop;
}

// A player's copy of the card has no keeper-only buttons, so the toggles the Keeper's client sets are read from flags.
function waitThenRoll({ actorUuid, weaponId, ranged, steps }) {
  const left = steps.map((step) => (step.owner ? step
    : { name: step.name, find: (html) => html, done: (_node, message) => step.seen?.(message) === true, apply: () => {} }));
  const stop = () => {
    Hooks.off(RENDER_HOOK, hookId);
    clearTimeout(timer);
  };
  const timer = setTimeout(stop, TICK_TIMEOUT_MS);
  const hookId = Hooks.on(RENDER_HOOK, (message, html) => {
    if (!isAttackCard(message, actorUuid, weaponId, false, false)) return;
    // Every toggle reads the card once from its first render, so the dice compare with where the card started.
    for (const step of steps) if (!step.owner) step.seen?.(message);
    setTimeout(() => {
      while (left.length) {
        const node = left[0].find(html);
        if (!node) return;
        if (left[0].done(node, message)) {
          left.shift();
          continue;
        }
        left[0].apply(node);
        if (left[0].once) left.shift();
        if (left.length) return;
      }
      stop();
    }, CLICK_DELAY_MS);
  });
  return stop;
}

function cleanShots(shots) {
  const count = Math.trunc(Number(shots) || 0);
  return count > 1 ? Math.min(count, MAX_SHOTS) : 0;
}

// Security: the player's toggles come over the socket, so only exact booleans and clamped numbers are kept.
function cleanTicks(ticks) {
  const dice = Math.max(-MAX_DICE, Math.min(MAX_DICE, Math.trunc(Number(ticks?.dice) || 0)));
  const flag = (name) => ticks?.[name] === true;
  return { aiming: flag("aiming"), reloading: flag("reloading"), cover: flag("cover"), pointBlank: flag("pointBlank"),
    noPointBlank: flag("noPointBlank"), inMelee: flag("inMelee"), outnumbered: flag("outnumbered"), autoSuccess: false,
    dice, shots: cleanShots(ticks?.shots) };
}

/**
 * Sets the toggles on a player's attack card from the Keeper's client, for a character the player owns.
 * @param {{actorUuid: string, weaponId: string, ranged: boolean, ticks: object}} payload
 * @param {User} user the player who attacks
 * @returns {boolean} true when watching
 */
export function keeperTicks({ actorUuid, weaponId, ranged, ticks } = {}, user) {
  if (!isKeeper() || !playerRollboxOn() || !actorUuid || !weaponId) return false;
  let actor = null;
  try {
    actor = globalThis.fromUuidSync?.(actorUuid) ?? null;
  } catch {
    actor = null;
  }
  if (!plays(actor, user)) return false;
  const clean = cleanTicks(ticks);
  // Automatic success only when the Keeper granted it here (About to attack), whatever the player's client sent.
  if (ranged !== true && ticks?.autoSuccess === true) clean.autoSuccess = takeAutoHit(actorUuid);
  tickCard({ actorUuid, weaponId: String(weaponId), ranged: ranged === true, ticks: clean, anyAuthor: true });
  return true;
}

/**
 * Starts CoC7's attack card with `actor.weaponCheck`, which reads the user's targets, so set them first.
 * @param {{actor: Actor, weapon: Item|null, ticks?: object}} attack `ticks`: the card's toggles, dice and shots
 * @returns {Promise<{started: boolean, rolled?: boolean, reason?: string}>} `rolled`: Rollbox presses the roll
 */
export async function startAttack({ actor, weapon = null, ticks = {} } = {}) {
  if (typeof actor?.weaponCheck !== "function") {
    warn("CoC7's actor.weaponCheck is missing; no attack card was made.");
    return { started: false, reason: "CoC7's attack card can't be reached" };
  }
  if (!weapon?.uuid) return { started: false, reason: "no weapon" };
  const ranged = weapon.system?.properties?.rngd === true;
  const roll = autoRolls(actor);
  const stopTicking = tickCard({ actorUuid: actor.uuid, weaponId: weapon.id, ranged, ticks, roll });
  try {
    await actor.weaponCheck({ uuid: weapon.uuid }, false);
    return { started: true, rolled: roll };
  } catch (error) {
    stopTicking();
    warn(`CoC7 couldn't start ${actor.name}'s attack.`, error);
    return { started: false, reason: "CoC7 couldn't make the attack card" };
  }
}

async function callWeapon(weapon, method) {
  if (typeof weapon?.system?.[method] !== "function") {
    warn(`CoC7's weapon.system.${method} is missing; ${weapon?.name ?? "the weapon"} wasn't changed.`);
    return false;
  }
  try {
    await weapon.system[method]();
    return true;
  } catch (error) {
    warn(`CoC7's weapon.system.${method} failed for ${weapon.name}.`, error);
    return false;
  }
}

/**
 * Reloads a firearm to capacity with CoC7's own `system.reload()`.
 * @param {Item} weapon
 * @returns {Promise<boolean>} true when CoC7 reloaded it
 */
export function reloadWeapon(weapon) {
  return callWeapon(weapon, "reload");
}

/**
 * Loads one round with CoC7's own `system.addAmmunition()`.
 * @param {Item} weapon
 * @returns {Promise<boolean>} true when CoC7 added it
 */
export function loadOneRound(weapon) {
  return callWeapon(weapon, "addAmmunition");
}

/**
 * Casts a spell with CoC7's own `system.cast`, which asks its questions and takes the costs itself.
 * @param {Item} spell
 * @param {{hidden?: boolean}} [options] `hidden`: CoC7's Cast hidden
 * @returns {Promise<boolean>} true when CoC7's cast ran
 */
export async function castSpell(spell, { hidden = false } = {}) {
  if (typeof spell?.system?.cast !== "function") {
    warn(`CoC7's spell.system.cast is missing; ${spell?.name ?? "the spell"} wasn't cast.`);
    return false;
  }
  try {
    await spell.system.cast(hidden === true);
    return true;
  } catch (error) {
    warn(`CoC7 couldn't cast ${spell.name}.`, error);
    return false;
  }
}
