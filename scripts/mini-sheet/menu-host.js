/**
 * Menu host: the column of request buttons beside the Keeper's panel, and the flyout each one opens beside
 * it. Which buttons show depends on how many characters are selected (DESIGN.md, "Layout by number
 * of tokens selected"). Clicking a button opens its menu and marks the button pressed; clicking it again
 * closes it. Each menu lives in its own part and plugs in through registerMenu(); until one is
 * registered, its flyout is an empty placeholder with the menu's title.
 * A menu registered with `layout: "replace"` (the Opposed roll) doesn't use the flyout: it takes the place
 * of the card (the names card) and the button column hides until it closes. A menu registered with
 * `staysOpen` (Assist) stays open while anything is selected, even when its button isn't offered.
 * The names card's value columns follow the open menu: SAN with Sanity, a menu's own `columns` (Assist: STR
 * or SIZ), otherwise SAN and Luck; the host tells the panel when they may have changed.
 * A menu can also be opened with a starting state (`open(id, start)`, from a click on the mini sheet): the render
 * gets it as `start`, and a menu already open takes it through the controller its render returned (`apply`).
 */
import { element, warn } from "../utils.js";
import { NAMES_COLUMNS } from "./cards.js";

/** The five menus, in button order. `icon` is a Font Awesome 6 class, shipped with Foundry. */
const MENUS = Object.freeze({
  check: Object.freeze({ label: "Check", title: "Request a check", icon: "fa-dice-d20" }),
  sanity: Object.freeze({ label: "Sanity", title: "Sanity check", icon: "fa-brain" }),
  other: Object.freeze({ label: "Other", title: "Other", icon: "fa-ellipsis" }),
  opposed: Object.freeze({ label: "Opposed", title: "Opposed roll", icon: "fa-right-left" }),
  assist: Object.freeze({ label: "Assist", title: "Assist", icon: "fa-people-carry-box" })
});

/**
 * One character: Check, Sanity, Other. Two: Check, Sanity, Other, Opposed, Assist. Three or more: Check, Sanity,
 * Other, Assist (DESIGN.md, "Layout by number of tokens selected"). Other is offered for every selection: its Luck
 * section works for a group (Void, 2026-11-15).
 */
function menusFor(count) {
  if (count < 1) return [];
  if (count === 1) return ["check", "sanity", "other"];
  if (count === 2) return ["check", "sanity", "other", "opposed", "assist"];
  return ["check", "sanity", "other", "assist"];
}

/** The names card's columns for a menu that has none of its own: Sanity shows SAN only. */
const MENU_COLUMNS = Object.freeze({ sanity: Object.freeze([NAMES_COLUMNS.san]) });

/** How a menu is shown: in the flyout beside the buttons, or in place of the card with the buttons hidden. */
const LAYOUTS = Object.freeze(["flyout", "replace"]);

/** id → { title, render, layout, staysOpen, columns }, filled by the menu parts. */
const registered = new Map();

/**
 * Plug a menu into the panel. Called once by each menu part (check-menu, sanity-menu, other-menu,
 * opposed-roll, assist) from its own register…() function. Registering an id again replaces the earlier one.
 * @param {"check"|"sanity"|"other"|"opposed"|"assist"} id which button opens it
 * @param {object} menu
 * @param {string} [menu.title] heading of the flyout; defaults to the host's title for that id
 * @param {(body: HTMLElement, context: {actors: Actor[], close: () => void, selectionChanged: boolean,
 *   cardChanged: () => void}) => void}
 *   menu.render fills the flyout's body (emptied first) for the selected characters; called when the menu opens
 *   (`selectionChanged` false) and again when the selection changes while it is open (`selectionChanged`
 *   true), so it must build from scratch each time; a menu may carry its own choices over on a redraw.
 *   `cardChanged()`: the menu's `columns` may give something new, so the names card is drawn again.
 *   `start`: the starting state it was opened with (`open(id, start)`), or undefined. `setTitle(text)`: the flyout's
 *   heading for now (Other's section). It may return a controller `{ apply(start) }`, which takes a new starting
 *   state while the menu stays open.
 * @param {"flyout"|"replace"} [menu.layout] "flyout" (default): the body is the flyout's, under its title.
 *   "replace": the body takes the place of the card, with no title of the host's, and the button column
 *   hides; `close()` brings the card and the buttons back.
 * @param {boolean} [menu.staysOpen] stay open while at least one character is selected, even when the
 *   selection no longer offers its button (Assist, which says itself that it needs another token).
 * @param {(actors: Actor[]) => {label: string, value: (actor: Actor) => (number|string)}[]} [menu.columns]
 *   the names card's value columns while this menu is open (Assist); without it, the host's defaults.
 * @returns {boolean} false (with a warning) for an unknown id or layout, or a missing render function.
 */
