/** The setup check's notice and window, wearing the panel's theme. See docs/setup.md. */
import { element } from "../utils.js";
import { RELOAD_KINDS, button, saveReloadKind } from "../shared/index.js";
import { followTheme } from "../panel/index.js";
import { setWeaponSkill } from "../roll-requests/index.js";
import { firearmKinds, skipForNow } from "./scan.js";

const KIND_LABELS = Object.freeze({ magazine: "Magazine", rounds: "2 rounds at a time", belt: "Belt" });
// Short enough for three in a row.
const KIND_SHORT = Object.freeze({ magazine: "Magazine", rounds: "2 rounds", belt: "Belt" });
const TYPE_LABELS = Object.freeze({ character: "Investigator", npc: "NPC", creature: "Creature" });

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const countText = (issues) => `${plural(issues.length, "thing")} to set up on `
  + `${plural(new Set(issues.map((issue) => issue.actor)).size, "sheet")}.`;

function typeText(actor) {
  const type = TYPE_LABELS[actor?.type] ?? "Sheet";
  return actor?.isToken ? `${type} · token on this scene` : type;
}

const host = () => document.getElementById("interface") ?? document.body;

function portrait(actor) {
  const img = document.createElement("img");
  img.className = "rollbox-setup-portrait";
  img.alt = "";
  const src = actor?.isToken ? actor.token?.texture?.src : actor?.img;
  if (src) img.src = src;
  return img;
}

function openSheet(actor) {
  const node = button("rollbox-btn rollbox-setup-open", "Open sheet", () => {
    try {
      actor?.sheet?.render?.(true);
    } catch {
      // A sheet that can't open: nothing to do.
    }
  });
  return node;
}

function who(actor) {
  const text = element("span", "rollbox-setup-who");
  text.append(element("b", "", actor?.name ?? "?"), element("i", "", typeText(actor)));
  return text;
}

let notice = null;

/**
 * Closes the notice, if it shows.
 * @returns {void}
 */
export function closeNotice() {
  notice?.remove();
  notice = null;
}

/**
 * Shows the notice at the top of the screen, replacing any other; nothing without issues.
 * @param {object[]} issues
 * @returns {HTMLElement|null}
 */
export function showNotice(issues) {
  closeNotice();
  if (!issues?.length) return null;
  notice = element("div", "rollbox-panel rollbox-setup-notice");
  notice.setAttribute("role", "status");
  followTheme(notice);
  const text = element("span", "rollbox-setup-notice-text");
  text.append(element("b", "", "Rollbox:"), ` ${countText(issues)}`);
  const review = button("rollbox-btn rollbox-setup-review", "Review", () => {
    closeNotice();
    openWindow(issues);
  });
  const close = button("rollbox-btn rollbox-setup-dismiss", "✕", () => closeNotice());
  close.setAttribute("aria-label", "Close");
  notice.append(text, review, close);
  host().append(notice);
  return notice;
}

let current = null;

/**
 * Closes the setup window, if it shows.
 * @returns {void}
 */
export function closeWindow() {
  current?.root.remove();
  current = null;
}

/**
 * Opens the setup window on the list, or on Done when there are no issues; closes the notice.
 * @param {object[]} issues the scan's questions
 * @param {{ms?: number}} [scan] how long the scan took, kept as `data-scan-ms`
 * @returns {HTMLElement}
 */
export function openWindow(issues, { ms } = {}) {
  closeWindow();
  closeNotice();
  const root = element("div", "rollbox-panel rollbox-setup");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Rollbox setup check");
  if (Number.isFinite(ms)) root.dataset.scanMs = String(Math.round(ms * 10) / 10);
  followTheme(root);
  current = { root, issues: [...issues], index: 0, status: new Map(), view: issues.length ? "list" : "done", busy: false,
    error: "" };
  host().append(root);
  draw();
  return root;
}

