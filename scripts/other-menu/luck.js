/**
 * The Other menu's Luck section (Void, 2026-11-15): a Luck check for the selected characters, laid out like every
 * menu (what, how, send). With two or more, the Group Luck roll: only the character with the lowest Luck rolls, and
 * the Keeper picks on a tie (Keeper Rulebook pp. 89-90). Sent through roll-requests/ as CoC7's Luck attribute
 * check; this file builds no request text. Layout and rules: DESIGN.md, "Other menu".
 */
import { NO_VALUE, actorKey, element } from "../utils.js";
import { attributes, lowestLuck } from "../skill-values/index.js";
import { checkRequest, send } from "../roll-requests/index.js";
import { button, howRows, requestLabel, runSend, sendSection, showResult, textInput } from "../shared/index.js";

/** The status line, in red, while something required is missing (the buttons are greyed out until then). */
const MISSING = Object.freeze({ group: "Pick who rolls for the group." });

/** A character's Luck, or null when the sheet has none. */
const luckOf = (actor) => attributes(actor).find((a) => a.key === "lck")?.value ?? null;

export class LuckSection {
  /**
   * @param {HTMLElement} body the section's place, already empty
   * @param {Actor[]} actors the selected characters, at least one
   */
  constructor(body, actors) {
    this.body = body;
    this.actors = actors;
    this.state = { difficulty: "regular", dice: 0, blind: false, label: "", groupLuck: false, groupPick: null };
    this.sending = false;
  }

  build() {
    const what = element("div", "rollbox-section");
    this.groupLine = element("div", "rollbox-other-group");
    what.append(this.luckList(), this.groupLine);
    this.body.append(what, this.optionsBlock(), this.sendBlock());
    this.update();
  }

  /** Each selected character's Luck, muted. */
  luckList() {
    const list = element("div", "rollbox-other-luck-list");
    for (const actor of this.actors) {
      const row = element("div", "rollbox-other-luck-row");
      const name = element("span", "rollbox-other-luck-name", actor.name ?? "");
      name.title = actor.name ?? "";
      row.append(name, element("span", "rollbox-other-luck-value", `Luck ${luckOf(actor) ?? NO_VALUE}`));
      list.append(row);
    }
    return list;
  }

  /** How: Difficulty and Dice with the Blind toggle beside them, then the label. */
  optionsBlock() {
    const block = element("div", "rollbox-section");
    this.how = howRows(this.state, () => this.update());
    this.labelInput = textInput("rollbox-other-label", "Label (optional), e.g. is the cab still there?",
      "Label shown to the player");
    this.labelInput.addEventListener("input", () => { this.state.label = this.labelInput.value; this.update(); });
    block.append(this.how.element, this.labelInput);
    return block;
  }

  // --- Group Luck roll (Keeper Rulebook pp. 89-90) ---

  /** Offered with two or more characters when someone has a Luck value. */
  groupOffered() {
    return this.actors.length > 1 && lowestLuck(this.actors).length > 0;
  }

  drawGroupLine() {
    this.groupLine.replaceChildren();
    this.groupLine.hidden = !this.groupOffered();
    if (this.groupLine.hidden) return;
    const lowest = lowestLuck(this.actors);
    const luck = luckOf(lowest[0]);
    const toggle = element("label", "rollbox-line");
    const box = element("input");
    box.type = "checkbox";
    box.checked = this.state.groupLuck;
    box.addEventListener("change", () => { this.state.groupLuck = box.checked; this.update(); });
    toggle.append(box, element("span", "", "Group Luck roll: only the lowest Luck rolls"));
    this.groupLine.append(toggle);
    if (!this.state.groupLuck) return;
    if (lowest.length === 1) {
      this.groupLine.append(element("div", "rollbox-hint rollbox-other-hint", `${lowest[0].name} rolls (Luck ${luck}).`));
      return;
    }
    // A tie: the Keeper picks who rolls for the group.
    this.groupLine.append(element("div", "rollbox-hint rollbox-other-hint", `Tied at Luck ${luck}. Who rolls?`));
    const picks = element("div", "rollbox-segmented");
    for (const actor of lowest) {
      const node = button("rollbox-btn rollbox-segment", actor.name ?? "", () => {
        this.state.groupPick = actorKey(actor);
        this.update();
      });
      node.setAttribute("aria-pressed", String(this.state.groupPick === actorKey(actor)));
      picks.append(node);
    }
    this.groupLine.append(picks);
  }

  /** Who the request goes to: everyone selected, or for a group Luck roll the one lowest-Luck character. */
  targets() {
    if (!(this.groupOffered() && this.state.groupLuck)) return this.actors;
    const lowest = lowestLuck(this.actors);
    if (lowest.length === 1) return lowest;
    const pick = lowest.find((actor) => actorKey(actor) === this.state.groupPick);
    return pick ? [pick] : [];
  }

  // --- Sending ---

  sendBlock() {
    this.whisperButton = button("rollbox-btn rollbox-other-action rollbox-primary", "", () => this.send("whisper"));
    const chat = button("rollbox-btn rollbox-other-action", "Send to chat", () => this.send("chat"));
    const link = button("rollbox-btn rollbox-other-action rollbox-other-link rollbox-icon-action", "",
      () => this.send("link"));
    link.setAttribute("aria-label", "Copy link");
    const glyph = element("i", "fa-solid fa-link");
    glyph.setAttribute("aria-hidden", "true");
    link.append(glyph);
    this.sender = sendSection([this.whisperButton, chat, link]);
    return this.sender.element;
  }

  /** CoC7's Luck check with the current options, through roll-requests' checkRequest. */
  request() {
    return checkRequest({ checks: [{ kind: "attribute", name: "lck" }], difficulty: this.state.difficulty,
      dice: this.state.dice, blind: this.state.blind, label: this.state.label });
  }

  send(mode) {
    const request = this.request();
    const targets = this.targets();
    if (!request || !targets.length) return;
    runSend(this, () => send(request, targets, { mode }),
      (result) => showResult(this.sender.result, result, { what: "Luck check", mode }));
  }

  /**
   * A starting state, from a click on the mini sheet's Luck: `plain` puts the options back to a Regular check with
   * no dice, not blind and no label; `send` then sends it ("whisper" or "link").
   * @param {{plain?: boolean, send?: "whisper"|"link"}} start
   */
  apply({ plain = false, send: mode } = {}) {
    if (plain) {
      Object.assign(this.state, { difficulty: "regular", dice: 0, blind: false, label: "" });
      this.labelInput.value = "";
    }
    this.update();
    if (mode) this.send(mode);
  }

  update() {
    this.how.sync();
    this.how.blind.on = this.state.blind;
    this.drawGroupLine();
    const targets = this.targets();
    this.whisperButton.textContent = requestLabel(targets);
    // Greyed out until everything required is there; the red line says what is missing.
    this.sender.ready(targets.length ? null : MISSING.group, this.sending);
  }
}