export function registerMenu(id, { title, render, layout = "flyout", staysOpen = false, columns } = {}) {
  if (!Object.hasOwn(MENUS, id) || typeof render !== "function" || !LAYOUTS.includes(layout)) {
    warn(`registerMenu("${id}") ignored: unknown menu or layout, or no render function.`);
    return false;
  }
  registered.set(id, { title: title ?? MENUS[id].title, render, layout, staysOpen: staysOpen === true,
    columns: typeof columns === "function" ? columns : null });
  return true;
}

/** The buttons and the flyout. One per panel; update() redraws it for the current selection. */
export class MenuHost {
  /**
   * @param {HTMLElement} parent where the buttons column and the flyout go, side by side
   * @param {HTMLElement} cardSlot the panel's card; a "replace" menu is drawn just after it, while it hides.
   * @param {() => void} [onCardChange] the names card's columns may have changed (a menu opened, closed or
   *   said so): the panel draws the card again.
   */
  constructor(parent, cardSlot, onCardChange = () => {}) {
    this.onCardChange = onCardChange;
    this.buttons = element("div", "rollbox-buttons");
    this.buttons.setAttribute("role", "group");
    this.buttons.setAttribute("aria-label", "Request a roll");
    this.flyout = element("section", "rollbox-flyout");
    this.flyout.hidden = true;
    parent.append(this.buttons, this.flyout);
    this.cardSlot = cardSlot;
    this.stage = element("div", "rollbox-stage");
    this.stage.hidden = true;
    cardSlot.after(this.stage);
    this.ids = [];
    this.actors = [];
    this.openId = null;
    /** What the open menu's render returned, for `open(id, start)` while it is open. */
    this.controller = null;
  }

  /**
   * Show the buttons for these characters. An open menu stays open if its button is still offered, and is
   * drawn again only when the selection changed (so an update to a character doesn't wipe a half-filled menu).
   * @param {Actor[]} actors the selected characters, at least one
   */
  update(actors) {
    const changed = actors.length !== this.actors.length || actors.some((actor, i) => actor !== this.actors[i]);
    this.actors = actors;
    this.ids = menusFor(actors.length);
    this.buttons.replaceChildren(...this.ids.map((id) => this.button(id)));
    if (this.openId && !this.offers(this.openId)) this.close();
    else if (this.openId && changed) this.drawMenu(true);
  }

  /** Whether this menu can be open now: its button is offered, or it stays open with anything selected. */
  offers(id) {
    return this.ids.includes(id) || (this.actors.length > 0 && registered.get(id)?.staysOpen === true);
  }

  /** A request button; aria-pressed marks the open menu. */
  button(id) {
    const { label, icon } = MENUS[id];
    const button = element("button", "rollbox-button");
    button.type = "button";
    button.dataset.menu = id;
    button.setAttribute("aria-pressed", String(this.openId === id));
    const glyph = element("i", `fa-solid ${icon}`);
    glyph.setAttribute("aria-hidden", "true");
    button.append(glyph, element("span", "", label));
    button.addEventListener("click", () => this.toggle(id));
    return button;
  }

  /** Open the menu, or close it if it is the one already open. */
  toggle(id) {
    if (this.openId === id) this.close();
    else this.open(id);
  }

  /**
   * Open a menu, optionally with a starting state (a click on the mini sheet: a characteristic ticked, Other on its
   * Luck section, a send). A menu already open takes the state through its controller, keeping what the Keeper set;
   * one without a controller is drawn again with it.
   * @param {string} id
   * @param {object} [start]
   * @returns {boolean} false when the menu isn't offered for this selection.
   */
  open(id, start) {
    if (!this.ids.includes(id)) return false;
    if (start && this.openId === id && typeof this.controller?.apply === "function") {
      try {
        this.controller.apply(start);
      } catch (error) {
        warn(`the ${MENUS[id].label} menu failed to take its starting state.`, error);
      }
      this.onCardChange();
      return true;
    }
    this.openId = id;
    this.markPressed();
    this.drawMenu(false, start);
    this.onCardChange();
    return true;
  }

