/**
 * The fight's cards and pop-ups above the hotbar, built with textContent so names never become HTML.
 * See docs/combat.md.
 */
import { element } from "../utils.js";
import { button, rightClickTargets } from "../shared/index.js";
import { followTheme } from "../panel/index.js";
import { forgetNotice, noticeStack, placeNotice } from "./notice-place.js";

function portrait(token) {
  const img = document.createElement("img");
  img.className = "rollbox-fight-portrait";
  img.alt = "";
  const src = token?.document?.texture?.src ?? token?.actor?.img;
  if (src) img.src = src;
  return img;
}

let joinWindow = null;

/**
 * Closes the Keeper's Who's joining this fight? window, if it shows.
 * @returns {void}
 */
export function closeJoinWindow() {
  forgetNotice(joinWindow);
  joinWindow?.remove();
  joinWindow = null;
}

/**
 * Closes the Keeper's window as its Cancel does, so its Start combat never builds on an encounter that is gone.
 * @returns {boolean} true when a window was open
 */
export function cancelJoinWindow() {
  if (!joinWindow) return false;
  joinWindow.cancel();
  return true;
}

function attackText(attacker, targets) {
  const names = targets.filter(Boolean);
  const whom = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "someone");
  return `${attacker ?? ""} attacks ${whom}.`;
}

function joinRow(row, onToggle) {
  const node = element("label", "rollbox-fight-row");
  const box = element("input", "rollbox-fight-tick");
  box.type = "checkbox";
  box.checked = row.ticked === true;
  box.disabled = row.fixed === true;
  box.addEventListener("change", () => onToggle(box.checked));
  const who = element("span", "rollbox-fight-who");
  who.append(element("b", "", row.name ?? ""));
  if (row.tags?.length) who.append(element("i", "", row.tags.join(" · ")));
  node.classList.toggle("rollbox-fight-off", !box.checked);
  box.addEventListener("change", () => node.classList.toggle("rollbox-fight-off", !box.checked));
  node.append(box, portrait(row.token), who, element("span", "rollbox-fight-feet",
    Number.isFinite(row.feet) ? `${row.feet} ft` : ""));
  if (!row.fixed) node.dataset.token = row.token?.id ?? "";
  return rightClickTargets(node, () => row.token ?? null);
}

/**
 * Opens the Keeper's Who's joining this fight? window.
 * @param {{attacker: Token, targets: Token[], rows: object[], onAdd: (tokens: Token[]) => Promise<*>, start?: boolean,
 *   onCancel?: Function}} fight the rows from fight.js (`token`, `name`, `investigator`, `feet`, `tags`,
 *   `ticked`); `start`: the first blow's window, whose main button is Start combat (pressable with nobody picked);
 *   `onCancel`: Cancel or ✕ pressed
 * @returns {HTMLElement}
 */
export function openJoinWindow({ attacker, targets = [], rows = [], onAdd, start = false, onCancel }) {
  closeJoinWindow();
  const root = element("div", "rollbox-panel rollbox-fight-window");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Who's joining this fight?");
  followTheme(root);
  const picked = new Set(rows.filter((row) => row.ticked).map((row) => row.token));

  const head = element("div", "rollbox-fight-head");
  const cancel = () => {
    closeJoinWindow();
    onCancel?.();
  };
  const close = button("rollbox-btn rollbox-fight-close", "✕", cancel);
  close.setAttribute("aria-label", "Close");
  head.append(element("span", "rollbox-fight-title", "Who's joining this fight?"), close);

  const body = element("div", "rollbox-fight-body");
  body.append(element("div", "rollbox-fight-info",
    `${attackText(attacker?.name, targets.map((token) => token?.name))} Tick who joins; the rest stand by in the turn order.`));
  const add = button("rollbox-btn rollbox-primary rollbox-fight-add", "", async () => {
    add.disabled = true;
    const tokens = [...picked];
    closeJoinWindow();
    await onAdd?.(tokens);
  });
  const count = () => {
    add.textContent = start ? "Start combat" : `Add to combat (${picked.size})`;
    add.disabled = !start && picked.size === 0;
  };
  const group = (title, list) => {
    if (!list.length) return;
    body.append(element("div", "rollbox-fight-group", title));
    for (const row of list) {
      body.append(joinRow(row, (on) => {
        if (on) picked.add(row.token);
        else picked.delete(row.token);
        count();
      }));
    }
  };
  group("In the fight", [{ name: attacker?.name, token: attacker, tags: ["attacker"], ticked: true, fixed: true },
    ...targets.map((token) => ({ name: token?.name, token, tags: ["target"], ticked: true, fixed: true }))]);
  group("Investigators", rows.filter((row) => row.investigator));
  group("NPCs", rows.filter((row) => !row.investigator));

  const foot = element("div", "rollbox-fight-foot");
  foot.append(button("rollbox-btn rollbox-fight-cancel", "Cancel", cancel), add);
  count();
  root.append(head, body, foot);
  root.cancel = cancel;
  joinWindow = root;
  placeNotice(root, "joinWindow", { handle: head });
  return root;
}

