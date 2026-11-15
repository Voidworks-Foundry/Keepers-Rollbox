/**
 * Opposed roll: what the Keeper's Opposed button opens with exactly two characters selected, in place of the
 * names card: both characters' mini sheets with the opposed card between them. Each side picks one check and
 * up to two bonus or penalty dice; Swap sides changes which one is CoC7's attacker. Create opposed card goes
 * through roll-requests/, which makes CoC7's card with both sides and clicks its Start rolls. No difficulty
 * (the other side's result is the difficulty, p. 92), no push (p. 90), no Sanity. Layout and rules: DESIGN.md,
 * "Opposed roll". Keeper only: registered only on the Keeper's client.
 */
import { NO_VALUE, actorKey, element, getSetting, isKeeper } from "../utils.js";
import { miniSheet, registerMenu } from "../mini-sheet/index.js";
import { checkChoices } from "../skill-values/index.js";
import { opposedRequest, ownersOf, send } from "../roll-requests/index.js";
import {
  CHECK_TABS, button, diceChoices, diceText, filterRows, line, runSend, segmented, sendSection, showResult
} from "../shared/index.js";

const MISSING_HINT = "Not on the sheet: CoC7 adds it at its base value when the card is made.";
/**
 * CoC7's opposed card marks its first side attacker (crossed swords) and its second defender (shield)
 * (`newGroupMessage`, `apps/chat-opposed-message.js`); the left-hand character is the first side. A card
 * can't be made without the two roles: CoC7 8.15 resets each side to no role when it adds it, gives the two
 * sides attacker and defender, and compares only when one is each (BUILD-GUIDE "Cards: opposed").
 */
const ROLES = Object.freeze(["Attacker", "Defender"]);

/**
 * ready: plug the Opposed roll into the Keeper's panel, in place of the names card. Does nothing for
 * players or with the Rollbox switch off (the panel isn't there either).
 * @returns {boolean} true when it was registered.
 */
export function registerOpposedRoll() {
  if (!isKeeper() || !getSetting("rollboxEnabled")) return false;
  return registerMenu("opposed", { title: "Opposed roll", layout: "replace", render: renderOpposedRoll });
}

/**
 * The menu host's render: builds the whole view from scratch for the two selected characters. Called when
 * the Opposed button is clicked and again when the selection changes to two other characters.
 * @param {HTMLElement} stage where the view goes, in place of the names card, already empty
 * @param {{actors: Actor[], close: () => void, start?: {first?: string, picks?: Object<string, string>,
 *   create?: boolean}}} context the selected characters; `close` is Cancel; `start`, from right clicks on the mini
 *   sheet: `first` is the character (by uuid) to put on the left, CoC7's first side; `picks` each character's check
 *   row key ("characteristic:str"); `create` makes the card at once.
 */
export function renderOpposedRoll(stage, { actors = [], close = () => {}, start } = {}) {
  if (actors.length !== 2) return;
  const view = new OpposedView(stage, actors, close, start);
  view.build();
  if (start?.create) view.create();
}

// --- Small helpers -------------------------------------------------------------------------------

/**
 * Who rolls this side once the card is made, for the result. CoC7's Start rolls rolls every side with no
 * player owner online (`rollNoPlayers`, `apps/chat-opposed-message.js`); Rollbox clicks it for the Keeper.
 */
function whoRolls(actor) {
  const owners = ownersOf(actor);
  if (owners === null) return "";
  if (!owners.length) return "Keeper rolls (NPC), by Start rolls";
  const online = owners.filter((user) => user.active);
  if (!online.length) return "Keeper rolls (player offline), by Start rolls";
  return `${online.map((user) => user.name).filter(Boolean).join(", ")} rolls on the card`;
}

const known = (value) => value !== null && value !== undefined;

/** A side's starting pick, by its row key (from a right click on the mini sheet), with that row's tab. */
function startPick(actor, picks) {
  const key = picks?.[actorKey(actor)];
  if (!key) return {};
  const choices = checkChoices(actor);
  for (const tab of CHECK_TABS) {
    const pick = choices[tab.id].find((row) => row.key === key);
    if (pick) return { tab: tab.id, pick };
  }
  return {};
}

/**
 * The line that settles a tie (Keeper Rulebook p. 91): CoC7's card shows only "Tie" on equal success
 * levels, so the Keeper is told which side has the higher value. Compares the two values, never dice.
 * @returns {string} "" when a value is unknown.
 */
function tieText(sides) {
  const [a, b] = sides;
  if (!known(a.pick?.value) || !known(b.pick?.value)) return "";
  if (a.pick.value === b.pick.value) {
    return `On a Tie: equal values (${a.pick.value}), so a stalemate or both re-roll (p. 91).`;
  }
  const [high, low] = a.pick.value > b.pick.value ? [a, b] : [b, a];
  return `On a Tie: ${high.actor.name} wins, higher value (${high.pick.name} ${high.pick.value} `
    + `vs ${low.pick.name} ${low.pick.value}, p. 91).`;
}

