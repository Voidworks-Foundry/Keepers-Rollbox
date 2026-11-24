/** The menu beside the character panel and the flyout each button opens. See docs/panel.md. */
import { element, glyph, sameActor, warn } from "../utils.js";

/** The four buttons; `heading` is the flyout's heading when no tab names it. */
const MENUS = Object.freeze({
  action: Object.freeze({ label: "Action", title: "Action", icon: "fa-hand-fist" }),
  check: Object.freeze({ label: "Check", title: "Request a check", icon: "fa-dice-d20" }),
  other: Object.freeze({ label: "Other", title: "Other", icon: "fa-ellipsis" }),
  opposed: Object.freeze({ label: "Opposed", title: "Opposed roll", heading: "Opposed roll", icon: "fa-right-left" })
});

const FIXED = Object.freeze(["action", "check", "other"]);

/** The flyout-level tabs whose name becomes the flyout's heading (not Opposed's per-side tabs). */
const HEADING_TABS = ".rollbox-check-tab, .rollbox-other-tab, .rollbox-action-tab";

/** The extra buttons above the fixed ones, for this many selected (0 while the players list shows). */
function extrasFor(count) {
  return count === 1 ? [] : ["opposed"];
}

function fixedFor(count) {
  return count === 1 || count === 2 ? FIXED : FIXED.filter((id) => id !== "action");
}

/** id → { title, render, staysOpen, columns, start, waiting }, filled by the flyout parts. */
const registered = new Map();

/**
 * Plugs a flyout into the panel; registering an id again replaces the earlier one.
 * @param {"action"|"check"|"other"|"opposed"} id which button opens it
 * @param {{title?: string, render: (body: HTMLElement, context: object) => ({apply: Function}|void),
 *   staysOpen?: boolean, columns?: Function, start?: Function, waiting?: () => boolean}} flyout
 * @returns {boolean} false (with a warning) for an unknown id or a missing render function
 */
export function registerFlyout(id, { title, render, staysOpen = false, columns, start, waiting } = {}) {
  if (!Object.hasOwn(MENUS, id) || typeof render !== "function") {
    warn(`registerFlyout("${id}") ignored: unknown button, or no render function.`);
    return false;
  }
  registered.set(id, { title: title ?? MENUS[id].title, render, staysOpen: staysOpen === true,
    columns: typeof columns === "function" ? columns : null, start: typeof start === "function" ? start : null,
    waiting: typeof waiting === "function" ? waiting : null });
  return true;
}

/**
 * Returns the starting state a registered flyout builds for being opened from a sheet value.
 * @param {string} id
 * @param {...*} args what its `start` takes
 * @returns {object|null} null when it isn't registered or has no `start`
 */
export function flyoutStart(id, ...args) {
  const start = registered.get(id)?.start;
  return start ? start(...args) : null;
}

/**
 * Returns whether a registered flyout waits for a value to be clicked.
 * @param {string} id
 * @returns {boolean}
 */
export function flyoutWaiting(id) {
  return registered.get(id)?.waiting?.() === true;
}

/** Owns the menu and the flyout; one per panel. */
export class MenuHost {
  /**
   * @param {HTMLElement} parent where the menu and the flyout go, side by side
   * @param {() => void} [onCardChange] called when the character cards' columns may have changed
   */
  constructor(parent, onCardChange = () => {}) {
    this.onCardChange = onCardChange;
    this.buttons = element("div", "rollbox-menu");
    this.buttons.setAttribute("role", "group");
    this.buttons.setAttribute("aria-label", "Request a roll");
    this.flyout = element("section", "rollbox-flyout");
    this.flyout.hidden = true;
    parent.append(this.buttons, this.flyout);
    this.watchHeading();
    this.ids = [];
    this.actors = [];
    this.everyone = false;
    this.greyed = null;
    this.stillOpen = [];
    this.openId = null;
    this.controller = null;
  }

  /**
   * Draws the buttons for these characters; an open flyout is drawn again only when the selection changed.
   * @param {Actor[]} actors
   * @param {string[]} [ids] only these fixed buttons, no extras (a player's menu)
   * @param {{everyone?: boolean, greyed?: string|null, keep?: string[]}} [options] `greyed`: the reason every button
   *   is disabled, but those in `keep`
   * @returns {void}
   */
  update(actors, ids, { everyone = false, greyed = null, keep = [] } = {}) {
    const changed = everyone !== this.everyone || actors.length !== this.actors.length
      || actors.some((actor, i) => !sameActor(actor, this.actors[i]));
    this.actors = actors;
    this.everyone = everyone;
    this.greyed = greyed || null;
    this.stillOpen = greyed ? keep : [];
    const count = everyone ? 0 : actors.length;
    const extras = !ids && (count || everyone) ? extrasFor(count) : [];
    const fixed = ids ? FIXED.filter((id) => ids.includes(id)) : fixedFor(count);
    this.ids = actors.length || everyone ? [...extras, ...fixed] : [];
    this.buttons.style.setProperty("--rollbox-extras", String(extras.length));
    // A player's menu may have fewer than three buttons: they share the sheet's height between them (panel.css).
    this.buttons.classList.toggle("rollbox-menu-fill", Boolean(ids));
    this.buttons.style.setProperty("--rollbox-buttons", String(Math.max(1, this.ids.length)));
    this.buttons.replaceChildren(...this.ids.map((id) => this.button(id)));
    if (this.openId && !this.offers(this.openId)) this.close();
    else if (this.openId && changed) this.drawFlyout(registered.get(this.openId), true);
  }

