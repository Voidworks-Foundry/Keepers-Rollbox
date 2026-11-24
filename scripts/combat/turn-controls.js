/** The turn controls under the turn order: Delay, Flee, End turn, End combat and standby. See docs/combat.md. */
import { element, plays, warn } from "../utils.js";
import { currentCombatant } from "./encounter.js";
import { markNote } from "./round-notes.js";
import { delayRoom, delayTurn } from "./delay.js";
import { actingNow, actsNextRound, actsThisRound, standingBy } from "./fight-state.js";
import { leaveOut, placeOnStandby } from "./fight.js";
import { askFight } from "./fight-relay.js";
import { fleeNotice } from "./flee.js";
import { hasStatus } from "../status/index.js";

export { DELAY_FLAG, delayTurn, restoreDelayed } from "./delay.js";

const LABELS = Object.freeze({
  delay: "Delay", flee: "Flee", end: "End turn", endMine: "End my turn", endCombat: "End combat",
  standby: "Place on standby", leaveOut: "Leave out", acts: "Act this round", removeStandby: "Remove from standby",
  rejoin: "Rejoin the fight",
  confirmEnd: "Confirm end turn", confirmDelay: "Confirm delay", confirmFlee: "Confirm flee combat",
  confirmEndCombat: "Confirm end combat", confirmLeaveOut: "Confirm leave out",
  restrained: "Restrained: break free first", override: "Override",
  nobodyAfter: "Nobody comes after you this round: nobody to delay behind"
});

// Kept per encounter and turn so redraws don't lose it; `places` null means to the end of the order.
let state = { key: "", mode: null, armed: null, places: null };

function turnKey(combat) {
  return `${combat?.id ?? ""}:${combat?.round ?? ""}:${combat?.turn ?? ""}`;
}

function currentState(combat) {
  const key = turnKey(combat);
  if (state.key !== key) state = { key, mode: null, armed: null, places: null };
  return state;
}

/**
 * Forgets the controls' state.
 * @returns {void}
 */
export function resetTurnControls() {
  state = { key: "", mode: null, armed: null, places: null };
}

/**
 * Returns how many places Delay's arrows chose, for the turn order's live preview.
 * @param {Combat|null} combat
 * @returns {number} the places (0: nothing to show)
 */
export function delayPreview(combat) {
  if (!combat || state.key !== turnKey(combat) || state.mode !== "delay") return 0;
  return Math.max(0, Math.min(delayRoom(combat), Number(state.places) || 0));
}

function mayEndTurn(combatant, user) {
  return user?.isGM === true || plays(combatant?.actor, user);
}

// Players can't remove combatants, so a player's Flee stays a note until the Keeper's flee notice.
async function endTurn(combat, mode, keeper, places = null) {
  const combatant = currentCombatant(combat);
  if (!combat || !combatant) return false;
  if (mode === "delay") return delayTurn(combat, places ?? delayRoom(combat));
  try {
    if (mode === "flee") await markNote(combatant.actor, "fled");
    await combat.nextTurn();
    if (mode === "flee" && keeper) {
      const name = combatant.actor?.name ?? combatant.name ?? "";
      await combatant.delete();
      fleeNotice(name);
    } else if (mode === "flee") {
      await askFight("fled", combatant);
    }
    return true;
  } catch (error) {
    warn("couldn't end the turn.", error);
    return false;
  }
}

// What Foundry's End Combat does after its dialog; Rollbox's confirm takes the dialog's place.
async function endEncounter(combat) {
  try {
    await combat?.delete();
    return true;
  } catch (error) {
    warn("couldn't end the encounter.", error);
    return false;
  }
}

function arrow(className, text, label, disabled, run) {
  const node = button(`rollbox-turn-arrow ${className}`, text);
  node.setAttribute("aria-label", label);
  node.title = label;
  node.disabled = disabled;
  node.addEventListener("click", run);
  return node;
}

function button(className, text) {
  const node = element("button", `rollbox-turn-button ${className}`, text);
  node.type = "button";
  return node;
}

// Greyed while the Keeper's client answers; a press that didn't go through comes back and the caller redraws.
function askFightButton(node, action, combatant, extra, onChange) {
  node.addEventListener("click", async () => {
    node.disabled = true;
    if (!(await askFight(action, combatant, extra))) {
      node.disabled = false;
      onChange?.();
    }
  });
  return node;
}

/**
 * Builds the Act this round toggle for a standing-by combatant; the Keeper's client saves it.
 * @param {Combatant} combatant
 * @param {Combat} combat
 * @param {() => void} [onChange] the press didn't go through; the caller redraws
 * @returns {HTMLButtonElement}
 */
export function actsButton(combatant, combat, onChange) {
  const acts = actsNextRound(combatant, combat) || actsThisRound(combatant, combat);
  const toggle = button("rollbox-turn-acts", LABELS.acts);
  toggle.setAttribute("aria-pressed", String(acts));
  toggle.classList.toggle("rollbox-active", acts);
  return askFightButton(toggle, "acts", combatant, { on: !acts }, onChange);
}