/** What is missing before the card can be made: "Pick a check for both sides." or "Pick a check for Alice." */
function missingText(sides) {
  const open = sides.filter((side) => !side.pick);
  if (!open.length) return "";
  return open.length > 1 ? "Pick a check for both sides." : `Pick a check for ${open[0].actor.name ?? "the other side"}.`;
}

// --- The view ------------------------------------------------------------------------------------

class OpposedView {
  /**
   * @param {HTMLElement} stage
   * @param {Actor[]} actors exactly two, in selection order
   * @param {() => void} close
   * @param {object} [start] sides and picks to start with (renderOpposedRoll)
   */
  constructor(stage, actors, close, start) {
    this.stage = stage;
    this.close = close;
    /** One side per character: its tab, its picked check (or null), its dice and its skill search. */
    this.sides = actors.map((actor) => ({ actor, tab: CHECK_TABS[0].id, pick: null, dice: 0, search: "",
      ...startPick(actor, start?.picks) }));
    if (start?.first && actorKey(this.sides[1].actor) === start.first) this.sides.reverse();
    this.sending = false;
    this.made = false;
  }

  build() {
    const card = element("section", "rollbox-card rollbox-opposed-card");
    card.setAttribute("aria-label", "Opposed roll");
    this.blocks = this.sides.map((side, index) => this.sideBlock(side, index));
    card.append(element("h3", "rollbox-flyout-title", "Opposed roll"), this.blocks[0].root, this.swapBlock(),
      this.blocks[1].root, this.sendBlock());
    const sheets = this.sides.map((side) => {
      const sheet = miniSheet(side.actor);
      sheet.classList.add("rollbox-opposed-sheet");
      return sheet;
    });
    this.stage.append(sheets[0], card, sheets[1]);
    for (const block of this.blocks) this.drawList(block);
    this.update();
  }

  // --- One side ---

  /**
   * One side: its header, the two tabs, the skill search, the list for the open tab, the dice, and a note on a
   * missing skill. `index` 0 is the left-hand side, CoC7's first (attacker).
   */
  sideBlock(side, index) {
    const root = element("div", "rollbox-opposed-side");
    root.dataset.actor = side.actor.uuid ?? side.actor.name ?? "";
    root.dataset.role = ROLES[index].toLowerCase();
    // The same rows as the Check menu's tabs.
    const block = { root, side, rows: [], choices: checkChoices(side.actor) };
    block.list = element("div", "rollbox-opposed-list");
    block.list.setAttribute("role", "listbox");
    block.missing = element("div", "rollbox-hint rollbox-opposed-hint", MISSING_HINT);
    root.append(this.head(block, index), this.tabs(block), this.search(block), block.list, this.diceRow(block),
      block.missing);
    return block;
  }

  /** Its role on CoC7's card, the name, and the picked check ("STR 40 +1"). */
  head(block, index) {
    const head = element("div", "rollbox-opposed-head");
    const name = element("span", "rollbox-opposed-name", block.side.actor.name ?? "");
    name.title = block.side.actor.name ?? "";
    block.picked = element("span", "rollbox-opposed-pick");
    head.append(element("span", "rollbox-opposed-role", ROLES[index]), name, block.picked);
    return head;
  }

  /** Characteristic, Skill: a click draws that tab's list. */
  tabs(block) {
    const tabs = element("div", "rollbox-opposed-tabs");
    tabs.setAttribute("role", "tablist");
    block.tabButtons = CHECK_TABS.map((tab) => {
      const node = button("rollbox-btn rollbox-tab rollbox-opposed-tab", tab.label, () => {
        block.side.tab = tab.id;
        this.drawList(block);
        this.update();
      });
      node.dataset.tab = tab.id;
      node.setAttribute("role", "tab");
      return node;
    });
    tabs.append(...block.tabButtons);
    return tabs;
  }

  /** The skill search; its text is kept when Swap draws the view again. */
  search(block) {
    const { side } = block;
    block.search = element("input", "rollbox-input");
    block.search.type = "search";
    block.search.placeholder = "Search skills";
    block.search.setAttribute("aria-label", `Search ${side.actor.name ?? ""}'s skills`);
    block.search.value = side.search;
    block.search.addEventListener("input", () => {
      side.search = block.search.value;
      this.filter(block);
    });
    return block.search;
  }

  /** Bonus and penalty dice, at most two either way (p. 91). */
  diceRow(block) {
    const { side } = block;
    block.dice = segmented({ choices: diceChoices(), get: () => String(side.dice),
      set: (value) => { side.dice = Number(value); this.update(); },
      label: `${side.actor.name ?? ""}: bonus or penalty dice` });
    const row = line("Dice", block.dice.element);
    row.classList.add("rollbox-opposed-line");
    return row;
  }

