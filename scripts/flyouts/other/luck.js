/** The Other flyout's Luck tab: a Luck check, or the Group Luck roll for two or more. See docs/other-flyout.md. */
import { actorKey, element } from "../../utils.js";
import { attributes, lowestLuck } from "../../skill-values/index.js";
import { checkRequest, send } from "../../roll-requests/index.js";
import {
  button, howRows, runSend, sendLabel, sendSection, showResult, textInput, whoLine
} from "../flyout.js";

const NO_LUCK = "No Luck";

const MISSING = Object.freeze({ group: "Pick who rolls for the group.", noLuck: "No Luck on this sheet." });

const luckOf = (actor) => attributes(actor).find((a) => a.key === "lck")?.value ?? null;

/** Builds and sends the Luck tab. */
export class LuckSection {
  /**
   * @param {HTMLElement} body empty
   * @param {Actor[]} actors at least one
   * @param {{everyone?: boolean}} [options] `everyone`: nothing is selected, so every investigator
   */
  constructor(body, actors, { everyone = false } = {}) {
    this.body = body;
    this.actors = actors;
    this.everyone = everyone === true;
    this.state = { difficulty: "regular", dice: 0, blind: false, label: "", groupLuck: false, groupPick: null };
    this.sending = false;
  }

  build() {
    const what = element("div", "rollbox-section");
    this.groupLine = element("div", "rollbox-other-group");
    what.append(this.everyone ? whoLine(this.actors, { everyone: true }) : this.luckList(), this.groupLine);
    this.body.append(what, this.optionsBlock(), this.sendBlock());
    this.update();
  }

  luckList() {
    const list = element("div", "rollbox-other-luck-list");
    for (const actor of this.actors) {
      const row = element("div", "rollbox-other-luck-row");
      const name = element("span", "rollbox-other-luck-name", actor.name ?? "");
      name.title = actor.name ?? "";
      const luck = luckOf(actor);
      if (luck === null) row.classList.add("rollbox-other-luck-none");
      row.append(name, element("span", "rollbox-other-luck-value", luck === null ? NO_LUCK : `Luck ${luck}`));
      list.append(row);
    }
    return list;
  }

  optionsBlock() {
    const block = element("div", "rollbox-section");
    this.how = howRows(this.state, () => this.update());
    this.labelInput = textInput("rollbox-other-label", "Label (optional), e.g. is the cab still there?",
      "Label shown to the player");
    this.labelInput.addEventListener("input", () => { this.state.label = this.labelInput.value; this.update(); });
    block.append(this.how.element, this.labelInput);
    return block;
  }

  /** Tells whether the Group Luck roll is offered: two or more selected, someone with Luck. */
  groupOffered() {
    return !this.everyone && this.actors.length > 1 && lowestLuck(this.actors).length > 0;
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

  // CoC7 can't roll Luck for a sheet without one (most creatures), so those are left out.
  targets() {
    if (!(this.groupOffered() && this.state.groupLuck)) {
      return this.everyone ? this.actors : this.actors.filter((actor) => luckOf(actor) !== null);
    }
    const lowest = lowestLuck(this.actors);
    if (lowest.length === 1) return lowest;
    const pick = lowest.find((actor) => actorKey(actor) === this.state.groupPick);
    return pick ? [pick] : [];
  }

  sendBlock() {
    this.whisperButton = button("rollbox-btn rollbox-other-action rollbox-primary", "", () => this.send());
    this.sender = sendSection([this.whisperButton]);
    return this.sender.element;
  }

  request() {
    return checkRequest({ checks: [{ kind: "attribute", name: "lck" }], difficulty: this.state.difficulty,
      dice: this.state.dice, blind: this.state.blind, label: this.state.label });
  }

  send() {
    const request = this.request();
    const targets = this.targets();
    if (!request || !targets.length) return;
    runSend(this, () => send(request, targets),
      (result) => showResult(this.sender.result, result, { what: "Luck check" }));
  }

  /**
   * Applies a Luck click's starting state: `plain` resets the options to a plain Regular check; `send` sends it.
   * @param {{plain?: boolean, send?: boolean}} start
   */
  apply({ plain = false, send: now = false } = {}) {
    if (plain) {
      Object.assign(this.state, { difficulty: "regular", dice: 0, blind: false, label: "" });
      if (this.labelInput) this.labelInput.value = "";
    }
    this.update();
    if (now) this.send();
  }

  update() {
    this.how.sync();
    this.how.blind.on = this.state.blind;
    this.drawGroupLine();
    const targets = this.targets();
    // With no one to roll (no Luck on the sheets), the greyed button still names who is selected.
    const named = targets.length || this.groupOffered() ? targets : this.actors;
    this.whisperButton.textContent = sendLabel(named, { everyone: this.everyone });
    this.sender.ready(targets.length ? null : this.missing(), this.sending);
  }

  /** Returns why nobody can roll: no sheet has Luck, or a tied Group Luck roll waits for its pick. */
  missing() {
    return this.actors.some((actor) => luckOf(actor) !== null) ? MISSING.group : MISSING.noLuck;
  }
}