/**
 * Builds Rejoin the fight for the player's standing-by box, the join card's Join the fight path.
 * @param {Combatant} combatant
 * @param {() => void} [onChange] the press didn't go through; the caller redraws
 * @returns {HTMLButtonElement}
 */
export function rejoinButton(combatant, onChange) {
  const rejoin = button("rollbox-turn-rejoin", LABELS.rejoin);
  rejoin.title = "Back in the turn order as a fighter, at your own place";
  return askFightButton(rejoin, "join", combatant, {}, onChange);
}

/**
 * Builds the turn controls for this user and encounter.
 * @param {{combat: Combat|null, user: User, onChange?: () => void, outside?: boolean, selected?: Combatant|null}}
 *   context `onChange` redraws the caller (else the controls redraw in place); `outside` offers only End combat;
 *   `selected` is whom Delay, Flee and standby act for (default: the current turn's)
 * @returns {HTMLElement|null} the controls, or null with no encounter or nothing this user may press
 */
export function turnControls({ combat, user, onChange, outside = false, selected = null } = {}) {
  if (!combat?.started || !user) return null;
  const keeper = user.isGM === true;
  const combatant = currentCombatant(combat);
  const mayEnd = combatant && mayEndTurn(combatant, user);
  if (!keeper && !mayEnd) return null;
  const current = currentState(combat);
  const root = element("div", "rollbox-turn-controls");
  const redraw = () => {
    if (typeof onChange === "function") return onChange();
    const next = turnControls({ combat, user, onChange, outside, selected });
    if (next) root.replaceWith(next);
    else root.remove();
  };

  if (keeper && outside) {
    root.append(endCombatButton(current, combat, redraw));
    return root;
  }
  const chosen = keeper && selected ? selected : combatant;
  // Acting from standby on their turn: a fighter's controls for that turn.
  const fighting = !standingBy(chosen) || actingNow(chosen, combat);
  const ownTurn = fighting && chosen === combatant;
  // The Keeper's selected standing-by combatant: Act this round · Leave out, Remove from standby, End combat.
  const onStandby = keeper && !fighting;
  // Delay and Flee are the selected character's own turn's: off it (or standing by) their question goes.
  if (!ownTurn && current.mode) {
    current.mode = null;
    current.armed = null;
  }
  // Leave out is asked under Delay, or for a selected standing-by combatant.
  if (current.armed === "leaveOut" && current.mode !== "delay" && !onStandby) current.armed = null;
  // Someone standing by has no End turn, so its question goes too.
  if (onStandby && current.armed === "end") current.armed = null;
  const context = { current, combat, chosen, keeper, mayEnd, redraw, room: delayRoom(combat) };
  if (ownTurn) root.append(modeToggles(context));
  root.append(...(onStandby ? standbyRows(context) : fighterRows(context)));
  return root;
}

function modeToggles({ current, chosen, keeper, mayEnd, redraw, room }) {
  const held = restrained(chosen);
  const toggles = element("div", "rollbox-turn-row");
  for (const mode of ["delay", "flee"]) {
    const toggle = button(`rollbox-turn-${mode}`, LABELS[mode]);
    toggle.setAttribute("aria-pressed", String(current.mode === mode));
    toggle.classList.toggle("rollbox-active", current.mode === mode);
    // The Keeper's last fighter of the round can still press Delay: Place on standby and Leave out are its choices.
    toggle.disabled = !mayEnd || (mode === "delay" && room < 1 && !keeper);
    if (mode === "delay" && toggle.disabled) toggle.title = LABELS.nobodyAfter;
    if (mode === "flee" && held && current.mode !== "flee") holdFlee(toggle, keeper);
    toggle.addEventListener("click", () => {
      current.mode = current.mode === mode ? null : mode;
      // Delay and Flee ask at once: a toggle that only changed its border looked as if the press did nothing.
      current.armed = current.mode ? "end" : null;
      current.places = null;
      redraw();
    });
    toggles.append(toggle);
  }
  return toggles;
}

function standbyRows({ current, combat, chosen, redraw }) {
  const row = element("div", "rollbox-turn-row rollbox-turn-keeper-row");
  row.append(actsButton(chosen, combat, redraw), leaveOutButton(current, combat, chosen, redraw));
  const remove = element("div", "rollbox-turn-row rollbox-turn-keeper-row");
  remove.append(removeStandbyButton(current, chosen, redraw));
  return [row, remove, endCombatButton(current, combat, redraw)];
}

