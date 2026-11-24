/** The Check flyout's Sanity tab, with its own loss, cause and send section. See docs/sanity-flyout.md. */
import { NO_VALUE, element } from "../../utils.js";
import { attributes } from "../../skill-values/index.js";
import { checkRequest, sanityLoss, sanityRequest, send } from "../../roll-requests/index.js";
import { button, runSend, sendLabel, sendSection, showResult, textInput, whoLine } from "../flyout.js";
import { captioned, customDice, dicePicker, hideWhenSimplified, valueBox, valueLine } from "../../shared/index.js";

/** The common Sanity losses as success/failure pairs, in display order. */
export const PRESETS = Object.freeze([
  ["0", "1"], ["0", "1D3"], ["0", "1D6"], ["1", "1D4+1"],
  ["1", "1D6"], ["1D3", "1D10"], ["1D6", "1D20"], ["1D10", "1D100"]
].map(([success, failure]) => Object.freeze({ success, failure })));

const START = Object.freeze({ success: "0", failure: "1D6" });
const LOSS_HINT = "A loss is a number or dice, e.g. 2, 1D6 or 1D6+1D4.";

const PLAIN = Object.freeze({ success: "0", failure: "0" });

// Without a label CoC7 8.15 shows "SAN loss(0)", the (0) being the poolModifier the Sanity link must keep.
function defaultCause(success, failure) {
  return `Sanity (${success}/${failure})`;
}

/** Returns the link's label: the check first, then the cause; never the loss numbers once a cause is typed. */
function causeLabel(cause, { success, failure }) {
  const text = String(cause ?? "").trim();
  return text ? `Sanity check · ${text}` : defaultCause(success, failure);
}

/** Returns the character's SAN, with its max when known; null without a SAN value. */
function sanText(actor) {
  const san = attributes(actor).find((a) => a.key === "san");
  if (san?.value === null || san?.value === undefined) return null;
  return san.max === null || san.max === undefined ? String(san.value) : `${san.value} / ${san.max}`;
}

/** Builds and sends the Sanity tab; the Check flyout shows its parts while the tab is chosen. */
export class SanityTab {
  /**
   * @param {Actor[]} actors
   * @param {{everyone?: boolean}} [options] `everyone`: nothing is selected, so every investigator
   */
  constructor(actors, { everyone = false } = {}) {
    this.actors = actors;
    this.everyone = everyone === true;
    this.state = { cause: "", creature: "" };
    this.sending = false;
  }

  /**
   * Builds the tab's parts.
   * @returns {{who: HTMLElement, parts: HTMLElement[]}} `who` replaces the flyout's who line
   */
  build() {
    const built = { who: this.sanList(), parts: [this.lossSection(), this.causeSection(), this.sendBlock()] };
    this.update();
    return built;
  }

  sanList() {
    if (this.everyone) return whoLine(this.actors, { everyone: true, className: "rollbox-sanity-list" });
    const list = element("div", "rollbox-sanity-list");
    for (const actor of this.actors) {
      const san = sanText(actor);
      const row = element("div", "rollbox-sanity-row");
      const name = element("span", "rollbox-sanity-name", actor.name ?? "");
      name.title = actor.name ?? "";
      row.append(name, element("span", "rollbox-sanity-value", san === null ? `${NO_VALUE} skipped` : `SAN ${san}`));
      list.append(row);
    }
    return list;
  }

