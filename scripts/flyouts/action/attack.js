/** The Action flyout's Attack tab: weapons, reloads, Aim, multi-shot, CoC7's attack card. See docs/action-flyout.md. */
import { KEEPER, declareSettings, element, isKeeper } from "../../utils.js";
import {
  addAttacks, damageText, fightingSkill, fightingSkills, improvisedRequest, isManeuverWeapon, loadOneRound, missingAttacks,
  reloadWeapon, send, setWeaponSkill, skillUnset, startAttack, unarmedOnSheet
} from "../../roll-requests/index.js";
import { MELEE_REACH_DEFAULT, reloadSource, saveReloadKind } from "../../shared/index.js";
import { skills } from "../../skill-values/index.js";
import {
  aboutToAttack, asksFirst, attackMade, attacksMade, attacksPerRound, clearAiming, drawnGun, hasActed, inCombat,
  inCombatFor, isAiming, markActed, markAiming, markAttack, postNoticeCard, readiesAsFirearm
} from "../../combat/index.js";
import { button, levels, levelsNode, line, runSend, segmented, sendSection, showResult, textInput } from "../flyout.js";
import { IMPROVISED, IMPROVISED_SKILLS, improvisedSkill, otherSkillList } from "../improvised.js";
import { targetToken } from "./target.js";
import { UNARMED, clearPickedWeapon, isFirearm, isMelee, pickedWeapon, setPickedWeapon, weaponsFor } from "./weapons.js";
import { addLine, askKeeperText, promptBox } from "./prompt.js";
import { postReloadCard } from "./reload-card.js";

/** Declares this part's Gameplay setting, registered by settings.js. */
export const SETTINGS = declareSettings([
  { key: "rollboxMeleeReach", scope: "world", type: Number, range: { min: 1, max: 10, step: 0.5 }, default: MELEE_REACH_DEFAULT,
    section: "gameplay", label: "Melee reach (m)",
    hint: "How close, in metres and edge to edge, a target must be for a melee weapon (the scene's feet are converted; "
      + "no grid needed). Also how close someone must be to a shot's target for it to count as firing into melee.",
    note: KEEPER }
]);


const MISSING = Object.freeze({
  pick: "Pick a weapon, or an improvised weapon.",
  reach: "Out of reach: move closer, or pick a ranged weapon.",
  empty: "Empty: reload, or load one and fire.",
  emptyOut: "Empty: reload.",
  what: "Type what the improvised weapon is.",
  skill: "Pick the skill it uses.",
  damage: "Damage is dice, e.g. 1D6, 1D6+2 or 1D6+DB.",
  target: "A melee attack needs a target: target a token, or type one.",
  noSkill: (name) => `${name} has no skill on the sheet, so CoC7's card can't roll: set it on the weapon's sheet.`,
  askSkill: (name) => `Your ${name} has no skill set. Ask your Keeper to fix it.`
});

/**
 * Returns a fresh Attack tab state; `sending` lives here so a redraw mid-send can't start a second attack.
 * @returns {object}
 */
export function attackState() {
  return { pick: null, what: "", skill: "brawl", other: "", damage: "", result: null, sending: false, prompt: null,
    multi: false, shots: 0, holster: null };
}

const reachText = (metres) => `${Math.round((Number(metres) || 0) * 10) / 10} m`;

function detailText(entry) {
  const skill = entry.skill?.name ?? "no skill set";
  const range = entry.weapon.system?.range?.normal ?? {};
  if (isFirearm(entry.weapon) && range.value) return `${skill} · ${range.value} yd`;
  return range.damage ? `${skill} · ${range.damage}` : skill;
}

// In combat, by reload kind: the Reload button's words and what it costs.
const RELOAD_WORDS = Object.freeze({ rounds: ["Reload 2 rounds", "Uses your turn"],
  magazine: ["New magazine", "Uses your turn"], belt: ["New belt", "Takes 2 turns"] });

// CoC7's `multipleShots` holds the most attacks per round when its Multi. Shots is offered.
function shotsPerRound(weapon) {
  const most = Math.trunc(Number(weapon?.system?.usesPerRound?.max));
  if (!isFirearm(weapon) || !(most > 1) || weapon?.system?.multipleShots === false) return 1;
  return most;
}

