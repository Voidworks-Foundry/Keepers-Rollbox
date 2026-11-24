/**
 * The Action flyout's Spell tab: CoC7's own cast, and the first-casting note CoC7 lacks. See docs/action-flyout.md.
 */
import { MODULE_ID, element, isKeeper, numberOrNull, warn } from "../../utils.js";
import { castSpell, checkRequest, isCheckOf, opposedRequest, send, watchCheck } from "../../roll-requests/index.js";
import { inCombat, markActed, spellCastAt } from "../../combat/index.js";
import { button, runSend, sendSection, showResult } from "../flyout.js";
import { distanceText, edgeDistance } from "../../shared/index.js";
import { castableInCombat } from "./casting-time.js";
import { hideSpellText, noteCasting, showSpellText, spellTextMode, spellTextShown } from "./spell-text.js";
import { tokenOf } from "./weapons.js";

const CAST_FLAG = "castSpells";
// CoC7's legacy cost fields, in display order.
const COSTS = Object.freeze([["magicPoints", "MP"], ["sanity", "SAN"], ["power", "POW"], ["hitPoints", "HP"],
  ["others", ""]]);

function spellsOf(actor, combat = false) {
  let list = [];
  try {
    list = Array.from(actor?.items ?? []).filter((item) => item?.type === "spell");
  } catch {
    return [];
  }
  if (combat) list = list.filter((spell) => castableInCombat(spell));
  const rank = (spell) => (combat && spell.system?.type?.combat === true ? 0 : 1);
  return list.sort((a, b) => rank(a) - rank(b) || String(a.name ?? "").localeCompare(String(b.name ?? "")));
}

function costText(spell) {
  const costs = spell?.system?.costs ?? {};
  return COSTS.map(([key, label]) => [label, String(costs[key] ?? "").trim()])
    .filter(([, value]) => value && value !== "0")
    .map(([label, value]) => (label ? `${label} ${value}` : value)).join(" · ");
}

