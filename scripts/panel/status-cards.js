/** The status cards stacked above one character's sheet. See docs/panel.md. */
import { element, glyph, isKeeper } from "../utils.js";
import { ROLLBOX_STATUSES, getStatuses, setRollboxStatus } from "../status/index.js";

const SVG = "http://www.w3.org/2000/svg";

/** Each status's icon as a 24×24 stroke path, as on the status boards. */
const STATUS_ICONS = Object.freeze({
  dying: "M4 12 H8 L10 7 L14 17 L16 12 H20",
  unconscious: "M5 9 H10 L5 15 H10 M13 5 H17 L13 10 H17",
  majorWound: "M12 3 C12 3 6 10 6 14 a6 6 0 0 0 12 0 C18 10 12 3 12 3 Z",
  dead: "M7 21 V9 a5 5 0 0 1 10 0 V21 Z M12 11 V17 M10 13 H14",
  prone: "M3 16 H21 M6 12 a2 2 0 1 0 0.1 0 M9 13 H18",
  restrained: "M7 7 a3 3 0 1 0 0.1 0 M17 7 a3 3 0 1 0 0.1 0 M10 7 H14 M7 10 V20 M17 10 V20",
  tempInsanity: "M12 4 a8 8 0 1 0 0.1 0 M12 7 a5 5 0 0 1 0 10 a2.5 2.5 0 0 1 0 -5",
  indefInsanity: "M4 12 a4 4 0 1 0 8 0 a4 4 0 1 1 8 0 a4 4 0 1 1 -8 0 a4 4 0 1 0 -8 0",
  aiming: "M12 5 a7 7 0 1 0 0.1 0 M12 2 V6 M12 18 V22 M2 12 H6 M18 12 H22",
  divedForCover: "M4 20 H20 M6 20 V12 H18 V20 M9 12 V9 H15 V12"
});

function statusIcon(id) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("d", STATUS_ICONS[id] ?? "M12 6 a6 6 0 1 0 0.1 0");
  svg.append(path);
  return svg;
}

function clearButton(actor, id, name) {
  const node = element("button", "rollbox-status-clear");
  node.type = "button";
  node.setAttribute("aria-label", `Clear ${name}`);
  node.append(glyph("fa-xmark"));
  node.addEventListener("click", (event) => {
    event.stopPropagation();
    setRollboxStatus(actor, id, false);
  });
  return node;
}

function statusCard({ id, name, kind, detail }, actor) {
  const card = element("div", `rollbox-status-card rollbox-status-${kind}`);
  card.dataset.status = id;
  card.setAttribute("aria-label", `${name}: ${detail}`);
  const icon = element("span", "rollbox-status-icon");
  icon.append(statusIcon(id));
  card.append(icon, element("span", "rollbox-status-name", name));
  if (kind === "rollbox") card.append(element("span", "rollbox-status-by", "Rollbox"));
  if (ROLLBOX_STATUSES.includes(id) && isKeeper()) card.append(clearButton(actor, id, name));
  const tip = element("div", "rollbox-status-tip");
  tip.setAttribute("role", "tooltip");
  tip.append(element("b", "", name), element("span", "", detail));
  card.append(tip);
  return card;
}

/**
 * Builds one character's status cards, the serious ones last (nearest the sheet).
 * @param {Actor} actor
 * @returns {HTMLElement|null} null when there is nothing to show
 */
export function statusCards(actor) {
  let statuses = [];
  try {
    statuses = getStatuses(actor);
  } catch {
    statuses = [];
  }
  if (!statuses.length) return null;
  const stack = element("div", "rollbox-status-cards");
  stack.append(...statuses.slice().reverse().map((status) => statusCard(status, actor)));
  return stack;
}

/**
 * Puts a character's status cards at the top of the container, when it has any.
 * @param {HTMLElement} container
 * @param {Actor} actor
 * @returns {boolean} true when cards were placed
 */
export function placeStatusCards(container, actor) {
  const cards = statusCards(actor);
  if (!cards || !container) return false;
  container.prepend(cards);
  return true;
}