const shownNumber = (value) => (Number(value) > 0 ? String(value).trim() : null);


function detailLines(entry) {
  const system = entry.weapon.system ?? {};
  const normal = system.range?.normal ?? {};
  const skill = entry.skill ? `Skill ${entry.skill.name} ${levels(entry.skill)}` : "Skill: none set";
  const range = isFirearm(entry.weapon) || system.properties?.thrown ? shownNumber(normal.value) : null;
  const hits = [normal.damage ? `Damage ${normal.damage}` : null, range ? `Range ${range} yd` : null];
  const uses = shownNumber(system.usesPerRound?.normal);
  const most = shownNumber(system.usesPerRound?.max);
  const rounds = [uses ? `Attacks per round ${uses}${most && most !== uses ? ` (max ${most})` : ""}` : null,
    entry.ammo ? `Ammunition ${entry.ammo.loaded}/${entry.ammo.capacity}` : null];
  return [skill, hits.filter(Boolean).join(" · "), rounds.filter(Boolean).join(" · ")].filter(Boolean);
}


function attacksLine(actor) {
  const most = attacksPerRound(actor);
  if (most < 2 || !inCombatFor(actor)) return null;
  const left = Math.max(0, most - attacksMade(actor));
  return element("div", "rollbox-hint rollbox-action-attacks", `Attacks: ${left}/${most}`);
}

/**
 * Spends one of the character's attacks this round; the last spends their action.
 * @param {Actor} actor
 * @returns {Promise<boolean>}
 */
export const spendAttack = (actor) => markAttack(actor, attacksPerRound(actor));

const pickId = (entry) => entry.weapon.id ?? UNARMED;

class AttackTab {
  /**
   * @param {{actor: Actor, target: {token: Token|null, text: string|null}, net?: number, toggles?: string[],
   *   state?: object, redraw?: () => void, close?: () => void, limited?: boolean}} context
   */
  constructor({ actor, target, net = 0, toggles = [], state, redraw, close, limited = false }) {
    this.actor = actor;
    this.target = target ?? { token: null, text: null };
    this.net = net;
    this.toggles = new Set(toggles);
    this.state = state ?? attackState();
    this.redraw = redraw ?? (() => {});
    this.close = close ?? (() => {});
    this.entries = weaponsFor(actor, this.target.token);
    this.skillRows = skills(actor);
    this.limited = limited === true;
    this.state.pick ??= pickedWeapon(actor) ?? null;
    if (this.state.pick !== IMPROVISED && !this.picked()) this.state.pick = null;
  }

  get sending() {
    return this.state.sending === true;
  }

  set sending(value) {
    this.state.sending = value;
  }

  picked() {
    return this.entries.find((entry) => pickId(entry) === this.state.pick) ?? null;
  }

  build() {
    const root = element("div", "rollbox-action-attack");
    const list = element("div", "rollbox-list rollbox-action-weapons");
    list.setAttribute("role", "radiogroup");
    list.setAttribute("aria-label", "Weapon");
    list.append(...this.entries.map((entry) => this.row(entry)), this.improvisedRow());
    root.append(list);
    if (this.state.pick === IMPROVISED) root.append(this.improvisedBlock());
    const fire = this.fireBlock();
    if (fire) root.append(fire);
    const prompt = this.holsterBox() ?? this.promptBox();
    this.prompting = Boolean(prompt);
    if (prompt) root.append(prompt);
    const count = attacksLine(this.actor);
    if (count) root.append(count);
    root.append(this.sendBlock());
    return root;
  }


  row(entry) {
    const picked = this.state.pick === pickId(entry);
    const node = button("rollbox-row rollbox-action-weapon", "", () => this.pick(pickId(entry)));
    node.dataset.pick = pickId(entry);
    node.setAttribute("role", "radio");
    node.setAttribute("aria-checked", String(picked));
    node.disabled = !entry.inReach;
    if (!entry.inReach) node.title = `Out of reach (more than ${reachText(entry.reach)})`;
    const text = element("span", "rollbox-action-weapon-text");
    text.append(element("span", "rollbox-action-weapon-name", entry.weapon.name ?? "?"));
    if (picked && entry.inReach) {
      node.classList.add("rollbox-action-weapon-picked");
      text.append(...detailLines(entry).map((words) => element("span", "rollbox-action-weapon-detail", words)));
      node.append(text);
      return node;
    }
    text.append(element("span", "rollbox-action-weapon-skill", entry.inReach ? detailText(entry) : "Out of reach"));
    node.append(text);
    if (entry.ammo) {
      const ammo = element("span", "rollbox-action-ammo", `${entry.ammo.loaded}/${entry.ammo.capacity}`);
      ammo.classList.toggle("rollbox-action-ammo-empty", entry.ammo.loaded === 0);
      node.append(ammo);
    }
    node.append(levelsNode("rollbox-action-weapon-values", entry.skill));
    return node;
  }

