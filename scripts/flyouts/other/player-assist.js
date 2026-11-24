/** A player's read-only Assist tab, drawn from where their investigator stands. See docs/assist.md. */
import { actorFromUuid, dotted, element, glyph, warn } from "../../utils.js";
import { cancelPick } from "../../player/index.js";
import { checkRequest, makeCheck } from "../../roll-requests/index.js";
import { DIFFICULTY_LABELS, button } from "../flyout.js";
import { canBeHelped, groupChanged, joinGroup, leaveGroup, standing } from "./assist-group.js";
import { STATS, valueOf } from "./assist-split.js";

const PROMPT = "Target who you're helping";
const INTRO = "Help another character. Target who you're helping; the Keeper sets what you're up against.";
const WAITING = "The Keeper sets what you're up against and who rolls.";
// A waiting group shows STR, Physical Human Limits' usual characteristic, until the Keeper sets Use.
const SHOWN_STAT = "str";

// Module state: the open tab, redrawn when its group changes, and the last refusal or failure shown under it.
let live = null;
let note = "";


const same = (a, b) => Boolean(a && b) && dotted(a.uuid ?? a) === dotted(b.uuid ?? b);

/**
 * Builds a player's Assist tab for their own investigator.
 * @param {HTMLElement} body
 * @param {{actors: Actor[], pickTarget: Function}} context `actors[0]` is the player's own investigator
 * @returns {void}
 */
export function renderPlayerAssist(body, { actors = [], pickTarget } = {}) {
  const own = actors[0];
  if (!own) return;
  const draw = () => {
    if (live?.body !== body) return;
    body.replaceChildren(view(own, { pickTarget, redraw: draw }));
  };
  live = { body, draw };
  note = "";
  draw();
}

/**
 * Redraws the player's open Assist when an updateActor changed an assist group.
 * @param {Actor} _actor
 * @param {object} changes Foundry's update data
 * @returns {boolean} true when drawn again
 */
export function playerAssistChanged(_actor, changes) {
  if (!groupChanged(changes)) return false;
  if (!live?.body?.isConnected) return false;
  live.draw();
  return true;
}

function heading(title, caption) {
  const box = element("div", "rollbox-value-box rollbox-assist-player-head");
  box.append(element("div", "rollbox-assist-player-title", title));
  if (caption) box.append(element("span", "rollbox-value-caption", caption));
  return box;
}

function list(title, entries) {
  const nodes = [element("div", "rollbox-assist-heading", title)];
  for (const { who, what } of entries) {
    const row = element("div", "rollbox-assist-line");
    const name = element("span", "rollbox-assist-line-who", who);
    name.title = who;
    row.append(name, element("span", "rollbox-assist-line-what", what));
    nodes.push(row);
  }
  return nodes;
}

const you = (entry, own) => (same(entry, own) ? `${entry.name ?? entry.actor?.name ?? ""} (you)` : (entry.name ?? ""));

function view(own, { pickTarget, redraw }) {
  const root = element("div", "rollbox-section rollbox-assist-player");
  const where = standing(own);
  if (!where) root.append(...pickView(own, { pickTarget, redraw }));
  else if (where.group.sent) root.append(...sentView(own, where, { redraw }));
  else root.append(...waitingView(own, where, { redraw }));
  if (note) root.append(element("div", "rollbox-result-line rollbox-assist-player-note", note));
  return root;
}

// True while the target picker waits, so a second press cancels it.
let choosing = false;

