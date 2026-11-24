/** The one- and two-character sheets drawn in the character panel. See docs/panel.md. */
import { NO_VALUE, element, glyph, numberOrNull, warn } from "../utils.js";
import { attributes, characteristics } from "../skill-values/index.js";
import { ownersOf } from "../roll-requests/index.js";
import { rightClickTargets } from "../shared/index.js";

/** The text under a character with no player owner. */
export const NPC_TEXT = "NPC";
const DEFAULT_PORTRAIT = "icons/svg/mystery-man.svg";
/** Luck's maximum, and SAN's when it has none. */
const PERCENT_MAX = 99;
/** Marks the bottom character's parts on the two-character sheet. */
const SECOND_CLASS = "rollbox-second";

/**
 * Returns one of skill-values' attributes by key ("lck", "san"), whatever their order.
 * @param {Actor} actor
 * @param {string} key
 * @returns {object|undefined}
 */
export const attribute = (actor, key) => attributes(actor).find((a) => a.key === key);

/**
 * Returns the player owners' names, NPC_TEXT with none, or "" when CoC7's owners can't be read.
 * @param {Actor} actor
 * @returns {string}
 */
export function ownerText(actor) {
  const owners = ownersOf(actor);
  if (owners === null) return "";
  if (!owners.length) return NPC_TEXT;
  return owners.map((user) => user.name).filter(Boolean).join(", ");
}

function subText(actor) {
  const occupation = String(actor?.system?.infos?.occupation ?? "").trim();
  const owners = ownerText(actor);
  return [occupation, owners].filter(Boolean).join(" · ");
}

/**
 * Builds the character's name line, with the full name as its tooltip for when it is cut off.
 * @param {Actor} actor
 * @returns {HTMLElement}
 */
export function nameLine(actor) {
  const name = element("div", "rollbox-name", actor.name ?? "");
  name.title = actor.name ?? "";
  return name;
}

/**
 * Builds the character's portrait, Foundry's default one when it has none.
 * @param {Actor} actor
 * @param {string} className
 * @returns {HTMLImageElement}
 */
export function portrait(actor, className) {
  const img = element("img", className);
  img.src = actor.img || DEFAULT_PORTRAIT;
  img.alt = "";
  return img;
}

/**
 * Builds the portrait as a button that deselects the character; the plain portrait without `onDeselect`.
 * @param {Actor} actor
 * @param {string} className
 * @param {(actor: Actor) => void} [onDeselect]
 * @returns {HTMLElement}
 */
export function deselectButton(actor, className, onDeselect) {
  const image = portrait(actor, className);
  if (typeof onDeselect !== "function") return image;
  const button = element("button", "rollbox-deselect");
  button.type = "button";
  button.setAttribute("aria-label", `Deselect ${actor.name ?? ""}`);
  button.append(image, glyph("fa-xmark rollbox-deselect-cross"));
  button.addEventListener("click", () => onDeselect(actor));
  return button;
}

// The right click stops here, so the sheet around it doesn't also target the character.
function valueButton(node, value, ariaLabel, onValue) {
  node.setAttribute("aria-label", ariaLabel);
  node.dataset.value = value.key ?? value.kind;
  node.addEventListener("click", (event) => onValue(event, value, false));
  node.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onValue(event, value, true);
  });
  return node;
}

function cellOf(tag, className) {
  const node = element(tag, className);
  if (tag === "button") node.type = "button";
  return node;
}

function statValue(value) {
  const node = element("span", "rollbox-stat-value");
  const [now, ...rest] = String(value).split("/");
  if (!rest.length) node.textContent = String(value);
  else node.append(element("span", "rollbox-stat-now", now), element("span", "rollbox-stat-of", `/${rest.join("/")}`));
  return node;
}

// `max` null: no bar fill. The band holds the maximum for the CoC7 themes (hidden in Foundry's).
function bar(key, label, value, max, tag = "div") {
  const box = cellOf(tag, `rollbox-stat rollbox-stat-${key}`);
  const line = element("div", "rollbox-stat-line");
  line.append(element("span", "rollbox-stat-label", label), statValue(value));
  const track = element("div", "rollbox-stat-bar");
  const fill = element("div", "rollbox-stat-fill");
  const n = numberOrNull(String(value).split("/")[0]);
  const ratio = n !== null && max ? Math.max(0, Math.min(1, n / max)) : 0;
  fill.style.width = `${Math.round(ratio * 100)}%`;
  track.append(fill);
  const band = element("span", "rollbox-stat-band", max === null || max === undefined ? NO_VALUE : String(max));
  band.setAttribute("aria-hidden", "true");
  box.append(line, track, band);
  return box;
}