  improvisedRow() {
    const node = button("rollbox-row rollbox-action-weapon", "+ Improvised weapon", () => this.pick(IMPROVISED));
    node.dataset.pick = IMPROVISED;
    node.setAttribute("role", "radio");
    node.setAttribute("aria-checked", String(this.state.pick === IMPROVISED));
    return node;
  }

  // Switching is free, even after acting. Leaving a drawn gun for a weapon with no readied bonus asks first.
  pick(id) {
    if (this.state.pick === id) return this.unpick();
    if (this.switchDrops(id)) {
      this.state.holster = { to: id };
      return this.redraw();
    }
    return this.choose(id);
  }

  switchDrops(id) {
    if (!drawnGun(this.actor)) return false;
    if (id === IMPROVISED) return true;
    const entry = this.entries.find((each) => pickId(each) === id);
    return Boolean(entry) && !readiesAsFirearm(entry.weapon);
  }

  choose(id) {
    this.state.holster = null;
    if (id === IMPROVISED && drawnGun(this.actor)) clearPickedWeapon(this.actor);
    this.state.pick = id;
    this.state.result = null;
    this.state.prompt = null;
    this.state.multi = false;
    this.state.shots = 0;
    const entry = this.picked();
    if (entry) {
      setPickedWeapon(this.actor, id);
      if (hasActed(this.actor)) this.state.result = { lines: [`Switched to ${entry.weapon.name} for next round.`] };
      if (entry.weapon.id !== UNARMED && !inCombat(this.actor)) this.noticeDrawn(entry.weapon);
    }
    this.redraw();
  }

  // Clearing the flag in combat lets combat's readied firearms turn CoC7's Draw gun off.
  unpick() {
    if (drawnGun(this.actor) && this.state.pick !== IMPROVISED) {
      this.state.holster = { to: null };
      return this.redraw();
    }
    return this.putAway();
  }

  async putAway() {
    Object.assign(this.state, { pick: null, holster: null, result: null, prompt: null, multi: false, shots: 0 });
    await clearPickedWeapon(this.actor);
    this.redraw();
  }

  // Putting a drawn gun away drops the character to their DEX in the turn order at once, so it asks first.
  holsterBox() {
    const holster = this.state.holster;
    const gun = holster ? drawnGun(this.actor) : null;
    if (!gun) return null;
    const name = this.actor.name ?? "The character";
    const drop = `puts ${name} back to their DEX in the turn order (${gun.from} → ${gun.to}).`;
    const to = holster.to === null ? null
      : (holster.to === IMPROVISED ? "an improvised weapon"
        : this.entries.find((entry) => pickId(entry) === holster.to)?.weapon.name ?? "that weapon");
    return promptBox({ lines: [to ? `Switching to ${to} ${drop} Switch?` : `Holstering ${drop} Holster?`],
      confirm: to ? "Switch" : "Holster",
      onConfirm: () => (holster.to === null ? this.putAway() : this.choose(holster.to)),
      onCancel: () => {
        this.state.holster = null;
        this.redraw();
      } });
  }

  async noticeDrawn(weapon) {
    if (!(await postNoticeCard({ actor: this.actor, weapon })) || !isKeeper()) return;
    this.state.result = { lines: [...(this.state.result?.lines ?? []),
      "Drawn out of combat: the weapon-drawn notice is above your hotbar."] };
    this.redraw();
  }


