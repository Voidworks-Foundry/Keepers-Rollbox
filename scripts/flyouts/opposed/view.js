/** The Opposed roll's view: draws sides.js's sides and makes CoC7's card. See docs/opposed-flyout.md. */
import { NO_VALUE, actorKey, element, isKeeper, uniqueActors, warn } from "../../utils.js";
import { targetedToken } from "../../player/index.js";
import { opposedRequest, send } from "../../roll-requests/index.js";
import {
  CHECK_TABS, actorTag, button, diceChoices, diceLine, diceText, filterRows, glyphButton, noneSent, runSend, searchBox,
  segmented, sendSection, showResult, tabBar
} from "../flyout.js";
import { rightClickTargets } from "../../shared/index.js";
import {
  choicesFor, emptySide, isGroup, known, members, missingText, onSide, sameCharacter, sideFor, startPick, tieText,
  whoRolls, withMembers
} from "./sides.js";

const MISSING_HINT = "Not on the sheet: CoC7 adds it at its base value when the card is made.";
const WAITING = Object.freeze({
  select: "Opposed roll started. Select another character.",
  target: "Opposed roll started. Target your opponent.",
  empty: "Pick who rolls this side."
});
const TARGET_PROMPT = "Target your opponent";
const PICK = Object.freeze({ button: "Pick a target", add: "Add a character", prompt: "Target who rolls this side" });
// CoC7 8.15 makes the first side attacker and the second defender, and compares only with one of each.
const ROLES = Object.freeze(["Attacker", "Defender"]);
// The Keeper sets the roles on a player's card, so a player's sides are named for the player instead.
const PLAYER_ROLES = Object.freeze({ own: "You", opponent: "Opponent" });
const KEEPER_PICKS = (name) => `Your Keeper picks what ${name} rolls.`;
const KEEPER_ADDS = (name) => `Your Keeper adds ${name}'s side and starts the rolls.`;

/** Draws the Opposed roll from its carried sides and makes the card; rebuilt from scratch on each redraw. */
export class OpposedView {
  /**
   * @param {HTMLElement} stage
   * @param {{sides: object[], actors: Actor[]}} state mutated as sides change
   * @param {() => void} close
   * @param {{targeting: boolean, pickTarget: Function, own: Actor|null}} options `targeting`: a player's flyout;
   *   `own`: the player's investigator
   */
  constructor(stage, state, close, { targeting, pickTarget, own = null }) {
    this.stage = stage;
    this.state = state;
    this.close = close;
    this.targeting = targeting;
    this.pickTarget = pickTarget;
    this.own = own;
    this.sending = false;
    this.made = false;
  }

  get sides() {
    return this.state.sides;
  }

  build() {
    const card = element("div", "rollbox-opposed-card");
    this.blocks = this.sides.map((side, index) => (!side.actor ? this.waitingBlock(side, index)
      : this.isOpponent(side) ? this.opponentBlock(side, index) : this.sideBlock(side, index)));
    card.append(this.blocks[0].root, this.swapBlock(), this.blocks[1].root, this.sendBlock());
    this.stage.append(card);
    for (const block of this.blocks) if (!block.waiting && !block.opponent) this.drawList(block);
    this.update();
  }

  redraw() {
    this.stage.replaceChildren();
    this.build();
  }

  /** Builds a side with a character; `index` 0 is CoC7's first side. */
  sideBlock(side, index) {
    const root = element("div", "rollbox-opposed-side");
    root.dataset.actor = actorTag(side.actor);
    root.dataset.role = ROLES[index].toLowerCase();
    const group = isGroup(side);
    root.classList.toggle("rollbox-opposed-side-group", group);
    const block = { root, side, index, rows: [], choices: choicesFor(side) };
    block.list = element("div", "rollbox-opposed-list");
    block.list.setAttribute("role", "listbox");
    block.missing = element("div", "rollbox-hint rollbox-opposed-hint", MISSING_HINT);
    root.append(this.head(block, index));
    if (group) root.append(this.groupNames(block, index));
    root.append(this.tabs(block), this.search(block), block.list, this.diceRow(block), block.missing);
    return block;
  }

  /** Builds a side waiting for its character, with the Keeper's picker or a player's target button. */
  waitingBlock(side, index) {
    const root = element("div", "rollbox-opposed-side rollbox-opposed-side-waiting");
    root.dataset.actor = "";
    root.dataset.role = ROLES[index].toLowerCase();
    const head = element("div", "rollbox-opposed-head");
    head.append(element("span", "rollbox-opposed-role", this.roleText(side, index)));
    if (!this.targeting) {
      head.append(glyphButton("rollbox-btn rollbox-opposed-pick-target", "fa-crosshairs", () => this.target(index),
        { text: PICK.button }));
    }
    const started = this.sides.some((other) => other.actor);
    const text = this.targeting ? WAITING.target : (started ? WAITING.select : WAITING.empty);
    const wait = element("p", "rollbox-opposed-waiting", text);
    wait.setAttribute("aria-live", "polite");
    root.append(head, wait);
    if (this.targeting) {
      root.append(glyphButton("rollbox-btn rollbox-opposed-target", "fa-crosshairs", () => this.target(index),
        { text: TARGET_PROMPT }));
    }
    return { root, side, waiting: true };
  }

