/** The weapon-drawn notice: the Keeper's pop-up listing who could notice, and its rolls. See docs/combat.md. */
import {
  COC7_ID, KEEPER, actorFromUuid, declareSettings, dotted, escapeHtml, isKeeper, option, plays, tellKeeper,
  uniqueActors, warn
} from "../utils.js";
import { comparable, skills, tableSkill } from "../skill-values/index.js";
import {
  UNARMED_COCID, askKeeper, checkRequest, onKeeperRequest, ownersOf, send, unarmedOnSheet, watchCheck
} from "../roll-requests/index.js";
import { difficultyFor } from "../shared/index.js";
import { gameplayOn, runningCombat } from "./encounter.js";
import { centreOf, metresBetween, tokenOf, wallBetween } from "./sight.js";
import { showPopup } from "./fight-boxes.js";
import { beginEncounter } from "./fight-changes.js";

/**
 * Declares the Notice range and Notice distance settings.
 * @type {object[]}
 */
export const SETTINGS = declareSettings([
  { key: "rollboxNoticeRange", scope: "world", type: String, choices: { sight: "Line of sight", distance: "Distance" },
    default: "distance", section: "gameplay", label: "Notice range",
    hint: "Who may notice a weapon being drawn: anyone in sight, or only those within the distance below and in sight.",
    note: KEEPER },
  { key: "rollboxNoticeDistance", scope: "world", type: Number, range: { min: 10, max: 100, step: 5 }, default: 20,
    section: "gameplay", label: "Notice distance (m)",
    hint: "With Notice range set to Distance: how far away someone can be and still notice, in metres, edge to edge "
      + "(the scene's feet are converted).",
    note: KEEPER }
]);

/**
 * Declares the Notice when a weapon is drawn setting.
 * @type {object[]}
 */
export const DRAW_SETTINGS = declareSettings([
  { key: "rollboxNoticeDraw", scope: "world", type: Boolean, default: true, section: "gameplay",
    label: "Notice when a weapon is drawn",
    hint: "Out of combat, a real weapon drawn by an investigator or NPC from Rollbox's Action flyout brings up a pop-up "
      + "only you see: who could notice, each with their result once rolled; Roll to notice (Spot Hidden), Nobody, "
      + "Everyone, Start combat or Ignore. Never "
      + "for an unarmed attack or a creature. Off: no weapon-drawn notice.", note: KEEPER }
]);

const NOTICE_SKILLS = Object.freeze({
  draw: Object.freeze(["Spot Hidden"])
});
const SPOT_HIDDEN = Object.freeze({ name: "Spot Hidden", cocid: "i.skill.spot-hidden" });
const CHOICES = Object.freeze([
  Object.freeze([["roll", "Roll to notice"], ["nobody", "Nobody notices"], ["everyone", "Everyone notices"]]),
  Object.freeze([["combat", "Start combat"], ["ignore", "Ignore"]])
]);
// A creature's claws and bite can't be told from a carried weapon, so creatures never draw.
const DRAWERS = Object.freeze(["character", "npc"]);
const DECIDED = Object.freeze({
  roll: "Roll to notice sent.", nobody: "Nobody notices.", everyone: "Everyone notices.", combat: "Combat started.",
  ignore: "Ignored."
});
const STATUS = Object.freeze({
  waiting: Object.freeze({ status: "Waiting", state: "waiting" }),
  noticed: Object.freeze({ status: "Noticed", state: "yes" }),
  missed: Object.freeze({ status: "Didn't notice", state: "no" }),
  unsent: Object.freeze({ status: "Not sent", state: "" })
});
const NOTICE_WAIT_MS = 600000;
// When each watcher noticed each drawer, by "drawer>watcher" uuids; this client's memory only.
const noticedBy = new Map();

const STEALTH_BASE = tableSkill("Stealth", "i.skill.stealth")?.base;

function inNoticeRange(from) {
  const origin = centreOf(from);
  if (!origin) return [];
  const byDistance = option("rollboxNoticeRange") !== "sight";
  const limit = Number(option("rollboxNoticeDistance")) || 20;
  const seen = new Set();
  const found = [];
  for (const token of Array.from(globalThis.canvas?.tokens?.placeables ?? [])) {
    const actor = token?.actor;
    if (!actor || token === from || token.id === from.id || actor === from.actor) continue;
    const point = centreOf(token);
    if (!point) continue;
    if (byDistance) {
      const metres = metresBetween(from, token);
      if (metres === null || metres > limit) continue;
    }
    if (wallBetween(origin, point)) continue;
    const key = actor.uuid ?? actor;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ actor, token });
  }
  return found;
}