function draw() {
  if (!current) return;
  const { root } = current;
  root.dataset.view = current.view;
  const head = element("div", "rollbox-setup-head");
  const close = button("rollbox-btn rollbox-setup-close", "✕", () => closeWindow());
  close.setAttribute("aria-label", "Close");
  head.append(element("span", "rollbox-setup-title", "Rollbox setup check"), close);
  const body = element("div", "rollbox-setup-body");
  const foot = element("div", "rollbox-setup-foot");
  if (current.view === "list") listView(body, foot);
  else if (current.view === "step") stepView(body, foot);
  else if (current.view === "kinds") kindsView(body, foot);
  else doneView(body, foot);
  if (current.error) {
    const error = element("div", "rollbox-setup-error", current.error);
    error.setAttribute("role", "alert");
    body.append(error);
    current.error = "";
  }
  root.replaceChildren(head, body, foot);
}

const notSaved = (weapon) => `Couldn't save this on ${weapon?.name ?? "the weapon"}. Try again, or open the sheet `
  + "to set it by hand.";

/**
 * Runs one save at a time from a button.
 * @param {() => Promise<boolean>} act
 * @returns {Promise<boolean|null>} false when it failed or threw; null when the window closed or a save is running
 */
async function saving(act) {
  if (!current || current.busy) return null;
  current.busy = true;
  let ok = false;
  try {
    ok = (await act()) === true;
  } catch {
    ok = false;
  }
  if (!current) return null;
  current.busy = false;
  return ok;
}

function bySheet() {
  const sheets = new Map();
  for (const issue of current.issues) {
    if (!sheets.has(issue.actor)) sheets.set(issue.actor, []);
    sheets.get(issue.actor).push(issue);
  }
  return [...sheets.entries()];
}

function sheetRow(actor, badge, done = false) {
  const row = element("div", "rollbox-setup-row");
  const count = element("span", "rollbox-setup-count", badge);
  count.classList.toggle("rollbox-setup-ok", done);
  row.append(portrait(actor), who(actor), count, openSheet(actor));
  return row;
}

function listView(body, foot) {
  body.append(element("div", "rollbox-setup-info", `${countText(current.issues)} Only you see this. Answers Rollbox `
    + "was sure of are already saved; these questions wait for your OK."));
  const list = element("div", "rollbox-setup-list");
  for (const [actor, issues] of bySheet()) list.append(sheetRow(actor, String(issues.length)));
  body.append(list);
  foot.append(button("rollbox-btn rollbox-setup-later", "Later", () => closeWindow()), kindsButton(),
    button("rollbox-btn rollbox-primary rollbox-setup-start", "Review one at a time", () => {
      current.view = "step";
      current.index = 0;
      draw();
    }));
}

function progress() {
  const row = element("div", "rollbox-setup-step");
  row.append(element("span", "", `${current.index + 1} of ${current.issues.length}`));
  const dots = element("span", "rollbox-setup-dots");
  current.issues.forEach((issue, i) => {
    const dot = element("i", "");
    dot.classList.toggle("rollbox-setup-dot-on", i === current.index);
    dot.classList.toggle("rollbox-setup-dot-done", current.status.has(issue.key));
    dots.append(dot);
  });
  row.append(dots);
  return row;
}

function stepView(body, foot) {
  const issue = current.issues[current.index];
  const whoRow = element("div", "rollbox-setup-whorow");
  whoRow.append(portrait(issue.actor), who(issue.actor), openSheet(issue.actor));
  body.append(progress(), whoRow);
  const box = element("div", "rollbox-setup-issue");
  box.dataset.type = issue.type;
  const last = current.index === current.issues.length - 1;
  const then = last ? "finish" : "next";
  const buttons = [button("rollbox-btn rollbox-setup-back", "Back", () => move(-1)),
    button("rollbox-btn rollbox-setup-skip", "Skip", () => { skipForNow(issue); finish(issue, "skipped"); })];
  if (current.index === 0) buttons[0].disabled = true;
  let primary;
  if (issue.type === "reload") {
    const system = issue.weapon.system ?? {};
    const skill = system.skill?.main?.name || "no skill";
    box.append(element("span", "rollbox-setup-question", `How does ${issue.weapon.name} load?`),
      element("span", "rollbox-setup-info", `Rollbox couldn't tell from its name or skill (${skill}, holds `
        + `${system.bullets ?? "?"}). Reloading in combat follows this.`));
    issue.pick ??= issue.guess;
    const choice = element("div", "rollbox-setup-choice");
    choice.setAttribute("role", "radiogroup");
    for (const kind of RELOAD_KINDS) {
      const node = button("rollbox-btn rollbox-setup-kind", KIND_LABELS[kind], () => { issue.pick = kind; draw(); });
      node.dataset.kind = kind;
      node.setAttribute("role", "radio");
      node.setAttribute("aria-checked", String(issue.pick === kind));
      choice.append(node);
    }
    box.append(choice);
    primary = [`Save and ${then}`, () => saveReloadKind(issue.weapon, issue.pick)];
  } else {
    box.append(element("span", "rollbox-setup-question", `${issue.weapon.name} has no skill set`),
      element("span", "rollbox-setup-info", `CoC7's attack card can't roll without it. Links it to `
        + `${issue.skill.name} (${issue.skill.system?.value ?? "?"}%).`));
    primary = [`Fix and ${then}`, () => setWeaponSkill(issue.weapon, issue.skill)];
  }
  body.append(box);
  const [label, act] = primary;
  const go = button("rollbox-btn rollbox-primary rollbox-setup-go", label, async () => {
    const ok = await saving(act);
    if (ok === null) return;
    if (ok) return finish(issue, "done");
    current.error = notSaved(issue.weapon);
    draw();
  });
  foot.append(...buttons, go);
}