  /** Tells whether this is the opponent's side on a player's flyout, whose check is the Keeper's to pick. */
  isOpponent(side) {
    return this.targeting && Boolean(side.actor) && !sameCharacter(side.actor, this.own);
  }

  roleText(side, index) {
    if (!this.targeting) return ROLES[index];
    return side.actor && !this.isOpponent(side) ? PLAYER_ROLES.own : PLAYER_ROLES.opponent;
  }

  // No tabs, list or values on the opponent's side, so a player never sees an NPC's sheet.
  opponentBlock(side, index) {
    const root = element("div", "rollbox-opposed-side rollbox-opposed-side-opponent");
    root.dataset.actor = actorTag(side.actor);
    root.dataset.role = ROLES[index].toLowerCase();
    const head = element("div", "rollbox-opposed-head");
    const name = element("span", "rollbox-opposed-name", side.actor.name ?? "");
    rightClickTargets(name, side.actor);
    head.append(element("span", "rollbox-opposed-role", this.roleText(side, index)), name,
      glyphButton("rollbox-btn rollbox-opposed-clear", "fa-xmark", () => this.clear(index),
        { label: `Clear ${side.actor.name ?? "this side"}` }));
    root.append(head, element("p", "rollbox-hint rollbox-opposed-keeper-picks", KEEPER_PICKS(side.actor.name ?? "your opponent")));
    return { root, side, opponent: true };
  }

  /** Tells whether this user may empty the side: the Keeper any, a player only the opponent's. */
  clearable(side) {
    return !this.targeting || !sameCharacter(side.actor, this.own);
  }

  head(block, index) {
    const head = element("div", "rollbox-opposed-head");
    const { side } = block;
    const group = isGroup(side);
    const name = element("span", "rollbox-opposed-name", group ? `${members(side).length} characters` : side.actor.name ?? "");
    name.title = members(side).map((actor) => actor.name ?? "").join(", ");
    block.picked = element("span", "rollbox-opposed-pick");
    if (!group) rightClickTargets(name, side.actor);
    head.append(element("span", "rollbox-opposed-role", this.roleText(side, index)), name);
    if (!group && this.clearable(side)) {
      head.append(glyphButton("rollbox-btn rollbox-opposed-clear", "fa-xmark", () => this.clear(index),
        { label: `Clear ${side.actor.name ?? "this side"}` }));
    }
    head.append(block.picked);
    return head;
  }

  groupNames(block, index) {
    const list = element("div", "rollbox-opposed-group");
    for (const actor of members(block.side)) {
      const row = element("div", "rollbox-opposed-member");
      row.dataset.actor = actorTag(actor);
      const name = element("span", "rollbox-opposed-member-name", actor.name ?? "");
      name.title = actor.name ?? "";
      row.append(name, glyphButton("rollbox-btn rollbox-opposed-clear", "fa-xmark", () => this.dropMember(index, actor),
        { label: `Take ${actor.name ?? ""} off this side` }));
      list.append(rightClickTargets(row, actor));
    }
    if (!this.targeting) {
      list.append(glyphButton("rollbox-btn rollbox-opposed-add", "fa-crosshairs", () => this.target(index, { add: true }),
        { text: PICK.add }));
    }
    return list;
  }

  tabs(block) {
    const bar = tabBar(CHECK_TABS, { className: "rollbox-opposed-tabs", tabClass: "rollbox-opposed-tab",
      onPick: (id) => {
        block.side.tab = id;
        this.drawList(block);
        this.update();
      } });
    block.tabButtons = bar.buttons;
    return bar.element;
  }

  search(block) {
    const { side } = block;
    block.search = searchBox({ label: `Search ${isGroup(side) ? "the group" : side.actor.name ?? ""}'s skills`,
      value: side.search,
      onInput: (text) => {
        side.search = text;
        this.filter(block);
      } });
    return block.search;
  }

  diceRow(block) {
    const { side } = block;
    block.dice = segmented({ choices: diceChoices(), get: () => String(side.dice),
      set: (value) => { side.dice = Number(value); this.update(); },
      label: `${isGroup(side) ? "The group" : side.actor.name ?? ""}: bonus or penalty dice` });
    const row = diceLine(block.dice.element);
    row.classList.add("rollbox-opposed-line");
    return row;
  }

