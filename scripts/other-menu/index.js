/**
 * Other menu (Void, 2026-11-15; the Item menu until 0.1.1): what the Keeper's Other button opens, for any
 * selection. Two sections at the top, like the Check menu's tabs: Item (a character's weapons and improvised
 * weapons, one character only; item.js) and Luck (a Luck check, with the Group Luck roll for two or more; luck.js).
 * One character opens on Item; two or more open on Luck, with Item greyed out. The flyout's title follows the
 * section ("Item check", "Luck check"). A click on the mini sheet's Luck opens it on Luck, or sends at once
 * (`apply`). Layout and rules: DESIGN.md, "Other menu". Keeper only: registered only on the Keeper's client.
 */
import { element, getSetting, isKeeper } from "../utils.js";
import { registerMenu } from "../mini-sheet/index.js";
import { button } from "../shared/index.js";
import { renderItem } from "./item.js";
import { LuckSection } from "./luck.js";

/** The two sections, in tab order, with the flyout's title for each. */
const SECTIONS = Object.freeze([
  { id: "item", label: "Item", title: "Item check" },
  { id: "luck", label: "Luck", title: "Luck check" }
]);

/**
 * ready: plug the Other menu into the Keeper's panel. Does nothing for players or with the Rollbox
 * switch off (the panel isn't there either).
 * @returns {boolean} true when the menu was registered.
 */
export function registerOtherMenu() {
  if (!isKeeper() || !getSetting("rollboxEnabled")) return false;
  return registerMenu("other", { title: "Other", render: renderOtherMenu });
}

/**
 * The menu host's render: builds the whole menu from scratch for the selected characters. Called when the menu
 * opens and again when the selection changes while it is open.
 * @param {HTMLElement} body the flyout's body, already empty
 * @param {{actors: Actor[], start?: {section?: "item"|"luck", plain?: boolean, send?: string},
 *   setTitle?: (text: string) => void}} context
 * @returns {{apply: (start: object) => void}|undefined} the controller the menu host keeps while it is open
 */
export function renderOtherMenu(body, { actors = [], start, setTitle = () => {} } = {}) {
  if (!actors.length) return undefined;
  const menu = new OtherMenu(body, actors, setTitle);
  menu.build(start?.section);
  if (start) menu.apply(start);
  return { apply: (next) => menu.apply(next) };
}

class OtherMenu {
  constructor(body, actors, setTitle) {
    this.body = body;
    this.actors = actors;
    this.single = actors.length === 1;
    this.setTitle = setTitle;
    this.section = null;
    this.luck = null;
  }

  /** The section tabs, then the open section. Item is greyed out unless one character is selected. */
  build(section) {
    const tabs = element("div", "rollbox-other-tabs");
    tabs.setAttribute("role", "tablist");
    this.tabButtons = SECTIONS.map(({ id, label }) => {
      const node = button("rollbox-btn rollbox-tab rollbox-other-tab", label, () => this.show(id));
      node.dataset.section = id;
      node.setAttribute("role", "tab");
      node.disabled = id === "item" && !this.single;
      return node;
    });
    tabs.append(...this.tabButtons);
    this.content = element("div", "rollbox-other-section");
    this.body.append(tabs, this.content);
    this.show(section ?? (this.single ? "item" : "luck"));
  }

  /** Draw a section from scratch; Item falls back to Luck with two or more characters. */
  show(id) {
    const section = id === "item" && !this.single ? "luck" : (SECTIONS.some((s) => s.id === id) ? id : "luck");
    this.section = section;
    for (const node of this.tabButtons) node.setAttribute("aria-selected", String(node.dataset.section === section));
    this.content.replaceChildren();
    this.content.dataset.section = section;
    this.luck = null;
    if (section === "item") renderItem(this.content, this.actors);
    else {
      this.luck = new LuckSection(this.content, this.actors);
      this.luck.build();
    }
    this.setTitle(SECTIONS.find((s) => s.id === section).title);
  }

  /**
   * A starting state, from a click on the mini sheet: `section` opens it (Luck keeps what the Keeper set if it is
   * already open); `plain` and `send` go to the Luck section (luck.js).
   */
  apply({ section, ...rest } = {}) {
    if (section && section !== this.section) this.show(section);
    if (this.luck && (rest.plain || rest.send)) this.luck.apply(rest);
  }
}