  improvisedBlock() {
    const block = element("div", "rollbox-action-improvised");
    const what = textInput("rollbox-action-what", "What is it? e.g. Candlestick", "What the improvised weapon is");
    what.value = this.state.what;
    what.addEventListener("input", () => { this.state.what = what.value; this.update(); });
    const skill = segmented({ choices: IMPROVISED_SKILLS.map((s) => [s.id, s.label]), get: () => this.state.skill,
      set: (value) => { this.state.skill = value; this.redraw(); } });
    skill.sync();
    block.append(what, line("Skill", skill.element));
    if (this.state.skill === "other") {
      block.append(otherSkillList(this.skillRows, { className: "rollbox-action-other", value: this.state.other,
        onChange: (value) => { this.state.other = value; this.update(); } }));
    }
    const damage = textInput("rollbox-action-damage", "Damage (optional), e.g. 1D6+DB", "Damage");
    damage.value = this.state.damage;
    damage.addEventListener("input", () => { this.state.damage = damage.value; this.update(); });
    block.append(damage);
    return block;
  }

  improvisedSkill() {
    const row = improvisedSkill(this.state.skill, this.state.other, this.skillRows);
    return row ? { name: row.name, cocid: row.cocid ?? null } : null;
  }


  // Shots beyond the rounds loaded are greyed: CoC7 stops adding shots when the gun runs dry.
  fireBlock() {
    const entry = this.picked();
    const most = entry?.inReach ? shotsPerRound(entry.weapon) : 1;
    if (most < 2) return null;
    const block = element("div", "rollbox-action-fire");
    const mode = segmented({ choices: [["single", "Single shot"], ["multi", "Multi-shot"]], label: "Fire",
      get: () => (this.state.multi ? "multi" : "single"),
      set: (value) => this.setMulti(value === "multi", entry, most) });
    mode.sync();
    block.append(line("Fire", mode.element));
    if (this.state.multi) {
      const loaded = entry.ammo?.loaded ?? most;
      const shots = segmented({ choices: Array.from({ length: most }, (_, i) => [String(i + 1), String(i + 1)]),
        label: "Shots", get: () => String(this.state.shots),
        set: (value) => { this.state.shots = Number(value); this.redraw(); } });
      for (const node of shots.buttons) node.disabled = Number(node.dataset.value) > Math.max(1, loaded);
      shots.sync();
      shots.element.classList.add("rollbox-action-shots");
      block.append(line("Shots", shots.element));
    }
    return block;
  }

  setMulti(on, entry, most) {
    this.state.multi = on;
    this.state.shots = on ? Math.max(1, Math.min(most, entry.ammo?.loaded ?? most)) : 0;
    this.redraw();
  }

  // Returns 0 for a single shot.
  shotsToFire(entry) {
    if (!this.state.multi || shotsPerRound(entry.weapon) < 2) return 0;
    return this.state.shots > 1 ? this.state.shots : 0;
  }


  sendBlock() {
    const entry = this.picked();
    const attack = button("rollbox-btn rollbox-primary rollbox-action-go", "Attack", () => this.attack());
    const buttons = [attack];
    // Aim is for next round's shot, so only in combat.
    if (entry && isFirearm(entry.weapon) && inCombatFor(this.actor)) {
      buttons.push(button("rollbox-btn rollbox-action-aim", "Aim", () => this.aim()));
    }
    const notFull = entry?.ammo && entry.inReach !== false && entry.ammo.loaded < entry.ammo.capacity;
    const combat = inCombatFor(this.actor);
    this.reloadButtons = [];
    // Out of combat: one full reload, beside Attack.
    if (notFull && !combat) {
      const reload = button("rollbox-btn rollbox-action-reload", "Reload", () => this.reload(entry));
      reload.dataset.keep = "";
      this.reloadButtons.push(reload);
      buttons.push(reload);
    }
    const cancel = button("rollbox-btn rollbox-action-cancel", "Cancel", () => this.close());
    cancel.dataset.keep = "";
    buttons.push(cancel);
    this.sender = sendSection(buttons);
    this.attackButton = attack;
    if (notFull && combat) {
      this.sender.element.insertBefore(this.reloadLine(entry), this.sender.result);
    }
    this.showStored();
    this.update();
    return this.sender.element;
  }