/** Draws the not-yet-helping view: one button that picks who to help by target. */
function pickView(own, { pickTarget, redraw }) {
  const go = button("rollbox-btn rollbox-primary rollbox-assist-help", "", async () => {
    if (choosing) {
      cancelPick();
      return;
    }
    choosing = true;
    go.setAttribute("aria-pressed", "true");
    let token = null;
    try {
      token = await pickTarget({ prompt: PROMPT, useCurrent: false, restore: true });
    } catch (error) {
      warn("picking who to help by target failed.", error);
    } finally {
      choosing = false;
    }
    const helped = token?.actor;
    if (!helped) note = "";
    else if (!canBeHelped(helped, own)) note = "You can't help yourself: target who you're helping.";
    else {
      const joined = await joinGroup(helped, own);
      note = joined.ok ? "" : `Not joined: ${joined.reason}.`;
    }
    redraw();
  });
  go.setAttribute("aria-pressed", String(choosing));
  go.append(glyph("fa-crosshairs"), element("span", "", PROMPT));
  return [element("p", "rollbox-hint rollbox-assist-player-intro", INTRO), go];
}

/** Draws a group waiting for the Keeper; only a helper can stop helping. */
function waitingView(own, { helped, group }, { redraw }) {
  const helping = !same(helped, own);
  const stat = STATS[SHOWN_STAT];
  const members = group.helpers.map((uuid) => actorFromUuid(uuid)).filter(Boolean);
  const nodes = [heading(helping ? `Helping ${helped.name ?? ""}` : "Being helped", "Waiting for the Keeper")];
  nodes.push(...list(helping ? `With ${helped.name ?? ""}` : "Helping you", members.map((actor) => ({
    who: you({ uuid: actor.uuid, name: actor.name }, own), what: `${stat} ${valueOf(actor, SHOWN_STAT) ?? "—"}` }))));
  nodes.push(element("p", "rollbox-hint rollbox-assist-player-wait", WAITING));
  if (helping) {
    const stop = button("rollbox-btn rollbox-assist-stop", "Stop helping", async () => {
      stop.disabled = true;
      const left = await leaveGroup();
      note = left.ok ? "" : `Still helping: ${left.reason ?? "the Keeper's Rollbox didn't answer"}.`;
      redraw();
    });
    nodes.push(stop);
  }
  return nodes;
}

/** Draws a sent group; a roller who hasn't rolled gets their roll button. */
function sentView(own, { group }, { redraw }) {
  const { sent } = group;
  const stat = STATS[sent.use] ?? STATS.str;
  const level = DIFFICULTY_LABELS[sent.difficulty] ?? "";
  const nodes = [heading(`${level} ${stat}`.trim(), sent.label || null)];
  nodes.push(...list("Assisting", sent.helpers.length
    ? sent.helpers.map((entry) => ({ who: you(entry, own), what: `−${entry.value}` }))
    : [{ who: "No one", what: "" }]));
  nodes.push(...list("Rolling", sent.rollers.map((entry) => ({ who: you(entry, own), what: `${stat} ${entry.value}` }))));
  const enough = element("div", "rollbox-assist-line rollbox-assist-chance");
  enough.append(element("span", "rollbox-assist-line-who", "One success is enough"));
  nodes.push(enough);
  const mine = sent.rollers.find((entry) => same(entry, own));
  if (!mine) {
    const names = sent.rollers.map((entry) => entry.name).join(" and ");
    nodes.push(element("p", "rollbox-hint rollbox-assist-player-wait", `${names} ${sent.rollers.length > 1 ? "roll" : "rolls"}. Nothing for you to do.`));
    return nodes;
  }
  const rolled = sent.rolled.some((uuid) => dotted(uuid) === dotted(own.uuid));
  const roll = button("rollbox-btn rollbox-primary rollbox-assist-roll", rolled ? "Rolled" : `Roll ${level} ${stat}`,
    async () => {
      roll.disabled = true;
      const request = checkRequest({ checks: [{ kind: "characteristic", name: sent.use }], difficulty: sent.difficulty });
      const made = request ? await makeCheck(request, own) : null;
      note = made?.requested?.length ? "" : `Not rolled: ${made?.skipped?.[0]?.reason ?? "CoC7 couldn't make the check"}.`;
      if (note) redraw();
    });
  roll.disabled = rolled;
  nodes.push(roll);
  return nodes;
}
