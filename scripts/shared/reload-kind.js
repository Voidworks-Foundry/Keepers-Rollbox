/** How a firearm reloads in combat: magazine, by the round, or belt. See docs/shared.md. */
import { COC7_ID, MODULE_ID, numberOrNull, warn } from "../utils.js";

/** The name of Rollbox's flag on a firearm item that holds its reload kind. */
export const RELOAD_FLAG = "reloadKind";
/** The reload kinds, in the order the setup check offers them. */
export const RELOAD_KINDS = Object.freeze(["magazine", "rounds", "belt"]);

const MAGAZINE = "magazine";
const ROUNDS = "rounds";
const BELT = "belt";

// CoC7 8.15: every firearm with a capacity in its compendiums, by CoC ID. Two compendiums spell some ids
// differently ("32-or-7-65mm", "32-or-7-65-mm"), so both spellings are listed.
const COCID_RELOAD = Object.freeze({
  // Handguns: revolvers, derringers and single shots load by the round; automatics take a magazine.
  "i.weapon.25-derringer-1b": ROUNDS, "i.weapon.25-derringer-1-b": ROUNDS,
  "i.weapon.32-or-7-65mm-revolver": ROUNDS, "i.weapon.32-or-7-65-mm-revolver": ROUNDS,
  "i.weapon.38-or-9-mm-revolver": ROUNDS, "i.weapon.41-revolver": ROUNDS, "i.weapon.45-revolver": ROUNDS,
  "i.weapon.357-magnum-revolver": ROUNDS, "i.weapon.44-magnum-revolver": ROUNDS, "i.weapon.flintlock": ROUNDS,
  "i.weapon.signal-handgun-flare-gun": ROUNDS, "i.weapon.taser-dart": ROUNDS, "i.weapon.handgun": ROUNDS,
  "i.weapon.22-short-automatic": MAGAZINE, "i.weapon.32-or-7-65mm-automatic": MAGAZINE,
  "i.weapon.32-or-7-65-mm-automatic": MAGAZINE, "i.weapon.38-automatic": MAGAZINE, "i.weapon.45-automatic": MAGAZINE,
  "i.weapon.model-p08-luger": MAGAZINE, "i.weapon.model-p-08-luger": MAGAZINE, "i.weapon.beretta-m-9": MAGAZINE,
  "i.weapon.glock-17-9-mm-auto": MAGAZINE, "i.weapon.imi-desert-eagle": MAGAZINE,
  // Rifles and shotguns: loaded by the round, except those fed by a clip or a detachable magazine.
  "i.weapon.22-bolt-action-rifle": ROUNDS, "i.weapon.30-06-bolt-action-rifle": ROUNDS,
  "i.weapon.30-lever-action-carbine": ROUNDS, "i.weapon.303-lee-enfield": ROUNDS, "i.weapon.444-marlin-rifle": ROUNDS,
  "i.weapon.45-martini-henry-rifle": ROUNDS, "i.weapon.58-springfield-rifle-musket": ROUNDS,
  "i.weapon.col-moran-s-air-rifle": ROUNDS, "i.weapon.rifle": ROUNDS, "i.weapon.shotgun": ROUNDS,
  "i.weapon.elephant-gun-2b": ROUNDS, "i.weapon.elephant-gun-2-b": ROUNDS,
  "i.weapon.10-gauge-shotgun-2-b": ROUNDS, "i.weapon.12-gauge-shotgun-2b": ROUNDS, "i.weapon.12-gauge-shotgun-2-b": ROUNDS,
  "i.weapon.12-gauge-shotgun-2b-sawed-off": ROUNDS, "i.weapon.12-gauge-shotgun-2-b-sawed-off": ROUNDS,
  "i.weapon.16-gauge-shotgun-2b": ROUNDS, "i.weapon.16-gauge-shotgun-2-b": ROUNDS,
  "i.weapon.20-gauge-shotgun-2b": ROUNDS, "i.weapon.20-gauge-shotgun-2-b": ROUNDS,
  "i.weapon.12-gauge-shotgun-pump": ROUNDS, "i.weapon.12-gauge-shotgun-semi-auto": ROUNDS,
  "i.weapon.12-gauge-benelli-m-3-folding-stock": ROUNDS, "i.weapon.12-gauge-spas-folding-stock": ROUNDS,
  "i.weapon.garand-m-1-m-2-rifle": MAGAZINE, "i.weapon.30-06-semi-automatic-rifle": MAGAZINE,
  "i.weapon.sks-carbine": MAGAZINE, "i.weapon.barrett-model-82": MAGAZINE, "i.weapon.m-16-a-2": MAGAZINE,
  "i.weapon.m-4": MAGAZINE, "i.weapon.ak-47-or-akm": MAGAZINE, "i.weapon.ak-74": MAGAZINE,
  "i.weapon.galil-assault-rifle": MAGAZINE, "i.weapon.steyr-aug": MAGAZINE, "i.weapon.beretta-m-70-90": MAGAZINE,
  "i.weapon.fn-fal-light-automatic": MAGAZINE,
  // Submachine guns: magazines.
  "i.weapon.thompson": MAGAZINE, "i.weapon.thompson-20-mag": MAGAZINE, "i.weapon.thompson-30-mag": MAGAZINE,
  "i.weapon.thompson-50-mag": MAGAZINE, "i.weapon.bergmann-mp181-mp2811": MAGAZINE,
  "i.weapon.bergmann-m-p-181-m-p-2811-20-mag": MAGAZINE, "i.weapon.bergmann-m-p-181-m-p-2811-30-mag": MAGAZINE,
  "i.weapon.bergmann-m-p-181-m-p-2811-32-mag": MAGAZINE, "i.weapon.heckler-koch-m-p-5-15-mag": MAGAZINE,
  "i.weapon.heckler-koch-m-p-5-30-mag": MAGAZINE, "i.weapon.skorpion-smg": MAGAZINE, "i.weapon.uzi-smg": MAGAZINE,
  "i.weapon.ingram-mac-11": MAGAZINE,
  // Machine guns: belts, except those fed by a box, pan or drum magazine.
  "i.weapon.vickers-303": BELT, "i.weapon.vickers-303-machine-gun": BELT, "i.weapon.30-browning-m1917a1": BELT,
  "i.weapon.30-browning-m-1917-a-1": BELT, "i.weapon.model-1882-gatling-gun": BELT, "i.weapon.minigun": BELT,
  "i.weapon.fn-minimi-5-56-mm-200-mag": BELT, "i.weapon.fn-minimi-5-56-mm-30-mag": MAGAZINE,
  "i.weapon.mark-i-lewis-gun": MAGAZINE, "i.weapon.mark-i-lewis-gun-47-mag": MAGAZINE,
  "i.weapon.mark-i-lewis-gun-97-mag": MAGAZINE, "i.weapon.bren-gun": MAGAZINE, "i.weapon.bren-gun-30-mag": MAGAZINE,
  "i.weapon.bren-gun-100-mag": MAGAZINE, "i.weapon.browning-auto-rifle-m1918": MAGAZINE,
  "i.weapon.browning-auto-rifle-m-1918": MAGAZINE,
  // Bows, launchers, artillery and the rest: one shot loaded at a time, or a tank or cell changed whole.
  "i.weapon.bow": ROUNDS, "i.weapon.crossbow": ROUNDS, "i.weapon.law": ROUNDS, "i.weapon.m-79-grenade-launcher": ROUNDS,
  "i.weapon.75-mm-field-gun": ROUNDS, "i.weapon.81-mm-mortar": ROUNDS, "i.weapon.120-mm-tank-gun-stabilized": ROUNDS,
  "i.weapon.ship-mounted-5-inch-rifle-stabilized": ROUNDS, "i.weapon.flamethrower": MAGAZINE,
  "i.weapon.lightning-gun": MAGAZINE, "i.weapon.mist-projector": MAGAZINE
});

