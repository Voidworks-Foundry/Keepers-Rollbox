/**
 * The Keeper's Assist tab (Physical Human Limits): who helps, who rolls, the requests and the public card.
 * See docs/assist.md.
 */
import { NO_VALUE, actorKey, element, escapeHtml, uniqueActors, warn } from "../../utils.js";
import { pickTarget as askTarget } from "../../player/index.js";

import { checkRequest, send } from "../../roll-requests/index.js";
import {
  DIFFICULTY_LABELS, actorTag, button, glyphButton, noneSent, runSend, sendLabel, sendSection, showResult
} from "../flyout.js";
import { captioned, rightClickTargets, statusLine, valueBox, valueLine } from "../../shared/index.js";
import { STATS, assistChoices, valueOf } from "./assist-split.js";
import { clearGroup, groupChanged, groupOf, markSent, rollsOnPanel, waitingHelpers } from "./assist-group.js";
import { renderPlayerAssist } from "./player-assist.js";

export { assistChoices } from "./assist-split.js";

// CoC7 8.15: the creature actor type (system.json documentTypes.Actor).
const CREATURE_TYPE = "creature";

const MAX_AGAINST = 999;
const NUMBER = /^\d{1,3}$/;
const DEFAULT_LABEL = "Assist";
const ADD_PROMPT = "Target a character to add";

// Module state: the choices outlive redraws for a new selection; `live` is the open tab, redrawn on a group change.
let carried = null;
let live = null;

function freshState() {
  return { use: "str", against: "str", typed: "0", targets: new Set(), out: new Set(), seen: new Set(), label: "",
    extra: [] };
}

/**
 * Builds the Assist tab from scratch, keeping its choices on `selectionChanged`; a player's tab is player-assist.js's.
 * @param {HTMLElement} body
 * @param {{actors: Actor[], close?: () => void, selectionChanged?: boolean, cardChanged?: () => void,
 *   targeting?: boolean, pickTarget?: (options: {prompt: string}) => Promise<Token|null>}} context `targeting`: a
 *   player's flyout; `cardChanged` tells the panel the character cards' column changed
 * @returns {void}
 */
export function renderAssist(body, { actors = [], close = () => {}, selectionChanged = false, cardChanged = () => {},
  targeting = false, pickTarget = askTarget } = {}) {
  if (targeting) {
    live = null;
    renderPlayerAssist(body, { actors, pickTarget });
    return;
  }
  if (!selectionChanged || !carried) carried = freshState();
  const state = carried;
  const draw = () => {
    if (carried !== state) return;
    body.replaceChildren();
    const chosen = uniqueActors([...actors, ...state.extra]);
    const everyone = uniqueActors([...chosen, ...chosen.flatMap(waitingHelpers)])
      .filter((actor) => !state.out.has(actorKey(actor)));
    new AssistFlyout(body, everyone, state, { close, cardChanged, addCharacter, redraw: draw }).build();
  };
  const addCharacter = async () => {
    let token = null;
    try {
      token = await pickTarget({ prompt: ADD_PROMPT, useCurrent: false });
    } catch (error) {
      warn("picking a character to add failed.", error);
    }
    const actor = token?.actor;
    if (!actor || carried !== state) return;
    state.out.delete(actorKey(actor));
    if (!state.extra.some((known) => actorKey(known) === actorKey(actor))) state.extra.push(actor);
    draw();
  };
  live = { body, draw };
  draw();
}

/**
 * Redraws the Keeper's open Assist when an updateActor changed an assist group, keeping its choices.
 * @param {Actor} _actor
 * @param {object} changes Foundry's update data
 * @returns {boolean} true when the Keeper's Assist was drawn again
 */
export function assistGroupChanged(_actor, changes) {
  if (!groupChanged(changes)) return false;
  if (!live?.body?.isConnected) return false;
  live.draw();
  return true;
}