function current(attrib) {
  const value = numberOrNull(attrib?.value);
  const max = numberOrNull(attrib?.max);
  if (value === null) return { text: NO_VALUE, max: null };
  return { text: max === null ? String(value) : `${value}/${max}`, max };
}

function sheetHead(actor, onDeselect) {
  const head = element("div", "rollbox-sheet-head");
  const who = element("div", "rollbox-who");
  const sub = element("div", "rollbox-sub", subText(actor));
  sub.title = sub.textContent;
  who.append(nameLine(actor), sub);
  const open = element("button", "rollbox-open-sheet");
  open.type = "button";
  open.setAttribute("aria-label", "Open the full sheet");
  open.dataset.tooltip = "Open the full sheet";
  open.append(glyph("fa-up-right-from-square"));
  open.addEventListener("click", () => openSheet(actor));
  head.append(deselectButton(actor, "rollbox-portrait", onDeselect), who, open);
  return head;
}

// HP and MP first, so both characters of the two-character sheet share the order.
function statsBlock(actor, { tag, onValue, suffix = "" }) {
  const attribs = actor.system?.attribs;
  const luck = attribute(actor, "lck");
  const san = attribute(actor, "san");
  const hp = current(attribs?.hp);
  const mp = current(attribs?.mp);
  const sanBox = bar("san", "SAN", san?.value ?? NO_VALUE, numberOrNull(san?.max) ?? PERCENT_MAX, tag);
  const luckBox = bar("luck", "Luck", luck?.value ?? NO_VALUE, PERCENT_MAX, tag);
  if (tag === "button") {
    valueButton(sanBox, { kind: "san" }, `Sanity${suffix}`, onValue);
    valueButton(luckBox, { kind: "luck" }, `Luck${suffix}`, onValue);
  }
  const hpMp = [bar("hp", "HP", hp.text, hp.max), bar("mp", "MP", mp.text, mp.max)];
  const stats = element("div", "rollbox-stats");
  stats.append(...hpMp, sanBox, luckBox);
  return stats;
}

function levelsOf(half, fifth) {
  const levels = element("span", "rollbox-characteristic-levels");
  levels.setAttribute("aria-hidden", "true");
  levels.append(element("span", "", String(half ?? NO_VALUE)), element("span", "", String(fifth ?? NO_VALUE)));
  return levels;
}

const DERIVED = Object.freeze([["mov", "MOV"], ["build", "Build"], ["db", "DB"]]);

function derivedLine(actor) {
  const line = element("div", "rollbox-derived");
  line.setAttribute("aria-hidden", "true");
  for (const [key, label] of DERIVED) {
    const value = actor.system?.attribs?.[key]?.value;
    const shown = value === undefined || value === null || value === "" ? NO_VALUE : String(value);
    const part = element("span", "rollbox-derived-item");
    part.append(element("span", "rollbox-derived-label", label), element("span", "rollbox-derived-value", shown));
    line.append(part);
  }
  return line;
}

const clickable = (onValue) => (typeof onValue === "function" ? "button" : "div");

/**
 * Builds the character sheet for one character; with `onValue` its characteristics, SAN and Luck are buttons.
 * @param {Actor} actor
 * @param {{onValue?: (event: MouseEvent, value: {kind: string, key?: string}, right: boolean) => void,
 *   onDeselect?: (actor: Actor) => void}} [options]
 * @returns {HTMLElement}
 */
export function characterSheet(actor, { onValue, onDeselect } = {}) {
  const tag = clickable(onValue);
  const card = element("section", "rollbox-card rollbox-sheet");
  card.setAttribute("aria-label", `${actor.name ?? ""} character sheet`);
  const chars = element("div", "rollbox-characteristics");
  for (const { key, label, value, half, fifth } of characteristics(actor)) {
    const cell = cellOf(tag, "rollbox-characteristic");
    cell.dataset.key = key;
    if (tag === "button") valueButton(cell, { kind: "characteristic", key }, `Check ${label}`, onValue);
    const numbers = element("span", "rollbox-characteristic-numbers");
    numbers.append(element("span", "rollbox-characteristic-value", value ?? NO_VALUE), levelsOf(half, fifth));
    cell.append(element("span", "rollbox-characteristic-label", label), numbers);
    chars.append(cell);
  }
  card.append(sheetHead(actor, onDeselect), statsBlock(actor, { tag, onValue }), chars, derivedLine(actor));
  return rightClickTargets(card, actor);
}