  reloadLine(entry) {
    const kind = reloadSource(entry.weapon).kind;
    let [words, cost] = RELOAD_WORDS[kind] ?? RELOAD_WORDS.magazine;
    if (kind === "rounds" && entry.ammo.capacity - entry.ammo.loaded === 1) words = "Reload 1 round";
    const reload = button("rollbox-btn rollbox-action-reload", "", () => this.reload(entry));
    reload.append(element("span", "", words), element("span", "rollbox-action-sub", cost));
    const loadOne = button("rollbox-btn rollbox-action-load-one", "", () => this.attack({ loadOne: true }));
    loadOne.append(element("span", "", "Load one and fire"), element("span", "rollbox-action-sub", "1 penalty die"));
    this.reloadButtons.push(reload);
    this.loadOneButton = loadOne;
    const row = element("div", "rollbox-actions rollbox-action-reload-line");
    row.append(reload, loadOne);
    return row;
  }

  showStored() {
    const stored = this.state.result;
    if (stored?.send) showResult(this.sender.result, stored.send, stored.words);
    else if (stored?.lines) this.sender.result.replaceChildren(...stored.lines.map((text) => element("div", "rollbox-result-line", text)));
  }


  update() {
    if (!this.sender) return;
    const missing = this.missing();
    const busy = this.sending || this.limited || this.prompting === true;
    this.sender.ready(missing, busy);
    // Reloading needs nothing picked; Load one and fire is an attack, so it waits for the rest, not for rounds.
    for (const node of this.reloadButtons ?? []) node.disabled = busy;
    if (this.loadOneButton) this.loadOneButton.disabled = busy || Boolean(missing && missing !== MISSING.empty);
  }

  missing() {
    if (this.state.pick === IMPROVISED) {
      if (!this.state.what.trim()) return MISSING.what;
      if (!this.improvisedSkill()) return MISSING.skill;
      if (this.state.damage.trim() && !damageText(this.state.damage)) return MISSING.damage;
      return null;
    }
    const entry = this.picked();
    if (!entry) return MISSING.pick;
    if (!entry.inReach) return MISSING.reach;
    if (entry.ammo?.loaded === 0) return inCombatFor(this.actor) ? MISSING.empty : MISSING.emptyOut;
    const lacking = this.lacking(entry);
    if (lacking === "unarmed" && !isKeeper()) return askKeeperText(missingAttacks(this.actor).punch ?? "unarmed attack");
    if (lacking === "skill" && !isKeeper()) return MISSING.askSkill(entry.weapon.name);
    if (lacking === "noSkill") return MISSING.noSkill(entry.weapon.name);
    if (isMelee(entry.weapon) && !this.target.token && !this.target.text) return MISSING.target;
    return null;
  }

  // "skill": an unarmed weapon the Keeper can link to the fighting skill; "noSkill": any other weapon CoC7 can't roll.
  lacking(entry) {
    if (entry.weapon.id === UNARMED) return "unarmed";
    if (!skillUnset(entry.weapon)) return null;
    const fixable = (entry.unarmed || isManeuverWeapon(entry.weapon)) && fightingSkill(this.actor);
    return fixable ? "skill" : "noSkill";
  }



  promptBox() {
    const entry = this.picked();
    const kind = this.state.prompt;
    if (!kind || !entry || !isKeeper() || this.lacking(entry) !== kind) return null;
    const name = this.actor.name ?? "The character";
    if (kind === "unarmed") {
      const { punch, skill } = missingAttacks(this.actor);
      const choose = skill ? null : fightingSkills(this.actor).map((s) => ({ id: s.id, name: s.name }));
      return promptBox({ lines: [`${name} has no unarmed attack.`, addLine([punch ?? "Punch"], this.actor)],
        confirm: "Add", skills: choose,
        onConfirm: (skillId) => this.addUnarmed(skillId),
        onCancel: () => this.cancelPrompt() });
    }
    const skill = fightingSkill(this.actor);
    return promptBox({ lines: [`${entry.weapon.name} has no skill on ${name}'s sheet, so CoC7's card can't roll.`,
      `Link it to ${skill?.name ?? "Fighting (Brawl)"}?`], confirm: "Fix",
    onConfirm: () => this.fixSkill(entry.weapon, skill), onCancel: () => this.cancelPrompt() });
  }

  cancelPrompt() {
    this.state.prompt = null;
    this.redraw();
  }