/**
 * Returns the character cards' value column while Assist is open: each participant's Use, each target's Against value.
 * @param {Actor[]} actors
 * @returns {{label: string, value: (actor: Actor) => (number|string)}[]}
 */
export function assistColumns(actors = []) {
  const state = carried ?? freshState();
  const target = (actor) => countsAsTarget(state, actor);
  const mixed = state.use !== state.against && actors.some(target);
  const label = mixed ? `${STATS[state.use]}/${STATS[state.against]}` : STATS[state.use];
  return [{ label, value: (actor) => valueOf(actor, target(actor) ? state.against : state.use) ?? NO_VALUE }];
}

/**
 * Returns the public Assist card's HTML, with every name and the label escaped; it never names targets or the number.
 * @param {{use?: string, against?: string, label?: string, left: number, difficulty: string, helpers: string[],
 *   rollers: string[]}} card
 * @returns {string}
 */
export function assistCardHtml({ use = "str", against = "str", label = "", left, difficulty, helpers = [], rollers = [] }) {
  const uses = STATS[use] ?? STATS.str;
  const vs = STATS[against] ?? STATS.str;
  const names = (list) => list.map((name) => escapeHtml(name)).join(", ");
  const lines = [`<h3 class="rollbox-assist-card-title">Assist</h3>`];
  if (String(label).trim()) lines.push(`<p class="rollbox-assist-card-label">${escapeHtml(String(label).trim())}</p>`);
  lines.push(`<p>${uses} against ${vs}: ${left} left, <b>${DIFFICULTY_LABELS[difficulty] ?? ""} ${uses}</b>.</p>`);
  lines.push(`<p>Helping: ${helpers.length ? names(helpers) : "no one"}.</p>`);
  lines.push(`<p>Rolling: ${names(rollers)}.</p>`);
  lines.push(`<p class="rollbox-assist-card-note">One success is enough.</p>`);
  return `<div class="rollbox-assist-card">${lines.join("")}</div>`;
}

// Speaks as the sending user, so the card never takes a selected token's name.
async function postCard(card) {
  await ChatMessage.create({ speaker: { alias: game.user?.name ?? "Keeper" }, content: assistCardHtml(card) });
}

const percent = (chance) => `${Math.round(chance * 100)}%`;

// A mark survives an Against value the character lacks, so it counts again when Against changes back.
function countsAsTarget(state, actor) {
  const key = actorKey(actor);
  return state.targets.has(key) && !state.out.has(key) && valueOf(actor, state.against) !== null;
}

function isCreature(actor) {
  return actor?.type === CREATURE_TYPE;
}

/** Returns the typed number tidied, or null unless it is a whole number up to MAX_AGAINST. */
function againstNumber(text) {
  const typed = String(text ?? "").trim();
  if (!NUMBER.test(typed)) return null;
  const value = Number(typed);
  return value <= MAX_AGAINST ? String(value) : null;
}

class AssistFlyout {
  /**
   * @param {HTMLElement} body
   * @param {Actor[]} actors selected, added and waiting helpers, none taken out
   * @param {{use: string, against: string, typed: string, targets: Set<string>, out: Set<string>,
   *   seen: Set<string>, label: string, extra: Actor[]}} state kept across redraws; mutated
   * @param {{close: () => void, cardChanged: () => void, addCharacter: () => void, redraw: () => void}} hooks
   */
  constructor(body, actors, state, { close, cardChanged, addCharacter, redraw }) {
    this.body = body;
    this.actors = actors;
    this.state = state;
    this.close = close;
    this.cardChanged = cardChanged;
    this.addCharacter = addCharacter;
    this.redraw = redraw;
    this.sending = false;
    const keys = new Set(actors.map(actorKey));
    // Forget characters no longer in, so one back in counts as new (a creature is marked again).
    for (const set of [state.targets, state.seen]) {
      for (const key of [...set]) if (!keys.has(key)) set.delete(key);
    }
    for (const actor of actors) {
      const key = actorKey(actor);
      if (state.seen.has(key)) continue;
      state.seen.add(key);
      if (isCreature(actor) && valueOf(actor, state.against) !== null) state.targets.add(key);
    }
  }