// "Throw" only as a word of its own: Firearms (Flamethrower) is a firearm.
const NOT_A_FIREARM_SKILL = /(^|[\s(.-])throw($|[\s)])|fighting|brawl|demolition|electrical/i;
const MACHINE_GUN = /machine[\s-]*gun/i;
const SELF_LOADING = /submachine|\bsmg\b|assault/i;
const HANDGUN = /handgun|pistol/i;
const RIFLE_OR_SHOTGUN = /rifle|shotgun|carbine|musket/i;
const BY_THE_ROUND = /revolver|derringer|flintlock/i;
const BY_MAGAZINE = /automatic|semi-?auto|self-loading|magazine|\bclip\b|luger|glock|beretta|mauser|browning|desert eagle/i;

// In a compendium the main skill is written as a CoC ID, not a name.
const skillText = (weapon) => String(weapon?.system?.skill?.main?.name ?? "");
const cocidOf = (weapon) => String(weapon?.flags?.[COC7_ID]?.cocidFlag?.id ?? "");

/**
 * Tells whether Rollbox reloads this weapon: ranged, not thrown, with a capacity, and not on a non-firearm skill.
 * @param {Item} weapon
 * @returns {boolean}
 */
export function isReloadable(weapon) {
  const system = weapon?.system ?? {};
  if (weapon?.type !== undefined && weapon.type !== "weapon") return false;
  if (system.properties?.rngd !== true || system.properties?.thrown === true) return false;
  if (!((numberOrNull(system.bullets) ?? 0) > 0)) return false;
  // CoC7 8.15: its compendiums mark shuriken, mace spray and dynamite ranged with no Thrown tick.
  return !NOT_A_FIREARM_SKILL.test(skillText(weapon));
}