function fighterRows(context) {
  const { current, combat, chosen, keeper, mayEnd, redraw, room } = context;
  const delaying = current.mode === "delay" && mayEnd;
  // Nobody left to delay behind: Place on standby · Leave out in End turn's row, End combat under them.
  if (delaying && keeper && room < 1) {
    return [keeperRow(current, combat, chosen, redraw), endCombatButton(current, combat, redraw)];
  }
  const end = endButton(current, combat, keeper, mayEnd, redraw);
  // Delay pressed: the arrows in End turn's row; the Keeper's Place on standby · Leave out in End combat's.
  if (delaying) return [delayRow(context, end), ...(keeper ? [keeperRow(current, combat, chosen, redraw)] : [])];
  return [end, ...(keeper ? [endCombatButton(current, combat, redraw)] : [])];
}

function delayRow({ current, redraw, room }, end) {
  const row = element("div", "rollbox-turn-row rollbox-turn-delay-row");
  const set = (places) => {
    current.places = places;
    redraw();
  };
  const places = current.places ?? 0;
  row.append(arrow("rollbox-turn-up", "←", "One place back up", places < 1, () => set(places - 1 || null)),
    end, arrow("rollbox-turn-down", "→", "One place further down", places >= room, () => set(Math.min(room, places + 1))));
  return row;
}

// The first press arms the question (the button reads its confirm); the second runs it. A run that didn't go
// through redraws, so the question drops; one that did redraws through Foundry's hooks.
function confirmButton(current, armed, className, text, run, redraw) {
  const node = button(className, text);
  node.classList.toggle("rollbox-confirm", current.armed === armed);
  node.addEventListener("click", async () => {
    if (current.armed !== armed) {
      current.armed = armed;
      return redraw();
    }
    resetTurnControls();
    if (!(await run())) redraw();
  });
  return node;
}

function endButton(current, combat, keeper, mayEnd, redraw) {
  const delayText = current.places ? `${LABELS.confirmDelay} (${current.places})` : LABELS.confirmDelay;
  const askText = { delay: delayText, flee: LABELS.confirmFlee }[current.mode] ?? LABELS.confirmEnd;
  // Under Delay the button reads its confirm even while Leave out asks, so the arrows never frame "End turn".
  const asking = current.armed === "end" || current.mode === "delay";
  const text = asking ? askText : (keeper ? LABELS.end : LABELS.endMine);
  // resetTurnControls replaces the state object, so `current` still holds the mode and places pressed.
  const end = confirmButton(current, "end", "rollbox-turn-end", text,
    () => endTurn(combat, current.mode, keeper, current.places), redraw);
  if (current.mode === "delay" && !current.places) end.title = "To the end of the turn order";
  end.disabled = !mayEnd;
  return end;
}

function restrained(combatant) {
  try {
    return hasStatus(combatant?.actor, "restrained");
  } catch {
    return false;
  }
}

// The Keeper's held Flee stays pressable as an Override, since its own confirm is the ask; a player's is disabled.
function holdFlee(toggle, keeper) {
  toggle.classList.add("rollbox-turn-held");
  toggle.title = LABELS.restrained;
  if (!keeper) {
    toggle.disabled = true;
    return;
  }
  toggle.addEventListener("mouseenter", () => { toggle.textContent = LABELS.override; });
  toggle.addEventListener("mouseleave", () => { toggle.textContent = LABELS.flee; });
}

// Leave out's question keeps Delay on, so the row stays while it asks.
function keeperRow(current, combat, chosen, redraw) {
  const row = element("div", "rollbox-turn-row rollbox-turn-keeper-row");
  const standby = button("rollbox-turn-standby-button", LABELS.standby);
  standby.title = "Their turn ends; they stand by at the back of the order, greyed and skipped";
  standby.addEventListener("click", async () => {
    standby.disabled = true;
    resetTurnControls();
    if (!(await placeOnStandby(chosen, true))) redraw();
  });
  row.append(standby, leaveOutButton(current, combat, chosen, redraw));
  return row;
}

function leaveOutButton(current, combat, chosen, redraw) {
  const out = confirmButton(current, "leaveOut", "rollbox-turn-leave-out",
    current.armed === "leaveOut" ? LABELS.confirmLeaveOut : LABELS.leaveOut, () => leaveOut(chosen, combat), redraw);
  out.title = "Out of the turn order for the rest of this fight (Add to combat brings them back)";
  return out;
}

function removeStandbyButton(current, chosen, redraw) {
  const remove = button("rollbox-turn-remove-standby", LABELS.removeStandby);
  remove.title = "Back in the turn order as a fighter, at their own place";
  remove.addEventListener("click", async () => {
    remove.disabled = true;
    current.armed = null;
    if (!(await placeOnStandby(chosen, false))) redraw();
  });
  return remove;
}

function endCombatButton(current, combat, redraw) {
  return confirmButton(current, "endCombat", "rollbox-turn-end-combat",
    current.armed === "endCombat" ? LABELS.confirmEndCombat : LABELS.endCombat, () => endEncounter(combat), redraw);
}