  build() {
    this.body.append(this.whatSection(), this.resultSection(), this.labelSection(), this.sendBlock());
    this.update();
  }

  whatSection() {
    const section = element("div", "rollbox-section");

    this.againstLine = valueLine({ label: "Number to beat", value: this.state.typed, check: againstNumber,
      onChange: () => this.typed() });
    this.againstLine.element.classList.add("rollbox-assist-against");
    this.againstPart = captioned(this.againstLine, "");
    this.againstCaption = this.againstPart.querySelector(".rollbox-value-caption");

    this.tiles = [this.statTiles("Use", "use"), this.statTiles("Against", "against")];
    const stats = element("div", "rollbox-assist-stats");
    stats.append(...this.tiles.map((tiles) => tiles.root));

    this.names = element("div", "rollbox-assist-names");
    this.names.setAttribute("role", "group");
    this.names.setAttribute("aria-label", "Who takes part");
    this.rows = this.actors.map((actor) => this.nameRow(actor));
    this.names.append(...this.rows.map((row) => row.element));
    if (this.actors.length < 2) this.names.append(this.addRow());

    section.append(valueBox([this.againstPart]), stats, this.names);
    return section;
  }

  statTiles(label, field) {
    const root = element("div", "rollbox-assist-stat-group");
    const grid = element("div", "rollbox-check-tiles rollbox-check-tiles-characteristic rollbox-assist-tiles");
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", label);
    const tiles = Object.entries(STATS).map(([key, name]) => {
      const tile = element("button", "rollbox-check-tile rollbox-assist-stat");
      tile.type = "button";
      tile.dataset.value = key;
      tile.append(element("span", "rollbox-check-name", name));
      tile.addEventListener("click", () => {
        this.state[field] = key;
        this.update();
      });
      return tile;
    });
    grid.append(...tiles);
    root.append(element("span", "rollbox-assist-stat-label", label), grid);
    const sync = () => { for (const tile of tiles) tile.setAttribute("aria-pressed", String(tile.dataset.value === this.state[field])); };
    return { root, sync };
  }

  nameRow(actor) {
    const key = actorKey(actor);
    const row = element("div", "rollbox-assist-row");
    row.dataset.actor = actorTag(actor);
    const target = glyphButton("rollbox-btn rollbox-assist-target", "fa-crosshairs", () => this.mark(key),
      { label: `${actor.name ?? ""}: target` });
    const name = element("div", "rollbox-assist-name");
    const who = element("span", "rollbox-assist-name-who", actor.name ?? "");
    who.title = actor.name ?? "";
    const value = element("span", "rollbox-assist-name-value");
    name.append(who, value);
    const remove = glyphButton("rollbox-btn rollbox-assist-remove", "fa-xmark", () => this.remove(actor),
      { label: `Take ${actor.name ?? ""} out of the assist` });
    row.append(target, name, remove);
    rightClickTargets(row, actor);
    return { actor, key, element: row, name, value, target };
  }

  addRow() {
    const row = element("div", "rollbox-assist-row rollbox-assist-add-row");
    row.append(glyphButton("rollbox-btn rollbox-assist-add", "fa-crosshairs", () => this.addCharacter(),
      { text: "Add a character", textClass: "rollbox-assist-add-text" }));
    return row;
  }

  /** Takes the character out until the flyout opens afresh or the picker adds them again. */
  remove(actor) {
    const key = actorKey(actor);
    this.state.out.add(key);
    this.state.targets.delete(key);
    this.state.extra = this.state.extra.filter((known) => actorKey(known) !== key);
    this.redraw();
  }

  mark(key) {
    if (this.state.targets.has(key)) this.state.targets.delete(key);
    else this.state.targets.add(key);
    this.update();
  }