function move(step) {
  current.index = Math.max(0, Math.min(current.issues.length - 1, current.index + step));
  draw();
}

function finish(issue, status) {
  if (!current) return;
  current.status.set(issue.key, status);
  if (current.index >= current.issues.length - 1) current.view = "done";
  else current.index += 1;
  draw();
}

function doneView(body, foot) {
  if (current.issues.length) {
    const list = element("div", "rollbox-setup-list");
    for (const [actor, issues] of bySheet()) {
      const states = issues.map((issue) => current.status.get(issue.key));
      const done = states.every((state) => state === "done");
      const badge = done ? "Done" : (states.some((state) => state === "skipped") ? "Skipped" : "Not yet");
      list.append(sheetRow(actor, badge, done));
    }
    body.append(list);
  }
  body.append(element("div", "rollbox-setup-info", current.issues.length
    ? "Setup looks good. New weapons and characters are checked when they're added."
    : "Nothing to set up. New weapons and characters are checked when they're added."));
  foot.append(kindsButton(), button("rollbox-btn rollbox-primary rollbox-setup-done", "Close", () => closeWindow()));
}

function kindsButton() {
  return button("rollbox-btn rollbox-setup-kinds", "Reload kinds", () => {
    current.back = current.view;
    current.view = "kinds";
    draw();
  });
}

function kindsView(body, foot) {
  const guns = firearmKinds();
  body.append(element("div", "rollbox-setup-info", guns.length
    ? "How each firearm reloads in combat. Press a kind to correct it; it is saved at once."
    : "No firearms on the sheets."));
  const list = element("div", "rollbox-setup-list rollbox-setup-kindlist");
  for (const gun of guns) list.append(kindRow(gun));
  body.append(list);
  foot.append(button("rollbox-btn rollbox-setup-back", "Back", () => {
    current.view = current.back ?? "list";
    draw();
  }), button("rollbox-btn rollbox-primary rollbox-setup-done", "Close", () => closeWindow()));
}

function kindRow({ actor, weapon, kind, source }) {
  const row = element("div", "rollbox-setup-kindrow");
  row.dataset.weapon = weapon.id ?? "";
  const text = element("span", "rollbox-setup-who");
  text.append(element("b", "", weapon.name ?? "?"),
    element("i", "", `${actor?.name ?? "?"}${source === "guess" ? " · a guess" : ""}`));
  const head = element("div", "rollbox-setup-kindhead");
  head.append(portrait(actor), text);
  const choice = element("div", "rollbox-setup-choice");
  choice.setAttribute("role", "radiogroup");
  choice.setAttribute("aria-label", `How ${weapon.name ?? "it"} loads`);
  for (const each of RELOAD_KINDS) {
    const node = button("rollbox-btn rollbox-setup-kind", KIND_SHORT[each], async () => {
      const ok = await saving(() => saveReloadKind(weapon, each));
      if (ok === null) return;
      if (!ok) current.error = notSaved(weapon);
      draw();
    });
    node.dataset.kind = each;
    node.setAttribute("role", "radio");
    node.setAttribute("aria-checked", String(kind === each));
    choice.append(node);
  }
  row.append(head, choice);
  return row;
}