  async addUnarmed(skillId) {
    const skill = skillId ? Array.from(this.actor.items ?? []).find((item) => item.id === skillId) : null;
    this.state.prompt = null;
    const [added] = await addAttacks(this.actor, { punch: true, skill });
    const weapon = added ?? unarmedOnSheet(this.actor);
    if (!weapon) return this.done({ lines: ["The unarmed weapon couldn't be added; see the console (F12)."] });
    this.state.pick = weapon.id;
    this.entries = weaponsFor(this.actor, this.target.token);
    return this.attack();
  }

  async fixSkill(weapon, skill) {
    this.state.prompt = null;
    if (!(await setWeaponSkill(weapon, skill))) {
      return this.done({ lines: [`${weapon.name}'s skill couldn't be set; see the console (F12).`] });
    }
    return this.attack();
  }


  done(result) {
    this.state.result = result;
    this.redraw();
  }

  // The target is made the user's Foundry target first, since CoC7's card reads it.
  attack({ loadOne = false } = {}) {
    if (this.limited) return undefined;
    if (this.state.pick === IMPROVISED) return this.sendImprovised();
    const entry = this.picked();
    if (!entry || !entry.inReach) return undefined;
    const lacking = this.lacking(entry);
    if (lacking) {
      if (lacking === "noSkill" || !isKeeper()) return undefined;
      this.state.prompt = lacking;
      this.redraw();
      return undefined;
    }
    if (isMelee(entry.weapon) && !this.target.token && !this.target.text) return undefined;
    const shots = loadOne ? 0 : this.shotsToFire(entry);
    return runSend(this, async () => {
      const ranged = entry.weapon.system?.properties?.rngd === true;
      const decision = await this.askFirst(ranged ? "ranged" : "melee");
      if (decision?.how === "unanswered") return { lines: [`Nothing was sent: ${decision.reason}.`] };
      const bonus = decision?.how === "surprised" ? decision.bonus : null;
      if (loadOne) {
        if (!(await loadOneRound(entry.weapon))) return { lines: ["CoC7 couldn't load a round; nothing was sent."] };
        await postReloadCard(this.actor, entry.weapon);
      }
      if (this.target.token) targetToken(this.target.token);
      const aimed = isFirearm(entry.weapon) && isAiming(this.actor);
      const gun = isFirearm(entry.weapon);
      const on = (name) => this.toggles.has(name);
      const ticks = { aiming: aimed, reloading: loadOne, cover: gun && on("cover"), pointBlank: gun && on("pointBlank"),
        noPointBlank: gun && on("noPointBlank"), inMelee: gun && on("inMelee"), outnumbered: !gun && on("outnumbered"),
        autoSuccess: !ranged && bonus === "auto", dice: this.net + (bonus === "die" ? 1 : 0), shots };
      const started = await startAttack({ actor: this.actor, weapon: entry.weapon, ticks });
      if (!started.started) return { lines: [`No attack card: ${started.reason}.`] };
      await setPickedWeapon(this.actor, pickId(entry));
      await spendAttack(this.actor);
      if (aimed) await clearAiming(this.actor); // the aimed shot is made: Aiming ends with it
      const lines = [shots ? `CoC7's attack card made for ${entry.weapon.name}: Rollbox fires ${shots} shots on it.`
        : `CoC7's attack card made for ${entry.weapon.name}: ${started.rolled ? "rolled at once" : "press Roll on it"}.`];
      lines.push(...surpriseLines(decision, this.target.token?.name));
      // Out of combat the attack is the first blow; in one, it makes both fighters. An ignored attack starts nothing.
      const fight = decision?.how === "ignore" ? false
        : await attackMade({ actor: this.actor, targets: [this.target.token?.actor].filter(Boolean) });
      if (fight === "firstBlow") {
        lines.push(isKeeper() ? "First blow: finish the attack, then press Start combat on your card."
          : "First blow: the Keeper starts combat once the attack is done.");
      }
      if (this.target.text) lines.push(`Target: ${this.target.text} (an object: the card has no token).`);
      return { lines };
    }, (result) => this.done(result ?? { lines: ["Something went wrong; see the console (F12)."] }));
  }