  close() {
    this.openId = null;
    this.controller = null;
    this.markPressed();
    this.flyout.hidden = true;
    this.flyout.replaceChildren();
    this.leaveStage();
    this.onCardChange();
  }

  /**
   * The names card's value columns for the open menu: the menu's own (Assist), SAN alone with Sanity, or
   * null for the card's default (SAN and Luck). A menu's columns that fail give the default.
   * @param {Actor[]} actors
   * @returns {{label: string, value: (actor: Actor) => (number|string)}[]|null}
   */
  columns(actors) {
    const id = this.openId;
    if (!id) return null;
    const own = registered.get(id)?.columns;
    if (own) {
      try {
        return own(actors);
      } catch (error) {
        warn(`the ${MENUS[id].label} menu's names-card columns failed.`, error);
        return null;
      }
    }
    return MENU_COLUMNS[id] ?? null;
  }

  /** Back from a "replace" menu: the card and the button column show again. */
  leaveStage() {
    this.stage.hidden = true;
    this.stage.replaceChildren();
    delete this.stage.dataset.menu;
    this.cardSlot.hidden = false;
    this.buttons.hidden = false;
  }

  markPressed() {
    for (const button of this.buttons.querySelectorAll(".rollbox-button")) {
      button.setAttribute("aria-pressed", String(button.dataset.menu === this.openId));
    }
  }

  /**
   * The open menu: in place of the card for a "replace" menu, otherwise in the flyout.
   * @param {boolean} [selectionChanged] drawn again because the selection changed while it was open
   */
  drawMenu(selectionChanged = false, start = undefined) {
    const menu = registered.get(this.openId);
    this.controller = null;
    if (menu?.layout === "replace") this.drawStage(menu, selectionChanged, start);
    else this.drawFlyout(menu, selectionChanged, start);
  }

  /** The render's context: the selection, close, whether the selection changed, the start, and the card's redraw. */
  context(selectionChanged, start, setTitle = () => {}) {
    return { actors: [...this.actors], close: () => this.close(), selectionChanged, start, setTitle,
      cardChanged: () => this.onCardChange() };
  }

  /** Keep what a render returned when it is a controller. */
  keep(returned) {
    this.controller = returned && typeof returned.apply === "function" ? returned : null;
  }

  /** The flyout: its title, then the registered menu's content (or nothing yet). */
  drawFlyout(menu, selectionChanged = false, start = undefined) {
    const id = this.openId;
    this.leaveStage();
    const title = menu?.title ?? MENUS[id].title;
    const body = element("div", "rollbox-flyout-body");
    const heading = element("h3", "rollbox-flyout-title", title);
    const setTitle = (text) => {
      heading.textContent = text;
      this.flyout.setAttribute("aria-label", text);
    };
    this.flyout.dataset.menu = id;
    this.flyout.setAttribute("aria-label", title);
    this.flyout.replaceChildren(heading, body);
    this.flyout.hidden = false;
    if (!menu) return;
    try {
      this.keep(menu.render(body, this.context(selectionChanged, start, setTitle)));
    } catch (error) {
      warn(`the ${MENUS[id].label} menu failed to draw.`, error);
    }
  }

  /**
   * A "replace" menu: the card and the button column hide and the menu fills the stage in the card's place.
   * If it fails to draw, it closes, so the Keeper is never left without the card and the buttons.
   */
  drawStage(menu, selectionChanged = false, start = undefined) {
    const id = this.openId;
    this.flyout.hidden = true;
    this.flyout.replaceChildren();
    this.cardSlot.hidden = true;
    this.buttons.hidden = true;
    this.stage.dataset.menu = id;
    this.stage.setAttribute("aria-label", menu.title);
    this.stage.replaceChildren();
    this.stage.hidden = false;
    try {
      this.keep(menu.render(this.stage, this.context(selectionChanged, start)));
    } catch (error) {
      warn(`the ${MENUS[id].label} menu failed to draw.`, error);
      this.close();
    }
  }
}
