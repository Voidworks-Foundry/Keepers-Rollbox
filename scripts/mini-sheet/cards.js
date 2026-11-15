/**
 * The two cards the Keeper's panel shows: the mini sheet for one selected character (portrait, name,
 * occupation and owner, HP, MP, SAN, Luck, the eight characteristics, and a button to the full sheet), and
 * the names card for two or more (each character's name, owner or "NPC · Keeper rolls", and value columns
 * that follow the open menu: SAN and Luck, SAN alone with Sanity, STR or SIZ with Assist).
 * Built with textContent only, so names and occupations typed by anyone never become HTML.
 * Every value is read guarded: a missing field shows a dash.
 */
import { NO_VALUE, element, numberOrNull, warn } from "../utils.js";
import { attributes, characteristics } from "../skill-values/index.js";
import { ownersOf } from "../roll-requests/index.js";

/** Under a character with no player owner: Rollbox rolls their side for the Keeper. */
const NPC_TEXT = "NPC · Keeper rolls";
/** The same on the one-character mini sheet, after the occupation. */
const NPC_SHORT = "NPC";
/** Foundry's default portrait, for an actor without one. */
const DEFAULT_PORTRAIT = "icons/svg/mystery-man.svg";
/** Luck and Sanity are percentiles that top out at 99; Luck's bar, and SAN's when it has no max, use it. */
const PERCENT_MAX = 99;

/** One of skill-values' attributes by key ("lck", "san"), whatever their order. */
const attribute = (actor, key) => attributes(actor).find((a) => a.key === key);

/** The player owners' names, "NPC · Keeper rolls" with none, or "" when CoC7's owners can't be read. */
function ownerText(actor) {
  const owners = ownersOf(actor);
  if (owners === null) return "";
  if (!owners.length) return NPC_TEXT;
  return owners.map((user) => user.name).filter(Boolean).join(", ");
}

/** The character's name; cut off with "…" when too long, so the full name is also its hover tooltip. */
function nameLine(actor) {
  const name = element("div", "rollbox-name", actor.name ?? "");
  name.title = actor.name ?? "";
  return name;
}

function portrait(actor, className) {
  const img = element("img", className);
  img.src = actor.img || DEFAULT_PORTRAIT;
  img.alt = "";
  return img;
}

/** One stat with a thin bar under it. `max` null: no bar fill. */
function bar(key, label, value, max) {
  const box = element("div", `rollbox-stat rollbox-stat-${key}`);
  const line = element("div", "rollbox-stat-line");
  line.append(element("span", "rollbox-stat-label", label), element("span", "rollbox-stat-value", value));
  const track = element("div", "rollbox-stat-bar");
  const fill = element("div", "rollbox-stat-fill");
  const n = numberOrNull(String(value).split("/")[0]);
  const ratio = n !== null && max ? Math.max(0, Math.min(1, n / max)) : 0;
  fill.style.width = `${Math.round(ratio * 100)}%`;
  track.append(fill);
  box.append(line, track);
  return box;
}

/** "12/12" for HP and MP, or just the value when there is no max. */
function current(attrib) {
  const value = numberOrNull(attrib?.value);
  const max = numberOrNull(attrib?.max);
  if (value === null) return { text: NO_VALUE, max: null };
  return { text: max === null ? String(value) : `${value}/${max}`, max };
}