/**
 * Shows a notice whose buttons each close it; with no lead and no text it is just its buttons and ✕ on one line.
 * @param {{lead?: string, text?: string, buttons?: [string, Function, boolean?][], timeout?: number, kind?: string,
 *   onDismiss?: Function, closeBelow?: boolean}} notice `buttons`: label, what it does, whether it is the main one;
 *   `timeout`: closes itself after so many ms; `onDismiss`: its ✕ pressed; `closeBelow`: the ✕ beside the buttons
 * @returns {HTMLElement} the card, with `closeNotice()` to close it from code
 */
export function showFightNotice({ lead = "", text = "", buttons = [], timeout = 0, kind = "added", onDismiss,
  closeBelow = false }) {
  const notice = element("div", "rollbox-panel rollbox-fight-notice");
  notice.setAttribute("role", "status");
  notice.dataset.kind = kind;
  followTheme(notice);
  const bare = !lead && !text;
  const line = element("span", "rollbox-fight-notice-text");
  line.append(element("b", "", lead), text);
  const row = element("div", "rollbox-fight-notice-buttons");
  let timer = null;
  const close = () => {
    clearTimeout(timer);
    forgetNotice(notice);
    notice.remove();
  };
  for (const [label, run, main] of buttons) {
    row.append(button(`rollbox-btn${main ? " rollbox-primary" : ""}`, label, async () => {
      close();
      await run?.();
    }));
  }
  const dismiss = button("rollbox-btn rollbox-fight-dismiss", "✕", () => {
    close();
    onDismiss?.();
  });
  dismiss.setAttribute("aria-label", "Close");
  if (bare || closeBelow) {
    notice.classList.add(bare ? "rollbox-fight-notice-bare" : "rollbox-fight-notice-close-below");
    notice.append(...(bare ? [] : [line]), row, dismiss);
  } else {
    notice.append(line, dismiss, row);
  }
  if (timeout > 0) timer = setTimeout(close, timeout);
  notice.closeNotice = close;
  noticeStack().append(notice);
  placeNotice(notice, kind, { handle: bare ? null : line });
  return notice;
}

/**
 * Closes every notice, those moved out of the stack too.
 * @returns {void}
 */
export function closeFightNotices() {
  document.querySelector(".rollbox-fight-notices")?.remove();
  for (const notice of document.querySelectorAll(".rollbox-fight-notice")) {
    forgetNotice(notice);
    notice.remove();
  }
}

/**
 * Closes every notice of this kind.
 * @param {string} kind
 * @returns {void}
 */
export function closeNoticesOf(kind) {
  for (const notice of document.querySelectorAll(".rollbox-fight-notice")) {
    if (notice.dataset.kind === kind) notice.closeNotice?.();
  }
}

let joiningCard = null;

/**
 * Closes the Keeper's joining card, if it shows.
 * @returns {void}
 */
export function closeJoiningCard() {
  forgetNotice(joiningCard);
  joiningCard?.remove();
  joiningCard = null;
}

