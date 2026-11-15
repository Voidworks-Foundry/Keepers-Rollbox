/**
 * Assist: what the Keeper's Assist button opens with two or more tokens selected, for Physical Human Limits
 * (Keeper Rulebook p. 88–89, summary p. 407): several characters put their STR or SIZ together against
 * something too big for any one of them. Who helps and who rolls is worked out (assistChoices), not picked;
 * Send asks each roller for an ordinary characteristic check through roll-requests/ and posts one public
 * Assist card. Rollbox doesn't read the rolls back. Layout and rules: DESIGN.md, "Assist". Keeper only:
 * registered only on the Keeper's client.
 */
import { NO_VALUE, actorKey, element, escapeHtml, getSetting, isKeeper } from "../utils.js";
import { registerMenu } from "../mini-sheet/index.js";
import { characteristics } from "../skill-values/index.js";
import { checkRequest, send } from "../roll-requests/index.js";
import {
  DIFFICULTY_LABELS, button, captioned, runSend, segmented, sendSection, showResult, statusLine, valueBox, valueLine
} from "../shared/index.js";
import { assistChoices } from "./split.js";

export { assistChoices, difficultyFor } from "./split.js";

/** The two characteristics Physical Human Limits uses (p. 88–89): what the characters put in, and what of the target counts. */
export const STATS = Object.freeze({ str: "STR", siz: "SIZ" });
/** CoC7's actor type for creatures (system.json `documentTypes.Actor`); they start marked as targets. */
const CREATURE_TYPE = "creature";

/** The largest number the line takes when typed (the rulebook's rafter is 150). */
const MAX_AGAINST = 999;
/** The typed line's text: a whole number, nothing else. */
const NUMBER = /^\d{1,3}$/;
/** The request's label when the Keeper types none: "STR · Assist". */
const DEFAULT_LABEL = "Assist";

/** The menu's choices, kept while it stays open and the selection changes; new when it opens. */
let carried = null;

/** A fresh set of choices: Use STR, Against STR, nothing typed, no one left out or marked yet. */
function freshState() {
  return { use: "str", against: "str", typed: "0", targets: new Set(), out: new Set(), seen: new Set(), label: "" };
}

/**
 * ready: plug Assist into the Keeper's panel. Does nothing for players or with the Rollbox switch off (the
 * panel isn't there either).
 * @returns {boolean} true when the menu was registered.
 */
export function registerAssist() {
  if (!isKeeper() || !getSetting("rollboxEnabled")) return false;
  return registerMenu("assist", { title: "Assist", render: renderAssist, staysOpen: true, columns: assistColumns });
}

/**
 * The menu host's render: builds the menu from scratch for these characters. When the selection changed
 * while it was open, the toggles, the typed number, who is left out or marked and the label are kept, so
 * shift-clicking tokens updates it at once. A creature newly selected starts marked as a target.
 * @param {HTMLElement} body the flyout's body, already empty
 * @param {{actors: Actor[], close?: () => void, selectionChanged?: boolean, cardChanged?: () => void}} context
 *   `cardChanged`: tells the panel the names card's column changed (a toggle, a target, someone left out).
 */
export function renderAssist(body, { actors = [], close = () => {}, selectionChanged = false, cardChanged = () => {} } = {}) {
  if (!actors.length) return;
  if (!selectionChanged || !carried) carried = freshState();
  new AssistMenu(body, actors, carried, close, cardChanged).build();
}

/**
 * The names card's value column while Assist is open: headed by the Use characteristic, it shows
 * each participant's Use value and each target's Against value ("STR/SIZ" when a target counts the other one).
 * @param {Actor[]} actors the names card's characters
 * @returns {{label: string, value: (actor: Actor) => (number|string)}[]}
 */
export function assistColumns(actors = []) {
  const state = carried ?? freshState();
  const target = (actor) => countsAsTarget(state, actor);
  const mixed = state.use !== state.against && actors.some(target);
  const label = mixed ? `${STATS[state.use]}/${STATS[state.against]}` : STATS[state.use];
  return [{ label, value: (actor) => valueOf(actor, target(actor) ? state.against : state.use) ?? NO_VALUE }];
}

// --- The Assist card ---------------------------------------------------------------------------

/**
 * The public card's HTML: "Assist", the label, what they put in against what, what's left and its difficulty,
 * who helps, who rolls, and "One success is enough." Static: Rollbox doesn't read the rolls back. It doesn't
 * name the targets or the number to beat (the Keeper's). Every name and the label are escaped.
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

/** Post the Assist card publicly, from the Keeper (not from a selected token). */
async function postCard(card) {
  await ChatMessage.create({ speaker: { alias: game.user?.name ?? "Keeper" }, content: assistCardHtml(card) });
}

// --- Small helpers -------------------------------------------------------------------------------

const percent = (chance) => `${Math.round(chance * 100)}%`;

/** The actor's characteristic (`str`, `siz`), or null when its sheet has none. */
function valueOf(actor, key) {
  const value = characteristics(actor).find((c) => c.key === key)?.value;
  return Number.isFinite(value) ? value : null;
}