/** Whether a character has a player owner; unreadable owners count as none. */
const hasPlayer = (actor) => (ownersOf(actor)?.length ?? 0) > 0;

/** The two characters as [top, bottom]: a player character on top, two of a kind A–Z by name. */
function pairOrder(actors) {
  return [...actors].sort((a, b) => Number(hasPlayer(b)) - Number(hasPlayer(a))
    || String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, { sensitivity: "base" }));
}

/**
 * Builds the character sheet for two characters; with `onValue` each number is that character's value.
 * @param {Actor[]} actors the two selected characters, in any order
 * @param {{onValue?: (event: MouseEvent, value: object, right: boolean, actor: Actor) => void,
 *   onDeselect?: (actor: Actor) => void}} [options]
 * @returns {HTMLElement}
 */
export function pairSheet(actors, { onValue, onDeselect } = {}) {
  const [top, bottom] = pairOrder(actors);
  const tag = clickable(onValue);
  const forActor = (actor) => (tag === "button"
    ? (event, value, right) => onValue(event, value, right, actor) : undefined);
  const card = element("section", "rollbox-card rollbox-sheet rollbox-sheet-pair");
  card.setAttribute("aria-label", `${top.name ?? ""} and ${bottom.name ?? ""} character sheet`);

  const bottomValues = new Map(characteristics(bottom).map((c) => [c.key, c.value]));
  const chars = element("div", "rollbox-characteristics");
  for (const { key, label, value } of characteristics(top)) {
    const tile = element("div", "rollbox-characteristic rollbox-pair-tile");
    tile.dataset.key = key;
    tile.append(element("span", "rollbox-characteristic-label", label));
    for (const [actor, shown] of [[top, value], [bottom, bottomValues.get(key)]]) {
      const number = cellOf(tag, `rollbox-characteristic-value${actor === bottom ? ` ${SECOND_CLASS}` : ""}`);
      number.textContent = String(shown ?? NO_VALUE);
      if (tag === "button") valueButton(number, { kind: "characteristic", key }, `Check ${label}, ${actor.name ?? ""}`, forActor(actor));
      if (actor === top) tile.append(number, element("span", "rollbox-pair-rule"));
      else tile.append(number);
    }
    chars.append(tile);
  }

  const bottomStats = statsBlock(bottom, { tag, onValue: forActor(bottom), suffix: `, ${bottom.name ?? ""}` });
  const bottomHead = sheetHead(bottom, onDeselect);
  bottomStats.classList.add(SECOND_CLASS);
  bottomHead.classList.add(SECOND_CLASS);
  const topHead = sheetHead(top, onDeselect);
  const topStats = statsBlock(top, { tag, onValue: forActor(top), suffix: `, ${top.name ?? ""}` });
  // Each character's own header and stats target them; the shared characteristics belong to no one character.
  for (const [node, actor] of [[topHead, top], [topStats, top], [bottomStats, bottom], [bottomHead, bottom]]) {
    rightClickTargets(node, actor);
  }
  card.append(topHead, topStats, chars, bottomStats, bottomHead);
  return card;
}

/**
 * Builds an invisible, inert copy of a character's sheet that only takes up room under the character cards.
 * @param {Actor} actor
 * @returns {HTMLElement}
 */
export function sheetGhost(actor) {
  const ghost = characterSheet(actor);
  ghost.classList.replace("rollbox-sheet", "rollbox-sheet-ghost");
  ghost.removeAttribute("aria-label");
  ghost.setAttribute("aria-hidden", "true");
  ghost.setAttribute("inert", "");
  return ghost;
}

// render(true) forces it open on both ApplicationV2 and older sheets.
function openSheet(actor) {
  try {
    actor.sheet?.render(true);
  } catch (error) {
    warn(`couldn't open ${actor.name ?? "the character"}'s sheet.`, error);
  }
}