  /** Whether this flyout can be open now: its button is offered, or it stays open with anything selected. */
  offers(id) {
    if (this.greyed && !this.stillOpen.includes(id)) return false;
    return this.ids.includes(id)
      || (!this.everyone && this.actors.length > 0 && registered.get(id)?.staysOpen === true);
  }

  button(id) {
    const { label, icon } = MENUS[id];
    const button = element("button", "rollbox-menu-button");
    button.type = "button";
    button.dataset.menu = id;
    button.setAttribute("aria-pressed", String(this.openId === id));
    button.append(glyph(icon), element("span", "", label));
    if (this.greyed && !this.stillOpen.includes(id)) {
      button.disabled = true;
      button.title = this.greyed;
      button.classList.add("rollbox-menu-greyed");
    }
    button.addEventListener("click", () => this.toggle(id));
    return button;
  }

  toggle(id) {
    if (this.openId === id) this.close();
    else this.open(id);
  }

  /**
   * Opens a flyout; one already open takes the starting state through its controller, keeping what was set.
   * @param {string} id
   * @param {object} [start]
   * @returns {boolean} false when the flyout isn't offered for this selection
   */
  open(id, start) {
    if (!this.offers(id)) return false;
    if (start && this.openId === id && typeof this.controller?.apply === "function") {
      try {
        this.controller.apply(start);
      } catch (error) {
        warn(`the ${MENUS[id].label} flyout failed to take its starting state.`, error);
      }
      this.onCardChange();
      return true;
    }
    this.openId = id;
    this.markPressed();
    this.drawFlyout(registered.get(id), false, start);
    this.onCardChange();
    return true;
  }

  close() {
    this.openId = null;
    this.controller = null;
    this.markPressed();
    this.flyout.hidden = true;
    this.flyout.replaceChildren();
    this.onCardChange();
  }

  /**
   * Returns the open flyout's own character-card columns; a failing one gives the default.
   * @param {Actor[]} actors
   * @returns {{label: string, value: (actor: Actor) => (number|string)}[]|null} null for the default meters
   */
  columns(actors) {
    const id = this.openId;
    if (!id) return null;
    const own = registered.get(id)?.columns;
    if (own) {
      try {
        return own(actors);
      } catch (error) {
        warn(`the ${MENUS[id].label} flyout's character-card columns failed.`, error);
        return null;
      }
    }
    return null;
  }

  markPressed() {
    for (const button of this.buttons.querySelectorAll(".rollbox-menu-button")) {
      button.setAttribute("aria-pressed", String(button.dataset.menu === this.openId));
    }
  }

  /** Sets the flyout's `data-heading`: the selected tab's name, else the menu's. */
  syncHeading() {
    const id = this.openId;
    if (!id) return delete this.flyout.dataset.heading;
    const tab = this.flyout.querySelector(`:is(${HEADING_TABS})[aria-selected="true"]`);
    const text = tab?.textContent?.trim() || MENUS[id].heading || MENUS[id].label;
    if (this.flyout.dataset.heading !== text) this.flyout.dataset.heading = text;
    return undefined;
  }

  // Each flyout switches its own tabs, so the host watches `aria-selected` rather than being told.
  watchHeading() {
    const Observer = this.flyout.ownerDocument?.defaultView?.MutationObserver ?? globalThis.MutationObserver;
    if (typeof Observer !== "function") return;
    new Observer(() => this.syncHeading()).observe(this.flyout,
      { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-selected"] });
  }

  keep(returned) {
    this.controller = returned && typeof returned.apply === "function" ? returned : null;
  }

  drawFlyout(flyout, selectionChanged = false, start = undefined) {
    const id = this.openId;
    this.controller = null;
    const title = flyout?.title ?? MENUS[id].title;
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
    if (!flyout) return this.syncHeading();
    try {
      this.keep(flyout.render(body, { actors: [...this.actors], everyone: this.everyone, close: () => this.close(),
        selectionChanged, start,
        setTitle, cardChanged: () => this.onCardChange(), open: (other, state) => this.open(other, state) }));
    } catch (error) {
      warn(`the ${MENUS[id].label} flyout failed to draw.`, error);
    }
    this.syncHeading();
  }
}