  sendImprovised() {
    if (this.limited) return undefined;
    const skill = this.improvisedSkill();
    const base = { what: this.state.what, skill, damage: this.state.damage.trim() };
    if (!improvisedRequest(base)) return undefined;
    const words = { what: "Improvised attack" };
    return runSend(this, async () => {
      const decision = await this.askFirst("improvised");
      if (decision?.how === "unanswered") return { lines: [`Nothing was sent: ${decision.reason}.`] };
      const bonusDie = decision?.how === "surprised" && decision.bonus === "die";
      const request = improvisedRequest({ ...base, dice: bonusDie ? 1 : 0 });
      const result = await send(request, [this.actor]);
      if (result.requested.length || result.rolled.length) {
        await spendAttack(this.actor);
        if (decision?.how !== "ignore") {
          await attackMade({ actor: this.actor, targets: [this.target.token?.actor].filter(Boolean) });
        }
      }
      return result;
    }, (result) => this.done(result?.lines ? result : (result ? { send: result, words } : null)));
  }

  /** Asks the Keeper's About to attack first, out of combat with a target token; null when nothing is asked. */
  async askFirst(kind) {
    const target = this.target.token?.actor ?? null;
    if (!target || !asksFirst(this.actor, target)) return null;
    this.state.result = { lines: [isKeeper() ? "About to attack: answer the pop-up above the hotbar."
      : "Waiting for the Keeper…"] };
    if (this.sender) this.showStored();
    return aboutToAttack({ actor: this.actor, target, kind });
  }

  // In combat, rounds go in two at a time through CoC7's `addAmmunition()`, as two clicks on its sheet's ammo.
  reload(entry) {
    if (this.limited) return undefined;
    const name = entry.weapon.name;
    return runSend(this, async () => {
      if (!inCombatFor(this.actor)) {
        if (!(await reloadWeapon(entry.weapon))) return { lines: ["CoC7 couldn't reload it."] };
        await postReloadCard(this.actor, entry.weapon);
        return { lines: [`Reloaded the ${name}.`] };
      }
      const { kind, source } = reloadSource(entry.weapon);
      // Only a sure reload kind is saved on the weapon; a guess is left for the setup check to ask.
      if (source === "cocid" || source === "rule") await saveReloadKind(entry.weapon, kind);
      let line;
      if (kind === "rounds") {
        const before = entry.ammo?.loaded ?? 0;
        if (!(await loadOneRound(entry.weapon))) return { lines: ["CoC7 couldn't load a round."] };
        const two = before + 1 < (entry.ammo?.capacity ?? Infinity) ? await loadOneRound(entry.weapon) : false;
        line = `Loaded ${two ? "two rounds" : "one round"} into the ${name}; that uses the turn.`;
      } else {
        if (!(await reloadWeapon(entry.weapon))) return { lines: ["CoC7 couldn't reload it."] };
        line = kind === "belt" ? `New belt in the ${name}: that takes this turn and the next.`
          : `New magazine in the ${name}; that uses the turn.`;
      }
      await postReloadCard(this.actor, entry.weapon);
      await markActed(this.actor);
      return { lines: [line] };
    }, (result) => this.done(result));
  }

  // Aim uses the turn; the next round's shot gets CoC7's Aiming tick.
  aim() {
    if (this.limited) return undefined;
    return runSend(this, async () => {
      const noted = await markAiming(this.actor);
      await markActed(this.actor);
      return { lines: [noted ? `${this.actor.name} aims: next round's shot gets Aiming on CoC7's card.`
        : `${this.actor.name} aims: tick Aiming on CoC7's card next round.`] };
    }, (result) => this.done(result));
  }
}

/**
 * Returns the Attack tab for one character; `limited` sends nothing.
 * @param {{actor: Actor, target: {token: Token|null, text: string|null}, net?: number, toggles?: string[],
 *   state?: object, redraw?: () => void, close?: () => void, limited?: boolean}} context
 * @returns {HTMLElement|null} null without a character
 */
export function attackTab({ actor, target, ...context } = {}) {
  if (!actor) return null;
  return new AttackTab({ actor, target, ...context }).build();
}


/**
 * Returns what the flyout says of the Keeper's About to attack decision.
 * @param {{how: string, bonus?: string|null}|null} decision
 * @param {string} [name] the target's name
 * @returns {string[]}
 */
function surpriseLines(decision, name = "The target") {
  if (decision?.how === "surprised") {
    return [`${name} is surprised: ${decision.bonus === "auto" ? "automatic hit" : "one bonus die"}, no response.`];
  }
  if (decision?.how === "ignore") return ["Ignored: this attack starts no combat."];
  return [];
}