/** The mini sheet for one character. */
export function miniSheet(actor) {
  const card = element("section", "rollbox-card rollbox-sheet");
  card.setAttribute("aria-label", `${actor.name ?? ""} mini sheet`);

  const head = element("div", "rollbox-sheet-head");
  const who = element("div", "rollbox-who");
  const occupation = String(actor.system?.infos?.occupation ?? "").trim();
  // "NPC" alone here: "Keeper rolls" doesn't fit after an occupation, and stays on the names card.
  const owners = ownerText(actor);
  const owner = owners === NPC_TEXT ? NPC_SHORT : owners;
  const sub = [occupation, owner].filter(Boolean).join(" · ");
  who.append(nameLine(actor), element("div", "rollbox-sub", sub));
  const open = element("button", "rollbox-open-sheet");
  open.type = "button";
  open.setAttribute("aria-label", "Open the full sheet");
  open.dataset.tooltip = "Open the full sheet";
  const glyph = element("i", "fa-solid fa-up-right-from-square");
  glyph.setAttribute("aria-hidden", "true");
  open.append(glyph);
  open.addEventListener("click", () => openSheet(actor));
  head.append(portrait(actor, "rollbox-portrait"), who, open);

  const attribs = actor.system?.attribs;
  const luck = attribute(actor, "lck");
  const san = attribute(actor, "san");
  const hp = current(attribs?.hp);
  const mp = current(attribs?.mp);
  const sanMax = numberOrNull(san?.max) ?? PERCENT_MAX;
  const stats = element("div", "rollbox-stats");
  stats.append(
    bar("hp", "HP", hp.text, hp.max),
    bar("mp", "MP", mp.text, mp.max),
    bar("san", "SAN", san?.value ?? NO_VALUE, sanMax),
    bar("luck", "Luck", luck?.value ?? NO_VALUE, PERCENT_MAX)
  );

  const chars = element("div", "rollbox-characteristics");
  for (const { key, label, value } of characteristics(actor)) {
    const cell = element("div", "rollbox-characteristic");
    cell.dataset.key = key;
    cell.append(element("span", "rollbox-characteristic-label", label),
      element("span", "rollbox-characteristic-value", value ?? NO_VALUE));
    chars.append(cell);
  }

  card.append(head, stats, chars);
  return card;
}

/**
 * The names card's value columns: `label` heads the column, `value(actor)` fills each row, `className` marks
 * the cells. SAN and Luck by default; the menu host picks others for the open menu.
 */
export const NAMES_COLUMNS = Object.freeze({
  san: Object.freeze({ label: "SAN", className: "rollbox-names-san",
    value: (actor) => attribute(actor, "san")?.value }),
  luck: Object.freeze({ label: "Luck", className: "rollbox-names-luck",
    value: (actor) => attribute(actor, "lck")?.value })
});
const DEFAULT_COLUMNS = Object.freeze([NAMES_COLUMNS.san, NAMES_COLUMNS.luck]);

/**
 * The names card for two or more characters, one row each, in selection order. Information only: no controls.
 * @param {Actor[]} actors
 * @param {{label: string, value: (actor: Actor) => (number|string), className?: string}[]|null} [columns]
 *   the value columns; null or empty gives SAN and Luck.
 */
export function namesCard(actors, columns = null) {
  const cols = columns?.length ? columns : DEFAULT_COLUMNS;
  const card = element("section", "rollbox-card rollbox-names");
  card.setAttribute("aria-label", "Selected characters");
  const head = element("div", "rollbox-names-head");
  card.style.setProperty("--rollbox-cols", String(cols.length));
  head.append(element("span", "rollbox-names-title", `${actors.length} selected`),
    ...cols.map((col) => element("span", "rollbox-names-col", col.label)));
  const list = element("ol", "rollbox-names-list");
  for (const actor of actors) {
    const row = element("li", "rollbox-names-row");
    const who = element("div", "rollbox-who");
    who.append(nameLine(actor), element("div", "rollbox-sub", ownerText(actor)));
    row.append(portrait(actor, "rollbox-portrait-small"), who,
      ...cols.map((col) => element("span", ["rollbox-names-value", col.className].filter(Boolean).join(" "),
        String(cellValue(col, actor)))));
    list.append(row);
  }
  card.append(head, list);
  return card;
}

/** One cell's value, read guarded: a missing value or a failing column shows a dash. */
function cellValue(column, actor) {
  try {
    return column.value(actor) ?? NO_VALUE;
  } catch {
    return NO_VALUE;
  }
}

/**
 * An invisible copy of a character's mini sheet, drawn under the names card in the same grid cell
 * (mini-sheet.css), so the names card is at least as tall as the one-character mini sheet: with two or three
 * selected it has the same height; more rows make it taller. It takes up room only: hidden from sight, from
 * screen readers and from the mouse and keyboard.
 */
export function sheetGhost(actor) {
  const ghost = miniSheet(actor);
  ghost.classList.replace("rollbox-sheet", "rollbox-sheet-ghost");
  ghost.removeAttribute("aria-label");
  ghost.setAttribute("aria-hidden", "true");
  ghost.setAttribute("inert", "");
  return ghost;
}

/** The full CoC7 sheet. render(true) forces it open on both ApplicationV2 and older sheets. */
function openSheet(actor) {
  try {
    actor.sheet?.render(true);
  } catch (error) {
    warn(`couldn't open ${actor.name ?? "the character"}'s sheet.`, error);
  }
}