function stealthOf(actor) {
  try {
    const row = skills(actor).find((skill) => comparable(skill.name) === comparable("Stealth"));
    return Number.isFinite(row?.value) ? row.value : STEALTH_BASE;
  } catch {
    return STEALTH_BASE;
  }
}

const entryOf = (actor) => ({ uuid: actor.uuid ?? null, name: actor.name ?? "" });

const drawNoticed = () => gameplayOn() && option("rollboxNoticeDraw") !== false;

function drawsWeapon(actor, weapon) {
  if (!DRAWERS.includes(actor?.type) || weapon?.type !== "weapon") return false;
  if (weapon.flags?.[COC7_ID]?.cocidFlag?.id === UNARMED_COCID) return false;
  try {
    return unarmedOnSheet(actor)?.id !== weapon.id;
  } catch {
    return true;
  }
}

/**
 * Shows the Keeper the weapon-drawn notice for a real weapon drawn out of combat; a player's client asks the Keeper's.
 * @param {{actor: Actor, weapon: Item}} drawn who drew which weapon
 * @returns {Promise<object|boolean|null>} the pop-up (a player's client: true once the Keeper's showed it); null with
 *   the Gameplay rules or the notice's setting off, an encounter running, an unarmed weapon or a creature
 */
export async function postNoticeCard({ actor, weapon } = {}) {
  if (!actor || !weapon || !drawNoticed() || runningCombat(actor) || !drawsWeapon(actor, weapon)) return null;
  if (!isKeeper()) return askedKeeper("notice", { kind: "draw", actorUuid: actor.uuid, weaponId: weapon.id });
  return drawCard(actor, weapon);
}

const ROW_ANSWERS = Object.freeze([["noticed", "Noticed"], ["missed", "Didn't notice"]]);

function drawList(data) {
  if (!data.watchers.length) return null;
  return { label: "Could notice:", rows: data.watchers.map((entry) => ({ name: entry.name,
    ...(STATUS[entry.status] ?? { status: "", state: "" }),
    buttons: ROW_ANSWERS.map(([id, label]) => ({ label, disabled: entry.status === id,
      run: () => settleRow(data, entry, id) })) })) };
}

function drawCard(actor, weapon) {
  const token = tokenOf(actor);
  const watchers = token ? inNoticeRange(token).map(({ actor: other }) => ({ ...entryOf(other), status: null })) : [];
  const data = { kind: "draw", title: `${actor.name ?? ""} draws ${weapon.name ?? "a weapon"}.`,
    actor: entryOf(actor), watchers, stealth: stealthOf(actor), decided: null, started: false, redraw: () => {} };
  const popup = showPopup({ kind: "weaponDrawn", key: actor.uuid ?? "" });
  const redraw = () => {
    if (!popup.card.isConnected) return;
    const rows = data.decided ? [CHOICES[1].filter(([id]) => id !== "combat" || !data.started)] : CHOICES;
    const text = [data.watchers.length ? "" : "No one in range.", data.decided ? DECIDED[data.decided] ?? "" : ""]
      .filter(Boolean).join(" ");
    popup.draw({ title: data.title, text, list: drawList(data), onDismiss: () => stopAllWaiting(data),
      sections: rows.map((row) => ({ buttons: row.map(([id, label]) => ({ label, main: id === "combat", run: async () => {
        if (!(await chooseDraw(data, id))) return;
        if (id === "combat" || id === "ignore") {
          stopAllWaiting(data);
          popup.close();
        } else redraw();
      } })) })) });
  };
  data.redraw = redraw;
  redraw();
  return { data, popup };
}


function playerOnline(actor) {
  return (ownersOf(actor) ?? []).some((user) => user?.active === true);
}