  /** Returns the targets that count, in character-card order, with their Against values. */
  targets() {
    return this.actors.filter((actor) => countsAsTarget(this.state, actor))
      .map((actor) => ({ actor, name: actor.name ?? "", value: valueOf(actor, this.state.against) }));
  }

  // Typing a number unmarks every target, but confirming the targets' own sum unchanged must not.
  typed() {
    const targets = this.targets();
    const sum = String(targets.reduce((total, t) => total + t.value, 0));
    if (targets.length && this.againstLine.text.trim() === sum) return;
    this.state.typed = this.againstLine.text;
    this.state.targets.clear();
    this.update();
  }

  resultSection() {
    const section = element("div", "rollbox-section");
    section.setAttribute("aria-live", "polite");
    this.outcome = element("div", "rollbox-assist-lists");
    this.status = statusLine("rollbox-assist-missing");
    section.append(this.outcome, this.status.element);
    return section;
  }

  /** Returns who takes part, the targets, the number to beat (null while refused) and the split. */
  plan() {
    const uses = this.state.use;
    const taking = [];
    for (const actor of this.actors) {
      if (this.state.targets.has(actorKey(actor))) continue;
      const value = valueOf(actor, uses);
      if (value !== null) taking.push({ actor, name: actor.name ?? "", value });
    }
    const targets = this.targets();
    const typed = this.againstLine.value;
    const against = targets.length ? targets.reduce((total, t) => total + t.value, 0)
      : (typed === null ? null : Number(typed));
    const choice = taking.length && against > 0 ? assistChoices(taking, against) : null;
    return { taking, targets, against, choice };
  }

  line(className, who, what) {
    const row = element("div", `rollbox-assist-line ${className}`.trim());
    const name = element("span", "rollbox-assist-line-who", who);
    name.title = who;
    row.append(name, element("span", "rollbox-assist-line-what", what));
    return row;
  }

  drawOutcome(choice) {
    if (!choice) {
      this.outcome.replaceChildren();
      return;
    }
    const uses = STATS[this.state.use];
    const helpers = choice.helpers.length
      ? choice.helpers.map((h) => this.line("", h.name, `−${h.value}`))
      : [this.line("rollbox-assist-none", "No one", "")];
    this.outcome.replaceChildren(
      element("div", "rollbox-assist-heading", "Assisting"), ...helpers,
      element("div", "rollbox-assist-heading", "Rolling"),
      ...choice.rollers.map((r) => this.line("", r.name, `${uses} ${r.value}`)),
      this.line("rollbox-assist-chance", `${DIFFICULTY_LABELS[choice.difficulty]} ${uses}`,
        `${percent(choice.chance)} one succeeds`));
  }

  labelSection() {
    const section = element("div", "rollbox-section");
    const label = element("input", "rollbox-input rollbox-assist-label");
    label.type = "text";
    label.value = this.state.label;
    label.placeholder = "Label (optional), e.g. lift the rafter";
    label.setAttribute("aria-label", "Label shown to the players");
    label.addEventListener("input", () => { this.state.label = label.value; });
    section.append(label);
    return section;
  }

  sendBlock() {
    const send = button("rollbox-btn rollbox-assist-primary rollbox-primary", "", () => this.send());
    this.sendButton = send;
    // Cancel also clears the players' assist groups shown here (closing the flyout any other way keeps them).
    const cancel = button("rollbox-btn", "Cancel", () => {
      for (const actor of this.actors) clearGroup(actor);
      this.close();
    });
    cancel.dataset.keep = "";
    this.sender = sendSection([send, cancel], { status: this.status });
    return this.sender.element;
  }

  /** Returns what is missing or impossible, or null. */
  missing({ taking, against, choice }) {
    const vs = STATS[this.state.against];
    if (against === null) return `Type the ${vs} to beat.`;
    if (!(against > 0)) return `Target someone, or type the ${vs} to beat.`;
    if (!taking.length) return this.actors.length ? "Include at least one more character." : "Add a character who takes part.";
    return choice ? null : "Too heavy even together.";
  }