function joiningRow(row, done) {
  const node = element("div", "rollbox-fight-joining-row");
  node.dataset.token = row.id ?? "";
  const who = element("span", "rollbox-fight-joining-who");
  who.append(element("b", "", row.name ?? ""), ` (in sight of ${row.by ?? "a fighter"}${row.asks ? "; asks their player" : ""})`);
  const answer = (run) => async () => {
    node.remove();
    done();
    await run?.();
  };
  const buttons = element("span", "rollbox-fight-joining-buttons");
  buttons.append(button("rollbox-btn rollbox-fight-leave-out", "Leave out", answer(row.onLeaveOut)),
    button("rollbox-btn rollbox-primary rollbox-fight-add-one", "Add", answer(row.onAdd)));
  node.append(who, buttons);
  return rightClickTargets(node, () => globalThis.canvas?.tokens?.get?.(row.id) ?? null);
}

/**
 * Shows the Keeper's one joining card, or lists the new rows on the one already up; it closes once all are answered.
 * @param {{key: string, rows: {id: string, name: string, by: string, asks?: boolean, onAdd: Function,
 *   onLeaveOut: Function}[], onAddAll?: (ids: string[]) => Promise<*>, onLeaveAll?: (ids: string[]) => Promise<*>}}
 *   card `onAddAll` / `onLeaveAll`: answer these rows in one go (else each row's own Add or Leave out runs)
 * @returns {HTMLElement}
 */
export function showJoiningCard({ key, rows = [], onAddAll, onLeaveAll }) {
  if (!joiningCard?.isConnected || joiningCard.dataset.key !== key) {
    closeJoiningCard();
    const card = element("div", "rollbox-panel rollbox-fight-notice rollbox-fight-joining");
    card.setAttribute("role", "status");
    card.dataset.kind = "joining";
    card.dataset.key = key;
    followTheme(card);
    const line = element("span", "rollbox-fight-notice-text");
    line.append(element("b", "", "Coming into range:"), " add them to the fight, or leave them out for the rest of it.");
    const dismiss = button("rollbox-btn rollbox-fight-dismiss", "✕", () => closeJoiningCard());
    dismiss.setAttribute("aria-label", "Close");
    const all = element("div", "rollbox-fight-notice-buttons rollbox-fight-joining-all");
    all.append(button("rollbox-btn rollbox-fight-leave-all", "Leave all", () => answerAll(card, "leave")),
      button("rollbox-btn rollbox-primary rollbox-fight-add-all", "Add all", () => answerAll(card, "add")));
    card.append(line, dismiss, element("div", "rollbox-fight-joining-list"), all);
    joiningCard = card;
    noticeStack().append(card);
    placeNotice(card, "joining", { handle: line });
  }
  const card = joiningCard;
  const list = card.querySelector(".rollbox-fight-joining-list");
  const all = card.querySelector(".rollbox-fight-joining-all");
  const done = () => {
    if (!list.childElementCount) closeJoiningCard();
    else all.hidden = list.childElementCount < 2;
  };
  card.answers = { rows: new Map(rows.map((row) => [row.id ?? "", row])), onAddAll, onLeaveAll };
  list.replaceChildren(...rows.map((row) => joiningRow(row, done)));
  all.hidden = rows.length < 2;
  return card;
}

async function answerAll(card, how) {
  const { rows = new Map(), onAddAll, onLeaveAll } = card.answers ?? {};
  const ids = [...card.querySelectorAll(".rollbox-fight-joining-row")].map((node) => node.dataset.token ?? "");
  if (joiningCard === card) closeJoiningCard();
  else card.remove();
  const together = how === "add" ? onAddAll : onLeaveAll;
  if (typeof together === "function") return together(ids);
  for (const id of ids) await rows.get(id)?.[how === "add" ? "onAdd" : "onLeaveOut"]?.();
  return undefined;
}

let joinCard = null;

/**
 * Closes the player's join card, if it shows.
 * @returns {void}
 */
export function closeJoinCard() {
  forgetNotice(joinCard);
  joinCard?.remove();
  joinCard = null;
}

/**
 * Shows the player's join card, once per combatant: a redraw with the same one keeps it as it is.
 * @param {{key: string, text: string, onJoin: Function, onStay: Function}} card
 * @returns {HTMLElement}
 */