function castIds(actor) {
  try {
    const ids = actor?.getFlag?.(MODULE_ID, CAST_FLAG);
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

// NPCs and creatures never roll a first casting.
function needsFirstCasting(actor, spell) {
  return actor?.type === "character" && !castIds(actor).includes(spell?.id);
}

async function markCast(actor, spell) {
  if (!spell?.id || typeof actor?.setFlag !== "function") return false;
  const ids = castIds(actor);
  if (ids.includes(spell.id)) return true;
  try {
    await actor.setFlag(MODULE_ID, CAST_FLAG, [...ids, spell.id]);
    return true;
  } catch (error) {
    warn(`couldn't note that ${actor.name} has cast ${spell.name}.`, error);
    return false;
  }
}

const FIRST_CASTING = "First casting: Hard POW check needed";

const FIRST_CASTING_WAIT_MS = 600000;

/** Marks the spell as cast when CoC7's first-casting POW card comes back a success; returns a stop function. */
function watchFirstCasting(actor, spell, { onCast } = {}) {
  if (!actor?.uuid) return () => {};
  return watchCheck(actor, { waitMs: FIRST_CASTING_WAIT_MS, accepts: (result) => isCheckOf(result, "pow"),
    onResult: async (result) => {
      if (result.isSuccess === true && await markCast(actor, spell)) onCast?.();
    } });
}

/**
 * Returns a fresh Spell tab state, which the flyout keeps across redraws so a redraw can't cast twice.
 * @returns {{lastCast: string|null, result: object|null, sending: boolean, textFor: string|null}}
 */
export function spellState() {
  return { lastCast: null, result: null, sending: false, textFor: null };
}

function mpText(actor) {
  const mp = actor?.system?.attribs?.mp ?? {};
  const value = numberOrNull(mp.value);
  if (value === null) return "MP —";
  const max = numberOrNull(mp.max);
  return max === null ? `MP ${value}` : `MP ${value}/${max}`;
}

/**
 * Returns the Spell tab for one character; `limited` greys every cast.
 * @param {{actor: Actor, target: {token: Token|null, text: string|null}, state?: object, redraw?: () => void,
 *   close?: () => void, limited?: boolean}} context
 * @returns {HTMLElement|null} null without a character
 */
export function spellTab({ actor, target, state = spellState(), redraw = () => {}, close = () => {},
  limited = false } = {}) {
  if (!actor) return null;
  const root = element("div", "rollbox-action-spell");
  root.append(element("div", "rollbox-action-mp", mpText(actor)));
  const spells = spellsOf(actor, inCombat(actor));
  const acts = [];
  const menu = {
    get sending() { return state.sending === true; },
    set sending(value) { state.sending = value; },
    update: () => { for (const node of acts) node.disabled = menu.sending || limited; }
  };
  const finish = (result) => {
    state.result = result;
    redraw();
  };

  const cast = (spell, hidden) => (limited ? undefined : runSend(menu, async () => {
    noteCasting(spell, { distance: () => targetLine(actor, target) });
    const castOk = await castSpell(spell, { hidden: hidden && isKeeper() });
    // CoC7's cast returns once its window is answered, so no later window is this cast's.
    noteCasting(null);
    if (!castOk) return { lines: ["CoC7 couldn't cast it; see the console (F12)."] };
    state.lastCast = spell.id;
    await markActed(actor);
    // Rollbox can't tell a heal from a curse, so any spell at a target makes both fighters.
    if (target?.token?.actor) await spellCastAt({ actor, targets: [target.token.actor] });
    if (!needsFirstCasting(actor, spell)) return { lines: [`${spell.name} cast with CoC7's card.`] };
    const request = checkRequest({ checks: [{ kind: "characteristic", name: "pow" }], difficulty: "hard",
      label: `First casting: ${spell.name}` });
    const sent = await send(request, [actor]);
    if (sent.requested.length || sent.rolled.length) {
      watchFirstCasting(actor, spell, { onCast: () => finish({ lines: [`${spell.name} worked: marked as cast.`] }) });
    }
    return { send: sent, words: { what: "First-casting Hard POW check" } };
  }, finish));

  const list = element("div", "rollbox-list rollbox-action-spells");
  const mode = spellTextMode();
  if (!spells.length) {
    list.append(element("div", "rollbox-hint", inCombat(actor) && spellsOf(actor).length
      ? "No spell on the sheet can be cast in a fight (6 rounds or fewer)."
      : `No spells on ${actor.name ?? "this character"}'s sheet.`));
  }
  for (const spell of spells) {
    const row = element("div", "rollbox-row rollbox-action-spell-row");
    row.dataset.spell = spell.id;
    const text = element("span", "rollbox-action-weapon-text");
    text.append(element("span", "rollbox-action-weapon-name", spell.name ?? "?"));
    const details = [spell.system?.castingTime, costText(spell)].filter(Boolean).join(" · ");
    if (details) text.append(element("span", "rollbox-action-weapon-skill", details));
    if (!(spell.system?.costList?.length > 0)) {
      text.append(element("span", "rollbox-hint rollbox-action-note", "Costs aren't automatic: take them by hand."));
    }
    if (needsFirstCasting(actor, spell)) {
      row.classList.add("rollbox-action-first-casting");
      row.title = FIRST_CASTING;
    }
    const buttons = element("span", "rollbox-action-spell-buttons");
    // Cast hidden is the Keeper's only, as Blind is on checks.
    const castButtons = [button("rollbox-btn rollbox-action-cast", "Cast", () => cast(spell, false))];
    if (isKeeper()) castButtons.push(button("rollbox-btn rollbox-action-cast-hidden", "Cast hidden", () => cast(spell, true)));
    acts.push(...castButtons);
    buttons.append(...castButtons);
    row.append(text, buttons);
    textOn(row, spell, mode, state);
    list.append(row);
  }
  root.append(list);

  const after = spells.find((spell) => spell.id === state.lastCast);
  const actions = [];
  // The Keeper's fallback only: a player marking their own spell would skip the first casting's Hard POW roll.
  if (after && isKeeper() && needsFirstCasting(actor, after)) {
    actions.push(button("rollbox-btn rollbox-action-mark-cast", `Mark ${after.name} as cast`, async () => {
      await markCast(actor, after);
      finish({ lines: [`${after.name} marked as cast: no more casting rolls.`] });
    }));
  }
  const opponent = target?.token?.actor ?? null;
  if (after && opponent) {
    actions.push(button("rollbox-btn rollbox-primary rollbox-action-opposed-pow", "Opposed POW with target", () => {
      const request = opposedRequest({ sides: [{ actor, check: { kind: "characteristic", name: "pow" } },
        { actor: opponent, check: { kind: "characteristic", name: "pow" } }] });
      if (!request) return undefined;
      return runSend(menu, () => send(request, []),
        (result) => finish(result ? { send: result, words: { heading: "Opposed POW card made:" } } : null));
    }));
  }
  const cancel = button("rollbox-btn rollbox-action-cancel", "Cancel", () => close());
  cancel.dataset.keep = "";
  const sender = sendSection([...actions, cancel]);
  if (state.result?.send) showResult(sender.result, state.result.send, state.result.words);
  else if (state.result?.lines) {
    sender.result.replaceChildren(...state.result.lines.map((text) => element("div", "rollbox-result-line", text)));
  }
  menu.update();
  root.append(sender.element);
  if (mode === "click" && state.textFor) {
    const spell = spells.find((item) => item.id === state.textFor);
    const row = spell ? [...list.children].find((node) => node.dataset.spell === spell.id) : null;
    // After a redraw, the clicked-open text comes back once the tab is in the flyout.
    if (row) queueMicrotask(() => { if (row.isConnected) showSpellText(spell, row); });
    else state.textFor = null;
  }
  return root;
}

function textOn(row, spell, mode, state) {
  if (mode === "hover") {
    row.addEventListener("mouseenter", () => showSpellText(spell, row));
    row.addEventListener("mouseleave", () => { if (spellTextShown() === spell.id) hideSpellText(); });
  } else if (mode === "click") {
    row.classList.add("rollbox-action-spell-clickable");
    row.addEventListener("click", (event) => {
      if (event.target?.closest?.("button")) return;
      if (spellTextShown() === spell.id) {
        state.textFor = null;
        hideSpellText();
      } else {
        state.textFor = spell.id;
        showSpellText(spell, row);
      }
    });
  }
}

// A spell never requires a target.
function targetLine(actor, target) {
  const token = target?.token;
  if (!token) return null;
  const name = token.actor?.name ?? token.name ?? "";
  const away = distanceText(edgeDistance(tokenOf(actor), token));
  return away ? `Target: ${name}, ${away} away` : `Target: ${name}`;
}
