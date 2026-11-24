/** Rows of compact character cards: the character cards, the players list and the meters. See docs/panel.md. */
import { NO_VALUE, element, numberOrNull, option } from "../utils.js";
import { NPC_TEXT, attribute, deselectButton, nameLine, ownerText, portrait } from "./sheet.js";
import { rightClickTargets } from "../shared/index.js";

/** Luck's maximum, and SAN's when a sheet has no POW to start from. */
const PERCENT_MAX = 99;

function hpOf(actor) {
  const hp = actor?.system?.attribs?.hp ?? {};
  return { value: numberOrNull(hp.value), max: numberOrNull(hp.max) };
}

function mpOf(actor) {
  const mp = actor?.system?.attribs?.mp ?? {};
  return { value: numberOrNull(mp.value), max: numberOrNull(mp.max) };
}

function sanOf(actor) {
  return { value: numberOrNull(attribute(actor, "san")?.value),
    max: numberOrNull(actor?.system?.characteristics?.pow?.value) ?? PERCENT_MAX };
}

function luckOf(actor) {
  return { value: numberOrNull(attribute(actor, "lck")?.value), max: PERCENT_MAX };
}

/** The default value columns, as bars; a column without `bar` (a flyout's own) is a plain number from `value`. */
const METERS = Object.freeze([
  Object.freeze({ key: "hp", label: "HP", className: "rollbox-cards-hp", bar: hpOf }),
  Object.freeze({ key: "mp", label: "MP", className: "rollbox-cards-mp", bar: mpOf }),
  Object.freeze({ key: "san", label: "SAN", className: "rollbox-cards-san", bar: sanOf }),
  Object.freeze({ key: "luck", label: "Luck", className: "rollbox-cards-luck", bar: luckOf })
]);

/** The meters `rollboxCardMeters` can tick, key → label, in the cards' order. */
export const METER_CHOICES = Object.freeze(Object.fromEntries(METERS.map(({ key, label }) => [key, label])));

// Every meter when the setting can't be read; none when none is ticked.
function shownMeters() {
  const saved = option("rollboxCardMeters");
  if (saved === null || saved === undefined || typeof saved[Symbol.iterator] !== "function" || typeof saved === "string") {
    return METERS;
  }
  const keys = new Set(Array.from(saved, String));
  return METERS.filter((col) => keys.has(col.key));
}

function verticalBar({ value, max }, className = "") {
  const node = element("span", ["rollbox-cards-value", "rollbox-vbar", className].filter(Boolean).join(" "));
  const fill = element("i", "rollbox-vbar-fill");
  const ratio = value === null ? 0 : (max ? Math.max(0, Math.min(1, value / max)) : 1);
  fill.style.height = `${Math.round(ratio * 100)}%`;
  node.append(fill, element("b", "rollbox-vbar-value", value === null ? NO_VALUE : String(value)));
  return node;
}

/**
 * Returns one character's ticked meters as bars without a heading row, each named in its hover text.
 * @param {Actor} actor
 * @returns {HTMLElement}
 */
export function meters(actor) {
  const node = element("span", "rollbox-meters");
  node.append(...shownMeters().map((col) => {
    const bar = cell(col, actor);
    bar.title = `${col.label} ${bar.textContent}`;
    return bar;
  }));
  return node;
}

// A missing value or a failing column shows a dash.
function cell(column, actor) {
  try {
    if (column.bar) return verticalBar(column.bar(actor), column.className);
    const value = column.value(actor);
    return element("span", ["rollbox-cards-value", column.className].filter(Boolean).join(" "),
      String(value ?? NO_VALUE));
  } catch {
    return element("span", ["rollbox-cards-value", column.className].filter(Boolean).join(" "), NO_VALUE);
  }
}

function rowsCard(title, cols, label) {
  const card = element("section", "rollbox-card rollbox-cards");
  card.setAttribute("aria-label", label);
  card.style.setProperty("--rollbox-cols", String(cols.length));
  card.classList.toggle("rollbox-cards-bars", cols.some((col) => col.bar));
  const head = element("div", "rollbox-cards-head");
  head.append(element("span", "rollbox-cards-title", title),
    ...cols.map((col) => element("span", "rollbox-cards-col", col.label)));
  const list = element("ol", "rollbox-cards-list");
  card.append(head, list);
  return { card, list };
}

/**
 * Builds the character cards, one per character in selection order.
 * @param {Actor[]} actors
 * @param {{label: string, value: (actor: Actor) => (number|string), className?: string}[]|null} [columns] none: the meters
 * @param {{onDeselect?: (actor: Actor) => void, onPick?: (actor: Actor) => void}} [options]
 * @returns {HTMLElement}
 */
export function characterCards(actors, columns = null, { onDeselect, onPick } = {}) {
  const cols = columns?.length ? columns : shownMeters();
  const { card, list } = rowsCard(`${actors.length} selected`, cols, "Selected characters");
  for (const actor of actors) {
    const row = element("li", "rollbox-character-card");
    const who = element("div", "rollbox-who");
    const sub = element("div", "rollbox-sub", cardSub(actor));
    sub.title = sub.textContent;
    who.append(nameLine(actor), sub);
    const cross = deselectButton(actor, "rollbox-portrait-small", onDeselect);
    // The × only deselects: its click must not also reach the card, which would select that character alone.
    if (cross.tagName === "BUTTON") cross.addEventListener("click", (event) => event.stopPropagation());
    row.append(cross, who, ...cols.map((col) => cell(col, actor)));
    if (typeof onPick === "function") {
      row.classList.add("rollbox-character-card-pick");
      row.addEventListener("click", () => onPick(actor));
    }
    list.append(rightClickTargets(row, actor));
  }
  return card;
}

/**
 * Builds the players list: each player's investigator with the ticked meters.
 * @param {{actor: Actor, user: User}[]} entries
 * @param {{onPick?: (actor: Actor) => void, onScene?: (actor: Actor) => boolean}} [options] a row off the scene is greyed
 * @returns {HTMLElement}
 */
export function playersList(entries, { onPick, onScene = () => true } = {}) {
  const cols = shownMeters();
  const { card, list } = rowsCard("Investigators", cols, "The players' investigators");
  card.classList.add("rollbox-players");
  if (!entries.length) {
    list.append(element("li", "rollbox-players-none", "No player has an investigator assigned."));
    return card;
  }
  for (const { actor, user } of entries) {
    const row = element("li", "rollbox-character-card rollbox-players-row");
    row.dataset.actor = actor.uuid ?? actor.id ?? "";
    const present = safe(() => onScene(actor) !== false, true);
    row.classList.toggle("rollbox-players-away", !present);
    const occupation = String(actor.system?.infos?.occupation ?? "").trim();
    const offline = user?.active === false ? "offline" : "";
    const sub = element("div", "rollbox-sub", [occupation, user?.name ?? "", offline].filter(Boolean).join(" · "));
    sub.title = sub.textContent;
    const who = element("div", "rollbox-who");
    who.append(nameLine(actor), sub);
    row.append(portrait(actor, "rollbox-portrait-small"), who, ...cols.map((col) => cell(col, actor)));
    if (typeof onPick === "function" && present) row.addEventListener("click", () => onPick(actor));
    list.append(rightClickTargets(row, actor));
  }
  return card;
}

function cardSub(actor) {
  const owners = ownerText(actor);
  if (owners === NPC_TEXT) return owners;
  return [String(actor?.system?.infos?.occupation ?? "").trim(), owners].filter(Boolean).join(" · ");
}

function safe(read, fallback) {
  try {
    return read();
  } catch {
    return fallback;
  }
}