  drawList(block) {
    const { side } = block;
    for (const node of block.tabButtons) node.setAttribute("aria-selected", String(node.dataset.tab === side.tab));
    block.search.hidden = side.tab !== "skill";
    block.rows = [];
    block.divider = null;
    const nodes = [];
    for (const choice of block.choices[side.tab]) {
      if (!choice.trained && !block.divider && !isGroup(side)) {
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
    node.append(element("span", "rollbox-opposed-row-name", pick.name));
    if (!isGroup(block.side)) {
      node.append(element("span", "rollbox-opposed-row-value", known(pick.value) ? String(pick.value) : NO_VALUE));
    }
    block.rows.push({ node, name: pick.name });
    return node;
  }

  filter(block) {
    filterRows(block.rows, block.side.tab === "skill" ? block.side.search : "", block.divider);
  }

  swapBlock() {
    const block = element("div", "rollbox-opposed-swap");
    this.swapButton = button("rollbox-btn rollbox-opposed-swap-button", "⇅ Swap sides", () => this.swap());
    // A player's card goes out with the opponent's side open; the Keeper sets who attacks on CoC7's card.
    this.swapButton.hidden = this.targeting;
    block.append(element("span", "rollbox-opposed-rule"), this.swapButton, element("span", "rollbox-opposed-rule"));
    return block;
  }

  /**
   * Applies a starting state while open: each picked character goes to its own side, else an empty one, else the
   * side the roll wasn't started from.
   * @param {{first?: string, picks?: Object<string, string>, create?: boolean}} [start]
   */
  apply({ first, picks = {}, create = false } = {}) {
    for (const key of Object.keys(picks)) {
      const actor = this.findActor(key);
      if (!actor) continue;
      let index = this.sides.findIndex((side) => sameCharacter(side.actor, actor) && !isGroup(side));
      if (index >= 0) {
        Object.assign(this.sides[index], startPick(actor, picks));
        if (key === first) this.sides[index].anchored = true;
        continue;
      }
      index = this.sides.findIndex((side) => !side.actor);
      if (index < 0) index = this.sides[1].anchored && !this.sides[0].anchored ? 0 : 1;
      this.state.sides[index] = sideFor(actor, picks, key === first);
    }
    this.redraw();
    if (create) this.create();
  }

  /** Finds a character by actorKey among the selected and those on a side. */
  findActor(key) {
    return [...this.state.actors, ...this.sides.flatMap(members)].find((actor) => actor && actorKey(actor) === key) ?? null;
  }

  /**
   * Fills or adds to a side by target; a player's current target is used without asking. Does nothing when cancelled.
   * @param {number} index
   * @param {{add?: boolean}} [options] `add`: join a side of several instead of filling an empty side
   */
  async target(index, { add = false } = {}) {
    let token = null;
    const current = targetedToken()?.actor;
    try {
      token = await this.pickTarget({ prompt: this.targeting ? TARGET_PROMPT : PICK.prompt,
        useCurrent: this.targeting && Boolean(current) && !this.sides.some((side) => onSide(side, current)) });
    } catch (error) {
      warn("picking a side by target failed.", error);
    }
    const actor = token?.actor;
    const side = this.sides[index];
    if (!actor || !side || this.sides.some((other) => onSide(other, actor))) return;
    if (add && side.actor) {
      const next = withMembers(side, [...members(side), actor]);
      next.picked = [...next.picked, actorKey(actor)];
      this.state.sides[index] = next;
    } else if (!side.actor) {
      this.state.sides[index] = { ...sideFor(actor), picked: [actorKey(actor)] };
    } else return;
    this.redraw();
  }

  clear(index) {
    if (this.sending) return;
    this.state.sides[index] = emptySide();
    this.redraw();
  }

  dropMember(index, actor) {
    if (this.sending) return;
    const side = this.sides[index];
    this.state.sides[index] = withMembers(side, members(side).filter((member) => !sameCharacter(member, actor)));
    this.redraw();
  }

  sendBlock() {
    this.cancelButton = button("rollbox-btn rollbox-opposed-action", "Cancel", () => this.close());
    this.cancelButton.dataset.keep = "";
    const create = button("rollbox-btn rollbox-opposed-action rollbox-opposed-primary rollbox-primary", "",
      () => this.create());
    this.createButton = create;
    this.sender = sendSection([this.cancelButton, create], { statusClass: "rollbox-opposed-tie" });
    return this.sender.element;
  }

  /** Returns how many cards Create makes: one per character of a side of several. */
  cardCount() {
    return Math.max(1, ...this.sides.map((side) => members(side).length));
  }

  swap() {
    if (this.sending) return;
    this.sides.reverse();
    this.redraw();
  }

  /** Returns one request, or one per character of a side of several; empty until both sides have a check. */
  requests() {
    if (this.targeting) return this.playerRequests();
    if (!this.sides.every((side) => side.actor && side.pick)) return [];
    const groupIndex = this.sides.findIndex(isGroup);
    const each = groupIndex < 0 ? [null] : members(this.sides[groupIndex]);
    return each.map((member) => opposedRequest({ sides: this.sides.map((side, index) => ({
      actor: index === groupIndex ? member : side.actor, check: side.pick.check, dice: side.dice })) }))
      .filter(Boolean);
  }

  /** Returns a player's request, the opponent's side left open for the Keeper. */
  playerRequests() {
    const ready = this.sides.every((side) => side.actor && (this.isOpponent(side) || side.pick));
    if (!ready || !this.sides.some((side) => this.isOpponent(side))) return [];
    const request = opposedRequest({ sides: this.sides.map((side) => (this.isOpponent(side) ? { actor: side.actor, open: true }
      : { actor: side.actor, check: side.pick.check, dice: side.dice })) });
    return request ? [request] : [];
  }

  // CoC7 8.15 can't finish a one-sided card made this way, so nothing is made while a side waits.
  create() {
    const requests = this.requests();
    if (!requests.length || this.madeNow()) return;
    runSend(this, async () => {
      const total = noneSent();
      for (const request of requests) {
        const result = await send(request, []);
        total.requested.push(...(result?.requested ?? []));
        total.rolled.push(...(result?.rolled ?? []));
        total.skipped.push(...(result?.skipped ?? []));
        total.unavailable ||= result?.unavailable === true;
      }
      total.requested = uniqueActors(total.requested);
      total.rolled = uniqueActors(total.rolled);
      return total;
    }, (result) => this.showResult(result));
  }

  /** Returns a key of both sides' characters, checks and dice. */
  picksKey() {
    return this.sides.map((side) => [members(side).map(actorTag).join("+"),
      side.pick?.key ?? "", side.dice ?? 0].join("|")).join("&");
  }

  // Create stays greyed until a pick changes, so the same card is never made twice.
  madeNow() {
    return this.made && this.madeKey === this.picksKey();
  }

  showResult(result) {
    const made = Boolean(result?.requested?.length);
    if (made) {
      this.made = true;
      this.madeKey = this.picksKey();
    }
    showResult(this.sender.result, result, { heading: this.cardCount() > 1 ? "Opposed cards made:" : "Opposed card made:",
      name: (actor) => [actor.name, whoRolls(actor)].filter(Boolean).join(": ") });
    const opponent = this.sides.find((side) => this.isOpponent(side));
    if (made && opponent) {
      this.sender.result.append(element("div", "rollbox-result-line rollbox-opposed-keeper-adds",
        KEEPER_ADDS(opponent.actor.name ?? "your opponent")));
    }
    this.sender.result.classList.toggle("rollbox-opposed-warning", !made);
  }

  update() {
    for (const block of this.blocks) {
      if (block.waiting || block.opponent) continue;
      const { side } = block;
      for (const { node } of block.rows) node.setAttribute("aria-selected", String(side.pick?.key === node.dataset.key));
      block.dice.sync();
      block.missing.hidden = isGroup(side) || !(side.pick && !side.pick.onSheet);
      const dice = side.pick && side.dice ? ` ${side.dice > 0 ? "+" : "−"}${Math.abs(side.dice)}` : "";
      const value = isGroup(side) ? "" : ` ${side.pick?.value ?? NO_VALUE}`;
      block.picked.textContent = side.pick ? `${side.pick.name}${value}${dice}` : "";
      block.picked.hidden = !side.pick;
      block.picked.setAttribute("aria-label", side.pick
        ? `${side.pick.name}${value}${side.dice ? `, ${diceText(side.dice)}` : ""}` : "");
    }
    this.swapButton.disabled = this.sending;
    this.cancelButton.textContent = this.made ? "Close" : "Cancel";
    const count = this.cardCount();
    this.createButton.textContent = !isKeeper() ? "Make opposed card"
      : count > 1 ? `Create opposed cards (${count})` : "Create opposed card";
    // A waiting side says so on its own block, so the footer's line is cleared below.
    const waiting = this.sides.some((side) => !side.actor);
    const missing = waiting ? (this.targeting ? WAITING.target : WAITING.select)
      : missingText(this.sides.filter((side) => !this.isOpponent(side)));
    this.sender.ready(missing, this.sending);
    if (this.madeNow()) this.createButton.disabled = true;
    // A player never sees the tie line: it would show the opponent's value.
    if (waiting || this.targeting) this.sender.status.clear();
    else if (!missing) this.sender.status.note(tieText(this.sides));
  }
}

