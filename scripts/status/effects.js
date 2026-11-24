/** What statuses and the situation do to an attack, as bonus and penalty dice (never rolls). See docs/status.md. */
import { hasStatus, getStatuses } from "./statuses.js";
import { MAX_DICE } from "../roll-requests/index.js";

// Mace spray never gets point blank: matched by CoC7's CoC ID, or by name.
const MACE_COCID = "i.weapon.mace-spray";
const MACE_NAME = /\bmace\s*spray\b/i;

/** Returns "firearm" for CoC7's ranged (`rngd`) weapons, "melee" for any other, null with none. */
function weaponKind(weapon) {
  if (!weapon) return null;
  try {
    return weapon.system?.properties?.rngd === true ? "firearm" : "melee";
  } catch {
    return null;
  }
}

function isMaceSpray(weapon) {
  try {
    return weapon?.flags?.CoC7?.cocidFlag?.id === MACE_COCID || MACE_NAME.test(String(weapon?.name ?? ""));
  } catch {
    return false;
  }
}

function targetLine(status, kind, pointBlank) {
  const line = (dice, note, extra = {}) => ({ status: status.id, name: status.name, kind: status.kind, dice, note,
    ...extra });
  if (status.id === "prone") {
    if (kind === "melee") return line(1, "easier to hit when down");
    if (kind === "firearm") {
      return pointBlank ? line(0, "no penalty at point blank") : line(-1, "smaller target for a gun");
    }
    return line(0, "melee 1 bonus die; firearm 1 penalty die");
  }
  if (status.id === "divedForCover") {
    if (kind === "firearm") return line(-1, "dived for cover", { toggle: "cover" });
    return line(0, "no effect on the attack");
  }
  if (status.id === "unconscious") return line(0, "misses only on a fumble", { effect: "misses only on a fumble" });
  return line(0, "no effect on the attack");
}

/**
 * Returns the bonus and penalty dice the target's statuses and the situation give this attack.
 * @param {{attacker: Actor, target: Actor|null, weapon: Item|null, pointBlank?: boolean, intoMelee?: boolean,
 *   outnumbered?: boolean}} attack
 * @returns {{lines: {status: string, name?: string, kind?: string, dice: -1|0|1, note: string, effect?: string,
 *   toggle?: string}[], net: number, total: number, toggles: string[]}} `toggles` are CoC7 card toggles to set;
 *   `net` (the slider's dice) leaves toggled lines out so no die counts twice; `total` is what the card will show
 */
export function attackDice({ attacker, target, weapon, pointBlank = false, intoMelee = false,
  outnumbered = false } = {}) {
  const kind = weaponKind(weapon);
  const mace = kind === "firearm" && isMaceSpray(weapon);
  const close = pointBlank === true && !mace;
  const lines = getStatuses(target).map((status) => targetLine(status, kind, close));
  if (kind === "firearm" && hasStatus(attacker, "prone")) {
    lines.push({ status: "prone", name: "You are prone", kind: "other", dice: 1, note: "shooting while prone" });
  }
  if (target && kind === "firearm" && pointBlank === true) {
    lines.push(mace
      ? { status: "pointBlank", name: "Point blank", kind: "situation", dice: 0, note: "never for mace spray",
        toggle: "noPointBlank" }
      : { status: "pointBlank", name: "Point blank", kind: "situation", dice: 1,
        note: "within a fifth of the shooter's DEX in feet", toggle: "pointBlank" });
  }
  if (target && kind === "firearm" && intoMelee === true) {
    lines.push({ status: "intoMelee", name: "Firing into melee", kind: "situation", dice: -1,
      note: "the target is in melee with someone else", toggle: "inMelee" });
  }
  if (target && kind === "melee" && outnumbered === true) {
    lines.push({ status: "outnumbered", name: "Outnumbered", kind: "situation", dice: 1,
      note: "the target has dodged or fought back this round", toggle: "outnumbered" });
  }
  const clamp = (n) => Math.max(-MAX_DICE, Math.min(MAX_DICE, n));
  const sum = lines.reduce((total, line) => total + (line.toggle ? 0 : line.dice), 0);
  const all = lines.reduce((total, line) => total + line.dice, 0);
  const toggles = [...new Set(lines.map((line) => line.toggle).filter(Boolean))];
  return { lines, net: clamp(sum), total: clamp(all), toggles };
}
