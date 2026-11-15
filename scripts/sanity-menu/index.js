/**
 * Sanity menu: what the Keeper's Sanity button opens. The Keeper sets the loss on a success and on a failure
 * (typed, a preset or the dice picker), what caused it and the creature, and sends CoC7's Sanity check to the
 * selected characters through roll-requests/. CoC7's card rolls, and the Keeper applies the loss on it. No
 * Blind, difficulty or dice (CoC7's Sanity request has none). Layout and rules: DESIGN.md, "Sanity menu".
 * Keeper only: registered only on the Keeper's client.
 */
import { NO_VALUE, element, getSetting, isKeeper } from "../utils.js";
import { registerMenu } from "../mini-sheet/index.js";
import { attributes } from "../skill-values/index.js";
import { sanityLoss, sanityRequest, send } from "../roll-requests/index.js";
import {
  button, captioned, customDice, dicePicker, hideWhenSimplified, requestLabel, runSend, sendSection, showResult,
  textInput, valueBox, valueLine
} from "../shared/index.js";

/** The common losses, success/failure, as DESIGN.md lists them ("Sanity menu"). */
export const PRESETS = Object.freeze([
  ["0", "1"], ["0", "1D3"], ["0", "1D6"], ["1", "1D4+1"],
  ["1", "1D6"], ["1D3", "1D10"], ["1D6", "1D20"], ["1D10", "1D100"]
].map(([success, failure]) => Object.freeze({ success, failure })));

/** The loss line's starting value (DESIGN.md, Sanity menu: "0 / 1D6"). */
const START = Object.freeze({ success: "0", failure: "1D6" });
/** The status line, in red, while either side of the loss line isn't a loss. */
const LOSS_HINT = "A loss is a number or dice, e.g. 2, 1D6 or 1D6+1D4.";

/**
 * ready: plug the Sanity menu into the Keeper's panel. Does nothing for players or with the Rollbox
 * switch off (the panel isn't there either).
 * @returns {boolean} true when the menu was registered.
 */
export function registerSanityMenu() {
  if (!isKeeper() || !getSetting("rollboxEnabled")) return false;
  return registerMenu("sanity", { title: "Sanity check", render: renderSanityMenu });
}

/**
 * The menu host's render: builds the whole menu from scratch for these characters. Called when the menu
 * opens and again when the selection changes while it is open.
 * @param {HTMLElement} body the flyout's body, already empty
 * @param {{actors: Actor[]}} context the selected characters
 */
export function renderSanityMenu(body, { actors = [] } = {}) {
  if (!actors.length) return;
  new SanityMenu(body, actors).build();
}

/**
 * The link's label when "What caused it" is empty, so players see "Sanity (1/1D6)" rather than CoC7's
 * "[regular] SAN loss(0) (1/1D6)" (the "(0)" is the `poolModifier:0` the Sanity link must keep).
 * @param {string} success
 * @param {string} failure
 * @returns {string}
 */
function defaultCause(success, failure) {
  return `Sanity (${success}/${failure})`;
}

/**
 * The link's label: with "What caused it" filled in, "Sanity check · Seeing a ghoul", so the players still
 * see that it's a Sanity check, never the loss numbers; empty, the default above.
 * @param {string} cause what the Keeper typed
 * @param {{success: string, failure: string}} losses
 * @returns {string}
 */
function causeLabel(cause, { success, failure }) {
  const text = String(cause ?? "").trim();
  return text ? `Sanity check · ${text}` : defaultCause(success, failure);
}

// --- Small helpers -------------------------------------------------------------------------------

/** "45 / 99", or "45" without a max; null without a SAN value. */
function sanText(actor) {
  const san = attributes(actor).find((a) => a.key === "san");
  if (san?.value === null || san?.value === undefined) return null;
  return san.max === null || san.max === undefined ? String(san.value) : `${san.value} / ${san.max}`;
}

// --- The menu ------------------------------------------------------------------------------------

class SanityMenu {
  /**
   * @param {HTMLElement} body
   * @param {Actor[]} actors
   */
  constructor(body, actors) {
    this.body = body;
    this.actors = actors;
    this.state = { cause: "", creature: "" };
    this.sending = false;
  }

  build() {
    this.body.append(this.sanList(), this.lossSection(), this.causeSection(), this.sendBlock());
    this.update();
  }

  /** Each selected character's current SAN; one without a SAN value is marked, and send() skips it. */
  sanList() {
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

  /** The loss line (success / failure), the presets under it, and the Custom button with a picker for each side. */
  lossSection() {
    const section = element("div", "rollbox-section");
    // The loss rule is roll-requests' own (sanityLoss), so the line and the request always agree.
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

  /** "What caused it" (the label) and "Creature" (CoC7's record): placeholders only. */
  causeSection() {
    const section = element("div", "rollbox-section");
    const field = (key, className, placeholder, ariaLabel) => {
      const input = textInput(className, placeholder, ariaLabel);
      input.addEventListener("input", () => { this.state[key] = input.value; });
      section.append(input);
    };
    field("cause", "rollbox-sanity-cause", "What caused it (optional)", "What caused it, shown to the players");
    field("creature", "rollbox-sanity-creature", "Creature, e.g. Ghoul (optional)", "Creature");
    return section;
  }

  // --- Sending ---

  sendBlock() {
    this.whisperButton = button("rollbox-btn rollbox-sanity-action rollbox-primary", "", () => this.send("whisper"));
    const chat = button("rollbox-btn rollbox-sanity-action", "Send to chat", () => this.send("chat"));
    this.sender = sendSection([this.whisperButton, chat]);
    return this.sender.element;
  }

  /** The losses on the line (an empty side is 0). Null while either side isn't a loss. */
  losses() {
    const success = this.successLine.value;
    const failure = this.failureLine.value;
    return success && failure ? { success, failure } : null;
  }

  /** The request through roll-requests' sanityRequest, labelled by causeLabel. */
  request() {
    const losses = this.losses();
    if (!losses) return null;
    return sanityRequest({ ...losses, cause: causeLabel(this.state.cause, losses), creature: this.state.creature });
  }

  send(mode) {
    const request = this.request();
    if (!request) return;
    runSend(this, () => send(request, this.actors, { mode }), (result) => showResult(this.sender.result, result, {
      what: "Sanity check", mode,
      notes: result?.requested?.length || result?.rolled?.length ? ["Click Apply on CoC7's card to take the loss."] : []
    }));
  }

  // --- Redraw of the parts that depend on the state ---

  update() {
    const success = this.successLine.value;
    const failure = this.failureLine.value;
    for (const node of this.presetButtons) {
      const pressed = success === node.dataset.success && failure === node.dataset.failure;
      node.setAttribute("aria-pressed", String(pressed));
    }
    this.custom.sync();

    this.whisperButton.textContent = requestLabel(this.actors);
    // A loss that isn't one blocks sending; everything else here is optional.
    this.sender.ready(this.losses() ? null : LOSS_HINT, this.sending);
  }
}