  send() {
    const { choice } = this.plan();
    if (!choice) return;
    const label = this.state.label.trim();
    const request = checkRequest({ checks: [{ kind: "characteristic", name: this.state.use }],
      difficulty: choice.difficulty, label: label || DEFAULT_LABEL });
    if (!request) return;
    runSend(this, async () => {
      // A roller who will see the group's Roll button on their panel gets no chat request, so no one rolls twice.
      const grouped = this.groupsIn(choice).length > 0;
      const onPanel = grouped ? choice.rollers.filter((r) => rollsOnPanel(r.actor)).map((r) => r.actor) : [];
      const toChat = choice.rollers.map((r) => r.actor).filter((actor) => !onPanel.includes(actor));
      const result = toChat.length
        ? await send(request, toChat, { involved: choice.helpers.map((h) => h.actor) })
        : noneSent();
      const asked = new Set([...result.requested, ...result.rolled, ...onPanel]);
      const rollers = choice.rollers.filter((r) => asked.has(r.actor)).map((r) => r.name);
      if (rollers.length) {
        await postCard({ use: this.state.use, against: this.state.against, label, left: choice.left,
          difficulty: choice.difficulty, helpers: choice.helpers.map((h) => h.name), rollers });
        result.card = true;
        await this.tellGroups(choice, label);
      }
      result.onPanel = onPanel.map((actor) => actor.name ?? "?");
      return result;
    }, (result) => showResult(this.sender.result, result, { what: "Assist", notes: [
      ...(result?.onPanel?.length ? [`Rolls from their Rollbox panel: ${result.onPanel.join(", ")}.`] : []),
      ...(result?.card ? ["Assist card posted."] : [])] }));
  }

  /** Returns the characters here whose assist group is taken into this assist. */
  groupsIn(choice) {
    const inIt = new Set([...choice.helpers, ...choice.rollers].map((entry) => actorKey(entry.actor)));
    return this.actors.filter((actor) => groupOf(actor) && inIt.has(actorKey(actor)));
  }

  /** Marks each group taken in as sent, replacing an earlier send, and clears each group left out. */
  async tellGroups(choice, label) {
    const inIt = new Set(this.groupsIn(choice).map(actorKey));
    for (const actor of this.actors) {
      if (!groupOf(actor)) continue;
      if (!inIt.has(actorKey(actor))) await clearGroup(actor);
      else await markSent(actor, { use: this.state.use, difficulty: choice.difficulty, label,
        helpers: choice.helpers, rollers: choice.rollers });
    }
  }

  update() {
    const { use, against } = this.state;
    for (const tiles of this.tiles) tiles.sync();

    for (const row of this.rows) {
      const marked = this.state.targets.has(row.key);
      const target = countsAsTarget(this.state, row.actor);
      row.element.classList.toggle("rollbox-assist-is-target", target);
      row.value.textContent = String(valueOf(row.actor, target ? against : use) ?? NO_VALUE);
      row.target.setAttribute("aria-pressed", String(marked));
      row.target.disabled = !marked && valueOf(row.actor, against) === null;
    }

    const plan = this.plan();
    if (plan.targets.length) {
      if (this.againstLine.text !== String(plan.against)) this.againstLine.set(String(plan.against));
    } else if (this.againstLine.text !== this.state.typed) this.againstLine.set(this.state.typed);
    this.againstCaption.textContent = plan.targets.length
      ? `${STATS[use]} against ${plan.targets.map((t) => t.name).join(" + ")}`
      : `${STATS[use]} against ${STATS[against]}`;

    const missing = this.missing(plan);
    this.drawOutcome(missing ? null : plan.choice);
    this.sendButton.textContent = plan.choice && !missing ? sendLabel(plan.choice.rollers.map((r) => r.actor)) : "Send";
    this.sender.ready(missing, this.sending);
    this.cardChanged();
  }
}