  lossSection() {
    const section = element("div", "rollbox-section");
    // roll-requests' own loss rule, so the line and the request always agree.
    const line = (label, value) => valueLine({ label, value, check: (text) => sanityLoss(text),
      onChange: () => this.update() });
    this.successLine = line("SAN lost on a success", START.success);
    this.failureLine = line("SAN lost on a failure", START.failure);
    this.successLine.element.classList.add("rollbox-sanity-success");
    this.failureLine.element.classList.add("rollbox-sanity-failure");

    const presets = element("div", "rollbox-sanity-presets");
    presets.setAttribute("role", "group");
    presets.setAttribute("aria-label", "Common losses");
    this.presetButtons = PRESETS.map((preset) => {
      const node = button("rollbox-btn rollbox-segment rollbox-sanity-preset", `${preset.success}/${preset.failure}`,
        () => this.choose(preset));
      node.dataset.success = preset.success;
      node.dataset.failure = preset.failure;
      return node;
    });
    presets.append(...this.presetButtons);
    hideWhenSimplified(presets);

    const picker = (label, line) => dicePicker({ label, line, onChange: () => this.update() });
    this.custom = customDice({ label: "Custom success or failure loss",
      pickers: [picker("On a success", this.successLine), picker("On a failure", this.failureLine)] });

    section.append(valueBox([captioned(this.successLine, "success"), captioned(this.failureLine, "failure")]),
      presets, this.custom.element);
    return section;
  }

  choose({ success, failure }) {
    this.successLine.set(success);
    this.failureLine.set(failure);
    this.update();
  }

  causeSection() {
    const section = element("div", "rollbox-section");
    this.inputs = {};
    const field = (key, className, placeholder, ariaLabel) => {
      const input = textInput(className, placeholder, ariaLabel);
      input.addEventListener("input", () => { this.state[key] = input.value; });
      this.inputs[key] = input;
      section.append(input);
    };
    field("cause", "rollbox-sanity-cause", "What caused it (optional)", "What caused it, shown to the players");
    field("creature", "rollbox-sanity-creature", "Creature, e.g. Ghoul (optional)", "Creature");
    return section;
  }

  sendBlock() {
    this.whisperButton = button("rollbox-btn rollbox-sanity-action rollbox-primary", "", () => this.send());
    this.sender = sendSection([this.whisperButton]);
    return this.sender.element;
  }

  /** Returns both sides of the loss line, or null while either isn't a loss. */
  losses() {
    const success = this.successLine.value;
    const failure = this.failureLine.value;
    return success && failure ? { success, failure } : null;
  }

  request() {
    const losses = this.losses();
    if (!losses) return null;
    return sanityRequest({ ...losses, cause: causeLabel(this.state.cause, losses), creature: this.state.creature });
  }

  send() {
    const request = this.request();
    if (!request) return;
    runSend(this, () => send(request, this.actors), (result) => showResult(this.sender.result, result, {
      what: "Sanity check",
      notes: result?.requested?.length || result?.rolled?.length ? ["Click Apply on CoC7's card to take the loss."] : []
    }));
  }

  update() {
    const success = this.successLine.value;
    const failure = this.failureLine.value;
    for (const node of this.presetButtons) {
      const pressed = success === node.dataset.success && failure === node.dataset.failure;
      node.setAttribute("aria-pressed", String(pressed));
    }
    this.custom.sync();

    this.whisperButton.textContent = sendLabel(this.actors, { everyone: this.everyone });
    this.sender.ready(this.losses() ? null : LOSS_HINT, this.sending);
  }

  /** Sends CoC7's plain SAN attribute check, with no Sanity card or loss, as its sheet's Shift click does. */
  sendPlain() {
    const request = checkRequest({ checks: [{ kind: "attribute", name: "san" }] });
    if (!request) return;
    runSend(this, () => send(request, this.actors),
      (result) => showResult(this.sender.result, result, { what: "SAN roll" }));
  }

  /**
   * Applies a SAN click's starting state: `plain` clears the loss and fields; with `send` too it is a plain SAN roll.
   * @param {{plain?: boolean, send?: boolean}} start
   */
  apply({ plain = false, send: now = false } = {}) {
    if (plain) {
      this.choose(PLAIN);
      for (const [key, input] of Object.entries(this.inputs)) {
        input.value = "";
        this.state[key] = "";
      }
    }
    if (plain && now) this.sendPlain();
    else if (now) this.send();
  }
}