// No request for the Keeper to click: CoC7's link names no character, so the click would roll for the selected token.
async function rollToNotice(data) {
  const pairs = data.watchers.map((entry) => ({ entry, actor: actorFromUuid(entry.uuid) })).filter(({ actor }) => actor);
  if (!pairs.length) {
    tellKeeper("Rollbox: no one to roll to notice.");
    return false;
  }
  const request = checkRequest({ checks: NOTICE_SKILLS[data.kind].map((name) => ({ kind: "skill", name })),
    all: false, difficulty: difficultyFor(Number(data.stealth) || STEALTH_BASE), label: "Notice" });
  const investigator = ({ actor }) => actor.type === "character";
  const players = (pair) => investigator(pair) && playerOnline(pair.actor);
  const groups = [
    [pairs.filter(players), {}],
    [pairs.filter((pair) => !players(pair)), { keeperRolls: true, quiet: true }]
  ];
  let sent = 0;
  for (const [group, options] of groups) {
    if (!group.length) continue;
    for (const { entry, actor } of group) {
      entry.status = "waiting";
      entry.stop = watchNotice(actor, data, entry);
    }
    const result = await send(request, uniqueActors(group.map(({ actor }) => actor)), options);
    sent += result.requested.length + result.rolled.length;
    for (const { actor: skipped } of result.skipped) {
      const pair = group.find(({ actor }) => actor === skipped);
      if (!pair) continue;
      stopWaiting(pair.entry);
      pair.entry.status = "unsent";
    }
  }
  data.redraw?.();
  return sent > 0;
}

/**
 * Writes the line an investigator's players get when they noticed the weapon drawn.
 * @param {{name: string}} drawer
 * @returns {string}
 */
export function noticeText(drawer) {
  return `You see ${drawer?.name ?? "someone"} draw a weapon.`;
}


function rememberNoticed(drawerUuid, watcherUuid) {
  if (!drawerUuid || !watcherUuid) return;
  noticedBy.set(`${dotted(drawerUuid)}>${dotted(watcherUuid)}`, Date.now());
}

/**
 * Tells whether this character was marked Noticed for this drawer in the last ten minutes, on this client.
 * @param {Actor} watcher the attack's target
 * @param {string} drawerUuid the attacker's uuid
 * @returns {boolean}
 */
export function noticedDraw(watcher, drawerUuid) {
  const at = noticedBy.get(`${dotted(drawerUuid)}>${dotted(watcher?.uuid)}`);
  return typeof at === "number" && Date.now() - at < NOTICE_WAIT_MS;
}

function forgetOneNoticed(drawerUuid, watcherUuid) {
  noticedBy.delete(`${dotted(drawerUuid)}>${dotted(watcherUuid)}`);
}

function stopWaiting(entry) {
  entry.stop?.();
  entry.stop = null;
}

function stopAllWaiting(data) {
  for (const entry of data?.watchers ?? []) stopWaiting(entry);
}

/** Settles one row by hand; Noticed counts as a rolled Noticed, and a roll still out no longer changes it. */
async function settleRow(data, entry, status) {
  if (!isKeeper() || !data?.watchers?.includes(entry) || !ROW_ANSWERS.some(([id]) => id === status)) return false;
  if (entry.status === status) return false;
  stopWaiting(entry);
  const was = entry.status;
  entry.status = status;
  data.redraw?.();
  if (status === "noticed") {
    rememberNoticed(data.actor?.uuid, entry.uuid);
    const watcher = actorFromUuid(entry.uuid);
    if (watcher) await tellNoticed(watcher, data);
  } else if (was === "noticed") forgetOneNoticed(data.actor?.uuid, entry.uuid);
  return true;
}

function forgetNoticed(drawerUuid = null) {
  if (!drawerUuid) return noticedBy.clear();
  for (const key of [...noticedBy.keys()]) if (key.startsWith(`${dotted(drawerUuid)}>`)) noticedBy.delete(key);
  return undefined;
}

async function tellNoticed(watcher, data) {
  const whisper = (ownersOf(watcher) ?? []).map((user) => user.id).filter(Boolean);
  if (!whisper.length) return;
  try {
    await ChatMessage.create({ speaker: { alias: "Keeper's Rollbox" }, whisper,
      content: `<div class="rollbox-notice-card"><p class="rollbox-notice-title">You notice something</p>`
        + `<p>${escapeHtml(noticeText(data.actor))}</p></div>` });
  } catch (error) {
    warn("couldn't tell an investigator what they noticed.", error);
  }
}

function spotHiddenOnSheet(watcher) {
  try {
    return skills(watcher).some((row) => row.onSheet && comparable(row.name) === comparable(SPOT_HIDDEN.name));
  } catch {
    return false;
  }
}