  /** The rows of the side's open tab: each a button with the name and the value; the picked one is pressed. */
  drawList(block) {
    const { side } = block;
    for (const node of block.tabButtons) node.setAttribute("aria-selected", String(node.dataset.tab === side.tab));
    block.search.hidden = side.tab !== "skill";
    block.rows = [];
    block.divider = null;
    const nodes = [];
    // Skills: trained first, a divider, then every other skill A–Z at its base value.
    for (const choice of block.choices[side.tab]) {
      if (!choice.trained && !block.divider) {
        block.divider = element("div", "rollbox-divider", "Untrained · base value");
        nodes.push(block.divider);
      }
      nodes.push(this.row(block, choice));
    }
    block.list.replaceChildren(...nodes);
    this.filter(block);
  }

  row(block, pick) {
    const node = button("rollbox-opposed-row", "", () => {
      block.side.pick = pick;
      this.update();
    });
    node.dataset.key = pick.key;
    node.setAttribute("role", "option");
    node.append(element("span", "rollbox-opposed-row-name", pick.name),
      element("span", "rollbox-opposed-row-value", known(pick.value) ? String(pick.value) : NO_VALUE));
    block.rows.push({ node, name: pick.name });
    return node;
  }

  /** The skill search (only on the Skill tab). */
  filter(block) {
    filterRows(block.rows, block.side.tab === "skill" ? block.side.search : "", block.divider);
  }

  /** Between the two sides: the larger "⇅ Swap sides" button. */
  swapBlock() {
    const block = element("div", "rollbox-opposed-swap");
    this.swapButton = button("rollbox-btn rollbox-opposed-swap-button", "⇅ Swap sides", () => this.swap());
    block.append(element("span", "rollbox-opposed-rule"), this.swapButton, element("span", "rollbox-opposed-rule"));
    return block;
  }

  // --- Creating the card ---

  /**
   * The footer: the tie line once both sides have a check (until then, in red, who still needs one), then
   * Cancel and Create opposed card.
   */
  sendBlock() {
    this.cancelButton = button("rollbox-btn rollbox-opposed-action", "Cancel", () => this.close());
    this.cancelButton.dataset.keep = "";
    const create = button("rollbox-btn rollbox-opposed-action rollbox-opposed-primary rollbox-primary",
      "Create opposed card", () => this.create());
    this.sender = sendSection([this.cancelButton, create], { statusClass: "rollbox-opposed-tie" });
    return this.sender.element;
  }

  /**
   * Swap sides: the two characters change places with their picks, dice and searches, so the other one is
   * CoC7's first side (attacker). The view is drawn again; nothing is sent.
   */
  swap() {
    if (this.sending) return;
    this.sides.reverse();
    this.stage.replaceChildren();
    this.build();
  }

  /** The request for both picks, through roll-requests' opposedRequest. Null until both sides have picked. */
  request() {
    if (!this.sides.every((side) => side.pick)) return null;
    return opposedRequest({ sides: this.sides.map((side) => ({ actor: side.actor, check: side.pick.check, dice: side.dice })) });
  }

  create() {
    const request = this.request();
    if (!request) return;
    runSend(this, () => send(request, [], { mode: "whisper" }), (result) => this.showResult(result));
  }

  /** What send() did: the card made and who rolls each side, or why no card was made. */
  showResult(result) {
    const made = Boolean(result?.requested?.length);
    if (made) this.made = true;
    showResult(this.sender.result, result, { heading: "Opposed card made:",
      name: (actor) => [actor.name, whoRolls(actor)].filter(Boolean).join(": ") });
    this.sender.result.classList.toggle("rollbox-opposed-warning", !made);
  }

  // --- Redraw of the parts that depend on the picks ---

  update() {
    for (const block of this.blocks) {
      const { side } = block;
      for (const { node } of block.rows) node.setAttribute("aria-selected", String(side.pick?.key === node.dataset.key));
      block.dice.sync();
      block.missing.hidden = !(side.pick && !side.pick.onSheet);
      const dice = side.pick && side.dice ? ` ${side.dice > 0 ? "+" : "−"}${Math.abs(side.dice)}` : "";
      block.picked.textContent = side.pick ? `${side.pick.name} ${side.pick.value ?? NO_VALUE}${dice}` : "";
      block.picked.hidden = !side.pick;
      block.picked.setAttribute("aria-label", side.pick
        ? `${side.pick.name} ${side.pick.value ?? NO_VALUE}${side.dice ? `, ${diceText(side.dice)}` : ""}` : "");
    }
    this.swapButton.disabled = this.sending;
    this.cancelButton.textContent = this.made ? "Close" : "Cancel";
    // Greyed out until both sides have a check: the red line says who still needs one; then the tie line.
    const missing = missingText(this.sides);
    this.sender.ready(missing, this.sending);
    if (!missing) this.sender.status.note(tieText(this.sides));
  }
}