/**
 * Whether a character counts as a target now: marked, not left out, and with the Against value. A mark is
 * changed only by the target button (or by typing a number), so a character left out, or without the other
 * Against value, keeps it and counts again when brought back (Void's decision).
 */
function countsAsTarget(state, actor) {
  const key = actorKey(actor);
  return state.targets.has(key) && !state.out.has(key) && valueOf(actor, state.against) !== null;
}

/** CoC7's creature type: such a character starts marked as a target when selected. */
function isCreature(actor) {
  return actor?.type === CREATURE_TYPE;
}

/** The typed line's rule: a whole number from 0 to 999, tidied ("007" → "7"); anything else is refused. */
function againstNumber(text) {
  const typed = String(text ?? "").trim();
  if (!NUMBER.test(typed)) return null;
  const value = Number(typed);
  return value <= MAX_AGAINST ? String(value) : null;
}

// --- The menu ------------------------------------------------------------------------------------

class AssistMenu {
  /**
   * @param {HTMLElement} body
   * @param {Actor[]} actors
   * @param {{use: string, against: string, typed: string, targets: Set<string>, out: Set<string>,
   *   seen: Set<string>, label: string}} state kept across redraws
   * @param {() => void} close
   * @param {() => void} cardChanged
   */
  constructor(body, actors, state, close, cardChanged) {
    this.body = body;
    this.actors = actors;
    this.state = state;
    this.close = close;
    this.cardChanged = cardChanged;
    this.sending = false;
    const keys = new Set(actors.map(actorKey));
    // Characters no longer selected are forgotten; one selected again counts as new.
    for (const set of [state.targets, state.out, state.seen]) {
      for (const key of [...set]) if (!keys.has(key)) set.delete(key);
    }
    // A creature newly selected starts marked as a target; the Keeper can unmark it.
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

  // --- What: the number to beat, Use and Against, the characters ---

  whatSection() {
    const section = element("div", "rollbox-section");

    this.againstLine = valueLine({ label: "Number to beat", value: this.state.typed, check: againstNumber,
      onChange: () => this.typed() });
    this.againstLine.element.classList.add("rollbox-assist-against");
    this.againstPart = captioned(this.againstLine, "");
    this.againstCaption = this.againstPart.querySelector(".rollbox-value-caption");

    this.toggles = [this.toggle("Use", "use"), this.toggle("Against", "against")];
    const toggles = element("div", "rollbox-assist-toggles");
    toggles.append(...this.toggles.map((toggle) => toggle.root));

    this.names = element("div", "rollbox-assist-names");
    this.names.setAttribute("role", "group");
    this.names.setAttribute("aria-label", "Who takes part");
    this.rows = this.actors.map((actor) => this.nameRow(actor));
    this.names.append(...this.rows.map((row) => row.element));

    section.append(valueBox([this.againstPart]), toggles, this.names);
    return section;
  }

  /** One "Use: STR | SIZ" toggle; its buttons set `state[field]`. */
  toggle(label, field) {
    const root = element("div", "rollbox-assist-toggle");
    const row = segmented({ choices: Object.entries(STATS), get: () => this.state[field], label,
      set: (value) => { this.state[field] = value; this.update(); } });
    root.append(element("span", "rollbox-assist-toggle-label", label), row.element);
    return { root, sync: row.sync };
  }

  /** A character's row: the name toggle (name and the value that counts) and the target button on the right. */
  nameRow(actor) {
    const key = actorKey(actor);
    const row = element("div", "rollbox-assist-row");
    const name = button("rollbox-btn rollbox-assist-name", "", () => this.leaveOut(key));
    const who = element("span", "rollbox-assist-name-who", actor.name ?? "");
    who.title = actor.name ?? "";
    const value = element("span", "rollbox-assist-name-value");
    name.append(who, value);
    // A narrow button that just fits its crosshair; the name toggle takes the rest of the row.
    const target = button("rollbox-btn rollbox-assist-target", "", () => this.mark(key));
    const glyph = element("i", "fa-solid fa-crosshairs");
    glyph.setAttribute("aria-hidden", "true");
    target.append(glyph);
    target.setAttribute("aria-label", `${actor.name ?? ""}: target`);
    row.append(name, target);
    return { actor, key, element: row, name, value, target };
  }

  /**
   * Click a name: leave that character out, or bring them back. Their target mark stays: a target left out
   * doesn't count, and counts again as a target when brought back.
   */
  leaveOut(key) {
    if (this.state.out.has(key)) this.state.out.delete(key);
    else this.state.out.add(key);
    this.update();
  }

  /** Click the target button: mark or unmark that character as a target. Does nothing while they're left out. */
  mark(key) {
    if (this.state.out.has(key)) return;
    if (this.state.targets.has(key)) this.state.targets.delete(key);
    else this.state.targets.add(key);
    this.update();
  }

  /** The targets that count, in names-card order, each with their Against value. */
  targets() {
    return this.actors.filter((actor) => countsAsTarget(this.state, actor))
      .map((actor) => ({ actor, name: actor.name ?? "", value: valueOf(actor, this.state.against) }));
  }

  /** The Keeper typed a number: any targets are unmarked. Clicking away from the targets' sum changes nothing. */
  typed() {
    const targets = this.targets();
    const sum = String(targets.reduce((total, t) => total + t.value, 0));
    if (targets.length && this.againstLine.text.trim() === sum) return;
    this.state.typed = this.againstLine.text;
    this.state.targets.clear();
    this.update();
  }

  // --- Result ---

  resultSection() {
    const section = element("div", "rollbox-section");
    section.setAttribute("aria-live", "polite");
    this.outcome = element("div", "rollbox-assist-lists");
    this.status = statusLine("rollbox-assist-missing");
    section.append(this.outcome, this.status.element);
    return section;
  }

  /**
   * Who takes part (everyone selected who isn't left out or a target, with their Use value), the targets, and
   * the number to beat: the targets' Against values added together, or the typed number (null while the typed
   * text is refused).
   */
  plan() {
    const uses = this.state.use;
    const taking = [];
    for (const actor of this.actors) {
      const key = actorKey(actor);
      if (this.state.out.has(key) || this.state.targets.has(key)) continue;
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

  /** A line of the result: who on the left, what on the right. */
  line(className, who, what) {
    const row = element("div", `rollbox-assist-line ${className}`.trim());
    const name = element("span", "rollbox-assist-line-who", who);
    name.title = who;
    row.append(name, element("span", "rollbox-assist-line-what", what));
    return row;
  }

  /** "Assisting" (each helper, −value, or "No one"), "Rolling" (each roller, STR value), then difficulty and chance. */
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

  // --- Label ---

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

  // --- Sending ---

  /** Send to rollers and Cancel; the red line is the one under the result (resultSection). */
  sendBlock() {
    const send = button("rollbox-btn rollbox-assist-primary rollbox-primary", "Send to rollers", () => this.send());
    const cancel = button("rollbox-btn", "Cancel", () => this.close());
    cancel.dataset.keep = "";
    this.sender = sendSection([send, cancel], { status: this.status });
    return this.sender.element;
  }

  /** What is missing or impossible, for the red line, or null. */
  missing({ taking, against, choice }) {
    const vs = STATS[this.state.against];
    if (this.actors.length < 2) return "Select at least one more token.";
    if (!taking.length) return "Include at least one more character.";
    if (against === null) return `Type the ${vs} to beat.`;
    if (!(against > 0)) return `Target someone, or type the ${vs} to beat.`;
    return choice ? null : "Too heavy even together.";
  }

  send() {
    const { choice } = this.plan();
    if (!choice) return;
    const label = this.state.label.trim();
    // With no label typed the players read "STR · Assist".
    const request = checkRequest({ checks: [{ kind: "characteristic", name: this.state.use }],
      difficulty: choice.difficulty, label: label || DEFAULT_LABEL });
    if (!request) return;
    runSend(this, async () => {
      const result = await send(request, choice.rollers.map((r) => r.actor), { mode: "whisper" });
      const asked = new Set([...result.requested, ...result.rolled]);
      const rollers = choice.rollers.filter((r) => asked.has(r.actor)).map((r) => r.name);
      if (rollers.length) {
        await postCard({ use: this.state.use, against: this.state.against, label, left: choice.left,
          difficulty: choice.difficulty, helpers: choice.helpers.map((h) => h.name), rollers });
        result.card = true;
      }
      return result;
    }, (result) => showResult(this.sender.result, result,
      { what: "Assist", notes: result?.card ? ["Assist card posted."] : [] }));
  }

  // --- Redraw of the parts that depend on the state ---

  update() {
    const { use, against } = this.state;
    for (const toggle of this.toggles) toggle.sync();

    for (const row of this.rows) {
      const out = this.state.out.has(row.key);
      const marked = this.state.targets.has(row.key);
      const target = countsAsTarget(this.state, row.actor);
      row.element.classList.toggle("rollbox-assist-out", out);
      row.element.classList.toggle("rollbox-assist-is-target", target);
      row.name.setAttribute("aria-pressed", String(!out));
      row.value.textContent = String(valueOf(row.actor, target ? against : use) ?? NO_VALUE);
      row.target.setAttribute("aria-pressed", String(marked));
      // Left out: the target button does nothing. Unmarked and without the Against value: nothing to mark.
      row.target.disabled = out || (!marked && valueOf(row.actor, against) === null);
    }

    const plan = this.plan();
    // The big line shows the targets' sum; with no target, what the Keeper typed.
    if (plan.targets.length) {
      if (this.againstLine.text !== String(plan.against)) this.againstLine.set(String(plan.against));
    } else if (this.againstLine.text !== this.state.typed) this.againstLine.set(this.state.typed);
    this.againstCaption.textContent = plan.targets.length
      ? `${STATS[use]} against ${plan.targets.map((t) => t.name).join(" + ")}`
      : `${STATS[use]} against ${STATS[against]}`;

    // Greyed out until everything required is there; the red line says what is missing.
    const missing = this.missing(plan);
    this.drawOutcome(missing ? null : plan.choice);
    this.sender.ready(missing, this.sending);
    this.cardChanged();
  }
}