// CoC7 8.15: a skill result's key is the item's uuid; Spot Hidden missing from the sheet rolls raw, as `type: "value"`.
function isSpotHidden(result, rawRoll = false) {
  if (rawRoll && result?.type === "value") return true;
  if (result?.type !== "skill" || !result.key) return false;
  try {
    const item = globalThis.fromUuidSync?.(result.key) ?? null;
    const cocid = item?.flags?.[COC7_ID]?.cocidFlag?.id;
    return cocid === SPOT_HIDDEN.cocid || comparable(item?.name ?? "") === comparable(SPOT_HIDDEN.name);
  } catch {
    return false;
  }
}

function watchNotice(watcher, data, entry) {
  const rawRoll = !spotHiddenOnSheet(watcher);
  return watchCheck(watcher, { waitMs: NOTICE_WAIT_MS, accepts: (result) => isSpotHidden(result, rawRoll),
    onResult: async (result) => {
      const saw = result.isSuccess === true;
      entry.status = saw ? "noticed" : "missed";
      data.redraw?.();
      if (!saw) return;
      rememberNoticed(data.actor.uuid, watcher.uuid);
      await tellNoticed(watcher, data);
    } });
}

async function startEncounter(actors) {
  const tokens = uniqueActors(actors).map(tokenOf).filter(Boolean);
  if (!tokens.length) {
    tellKeeper("Rollbox couldn't find the tokens to start combat with.");
    return null;
  }
  try {
    const combat = await beginEncounter(tokens.map((token) => ({ token })));
    if (!combat) throw new Error("no scene to start the encounter on");
    return combat;
  } catch (error) {
    warn("couldn't start the encounter.", error);
    tellKeeper("Rollbox couldn't start combat. Use Foundry's combat tracker.");
    return null;
  }
}

/**
 * Carries out a choice on the weapon-drawn pop-up; the first choice stays, and Start combat and Ignore work after it.
 * @param {object} data the pop-up's data (drawCard)
 * @param {string} choice one of CHOICES' ids
 * @returns {Promise<boolean>} true when the choice was carried out
 */
export async function chooseDraw(data, choice) {
  if (!isKeeper() || !data || !CHOICES.flat().some(([id]) => id === choice)) return false;
  const after = (choice === "combat" && !data.started) || choice === "ignore";
  if (data.decided && (data.decided === "ignore" || !after)) return false;
  if (choice === "roll" && !(await rollToNotice(data))) return false;
  if (choice === "everyone" || choice === "nobody") {
    for (const entry of data.watchers) {
      stopWaiting(entry);
      entry.status = choice === "everyone" ? "noticed" : "missed";
    }
  }
  if (choice === "everyone") {
    for (const entry of data.watchers) rememberNoticed(data.actor?.uuid, entry.uuid);
    for (const watcher of uniqueActors(data.watchers.map((entry) => actorFromUuid(entry.uuid)))) await tellNoticed(watcher, data);
  }
  const starts = choice === "combat";
  if (starts) {
    const everyone = [data.actor, ...data.watchers].map((entry) => actorFromUuid(entry.uuid)).filter(Boolean);
    if (!(await startEncounter(everyone))) return false;
    forgetNoticed(data.actor?.uuid);
  }
  data.decided ??= choice;
  data.started = data.started === true || starts;
  return true;
}

async function askedKeeper(type, payload) {
  const reply = await askKeeper(type, payload);
  return reply.ok && reply.answer === true;
}


/**
 * Shows the weapon-drawn pop-up for a player's relayed pick, only for a weapon on a character the sender owns.
 * @param {{kind: string, actorUuid: string, weaponId: string}} payload
 * @param {User} user the sender
 * @returns {Promise<boolean>} true when the pop-up showed
 */
export async function noticeForPlayer({ kind, actorUuid, weaponId } = {}, user) {
  const actor = actorFromUuid(actorUuid);
  if (!actor || !plays(actor, user)) return false;
  if (kind === "draw") {
    const weapon = actor.items?.get?.(weaponId);
    if (!drawNoticed() || runningCombat(actor) || !drawsWeapon(actor, weapon)) return false;
    return Boolean(drawCard(actor, weapon));
  }
  return false;
}

/**
 * Listens for the relay's "notice" message. Call at ready.
 * @returns {boolean} true when registered; false for players
 */
export function registerNoticeCards() {
  if (!isKeeper()) return false;
  onKeeperRequest("notice", noticeForPlayer);
  return true;
}