export function showJoinCard({ key, text, onJoin, onStay }) {
  if (joinCard?.isConnected && joinCard.dataset.key === key) return joinCard;
  closeJoinCard();
  const card = element("div", "rollbox-panel rollbox-fight-notice rollbox-fight-join");
  card.setAttribute("role", "status");
  card.dataset.key = key;
  followTheme(card);
  const line = element("span", "rollbox-fight-notice-text");
  line.append(element("b", "", "A fight has broken out:"), ` ${text}`);
  const row = element("div", "rollbox-fight-notice-buttons");
  const answer = (run) => async () => {
    closeJoinCard();
    await run?.();
  };
  row.append(button("rollbox-btn rollbox-fight-stay", "Stay out", answer(onStay)),
    button("rollbox-btn rollbox-primary rollbox-fight-join-button", "Join the fight", answer(onJoin)));
  card.append(line, row);
  joinCard = card;
  noticeStack().append(card);
  placeNotice(card, "join", { handle: line });
  return card;
}

/**
 * Shows a Keeper's pop-up whose steps are redrawn as it is answered; buttons grey while one's `run` is on its way.
 * @param {{kind: string, key?: string}} popup `kind`: the notice kind (its own place and size, notice-place.js);
 *   `key`: tells one pop-up from another of its kind
 * @returns {{card: HTMLElement, draw: (step: {title: string, text?: string, waiting?: boolean,
 *   list?: {label?: string, rows: {name: string, status: string, state?: string, buttons?: object[]}[]},
 *   sections?: {label?: string, buttons: {label: string, run: Function, main?: boolean, disabled?: boolean,
 *   title?: string}[]}[], onDismiss?: Function}) => void, close: () => void}}
 */
export function showPopup({ kind, key = "" }) {
  const card = element("div", "rollbox-panel rollbox-fight-notice rollbox-popup");
  card.setAttribute("role", "dialog");
  card.dataset.kind = kind;
  card.dataset.key = key;
  followTheme(card);
  const head = element("span", "rollbox-fight-notice-text rollbox-popup-head");
  const body = element("div", "rollbox-popup-body");
  let dismissed = null;
  const close = () => {
    forgetNotice(card);
    card.remove();
  };
  const dismiss = button("rollbox-btn rollbox-fight-dismiss", "✕", () => {
    close();
    dismissed?.();
  });
  dismiss.setAttribute("aria-label", "Close");
  card.append(head, dismiss, body);
  const draw = ({ title, text = "", waiting = false, list = null, sections = [], onDismiss } = {}) => {
    if (onDismiss) dismissed = onDismiss;
    head.replaceChildren(element("b", "", title ?? ""));
    const parts = [];
    if (text) parts.push(element("div", `rollbox-popup-text${waiting ? " rollbox-popup-waiting" : ""}`, text));
    if (list) parts.push(...popupList(list));
    const all = [];
    for (const section of sections) {
      if (section.label) parts.push(element("div", "rollbox-popup-label", section.label));
      const row = element("div", "rollbox-fight-notice-buttons rollbox-popup-buttons");
      for (const spec of section.buttons ?? []) {
        const node = button(`rollbox-btn${spec.main ? " rollbox-primary" : ""}`, spec.label, async () => {
          for (const each of all) each.disabled = true;
          try {
            await spec.run?.();
          } finally {
            for (const each of all) each.disabled = each.dataset.off === "true";
          }
        });
        node.disabled = spec.disabled === true;
        node.dataset.off = String(spec.disabled === true);
        if (spec.title) node.title = spec.title;
        all.push(node);
        row.append(node);
      }
      parts.push(row);
    }
    body.replaceChildren(...parts);
  };
  noticeStack().append(card);
  placeNotice(card, kind, { handle: head });
  return { card, draw, close };
}

function popupList({ label = "", rows = [] }) {
  const parts = [];
  if (label) parts.push(element("div", "rollbox-popup-label", label));
  const box = element("ul", "rollbox-popup-list");
  for (const row of rows) {
    const item = element("li", "rollbox-popup-row");
    const status = element("span", "rollbox-popup-status", row.status ?? "");
    status.dataset.state = row.state ?? "";
    item.append(element("span", "rollbox-popup-name", row.name ?? ""), status);
    if (row.buttons?.length) {
      const own = element("span", "rollbox-popup-row-buttons");
      for (const spec of row.buttons) {
        const node = button("rollbox-btn rollbox-popup-row-button", spec.label, () => spec.run?.());
        node.disabled = spec.disabled === true;
        own.append(node);
      }
      item.append(own);
    }
    box.append(item);
  }
  parts.push(box);
  return parts;
}