function savedKind(weapon) {
  try {
    const saved = weapon?.getFlag?.(MODULE_ID, RELOAD_FLAG) ?? weapon?.flags?.[MODULE_ID]?.[RELOAD_FLAG];
    return RELOAD_KINDS.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** Works out the kind from the weapon's skill and name; `sure` is false when it only guesses. */
function nameRule(weapon) {
  const skill = skillText(weapon);
  const name = String(weapon?.name ?? "");
  const properties = weapon?.system?.properties ?? {};
  if (MACHINE_GUN.test(skill) && !SELF_LOADING.test(skill)) return { kind: BELT, sure: true };
  if (SELF_LOADING.test(skill) || properties.auto === true || properties.brst === true) return { kind: MAGAZINE, sure: true };
  if (HANDGUN.test(skill)) {
    if (BY_THE_ROUND.test(name)) return { kind: ROUNDS, sure: true };
    return { kind: MAGAZINE, sure: BY_MAGAZINE.test(name) };
  }
  if (RIFLE_OR_SHOTGUN.test(skill)) return { kind: ROUNDS, sure: true };
  return { kind: ROUNDS, sure: false };
}

/**
 * Returns a firearm's reload kind and where it came from: Rollbox's flag, the CoC ID table, or the name rule.
 * @param {Item} weapon
 * @returns {{kind: "magazine"|"rounds"|"belt", source: "flag"|"cocid"|"rule"|"guess"}}
 */
export function reloadSource(weapon) {
  const saved = savedKind(weapon);
  if (saved) return { kind: saved, source: "flag" };
  const listed = COCID_RELOAD[cocidOf(weapon)];
  if (listed) return { kind: listed, source: "cocid" };
  const rule = nameRule(weapon);
  return { kind: rule.kind, source: rule.sure ? "rule" : "guess" };
}

/**
 * Returns how a firearm reloads in combat.
 * @param {Item} weapon
 * @returns {"magazine"|"rounds"|"belt"}
 */
export function reloadKind(weapon) {
  return reloadSource(weapon).kind;
}

/**
 * Saves the kind as Rollbox's flag on the weapon; needs a client that owns the weapon.
 * @param {Item} weapon
 * @param {"magazine"|"rounds"|"belt"} kind
 * @returns {Promise<boolean>} true when saved or already so; false (one warning) when it couldn't be
 */
export async function saveReloadKind(weapon, kind) {
  if (!RELOAD_KINDS.includes(kind) || typeof weapon?.setFlag !== "function") return false;
  if (savedKind(weapon) === kind) return true;
  try {
    await weapon.setFlag(MODULE_ID, RELOAD_FLAG, kind);
    return true;
  } catch (error) {
    warn(`couldn't save how ${weapon.name ?? "the weapon"} reloads.`, error);
    return false;
  }
}
