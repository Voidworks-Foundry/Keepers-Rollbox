/**
 * Minimal Foundry mocks shared by the test files. Not a test itself.
 *
 * Node runs each test file in its own process, but the tests inside a file share one module graph.
 * load() imports main.js with a ?v= query, which re-runs main.js alone: the files it imports stay
 * cached, so their module-level state survives from test to test. Call makeEnv() first in every test:
 * it replaces every Foundry global, so each test starts from fresh mocks.
 */
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const MOD = new URL("../scripts/", import.meta.url).href;

/**
 * A fresh page for the DOM tests: a jsdom document as the global `document` (and `HTMLElement`).
 * @param {string} [html] the page's body
 * @returns {Window} the page's window, for its Event classes and getComputedStyle.
 */
export function makeDom(html = "<div></div>") {
  const { window } = new JSDOM(html);
  globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  return window;
}

/** Load the module's own stylesheets into the page (paths under scripts/), for tests of a CSS rule. */
export function addStyles(...files) {
  for (const file of files) {
    const style = document.createElement("style");
    style.textContent = readFileSync(new URL(file, MOD), "utf8");
    document.head.append(style);
  }
}

/** A menu's result area as the Keeper reads it: each heading and each line, in order. */
export function resultText(area) {
  return [...area.querySelectorAll(".rollbox-result-heading, .rollbox-result-line")].map((node) => node.textContent);
}

export function makeEnv({ isGM = true, values = {}, coc7 = {} } = {}) {
  const hooks = {}; const registered = {}; const chat = []; const reads = [];
  globalThis.Hooks = {
    // Foundry returns an id for Hooks.off; here the function itself serves as the id.
    on: (n, f) => { (hooks[n] ??= []).push(f); return f; },
    once: (n, f) => { (hooks[n] ??= []).push(f); return f; },
    off: (n, f) => { hooks[n] = (hooks[n] ?? []).filter((g) => g !== f); },
    call: (n, ...a) => (hooks[n] ?? []).forEach((f) => f(...a))
  };
  const users = [
    { id: "gm1", isGM: true, isSelf: isGM },
    { id: "p1", isGM: false, isSelf: !isGM },
    { id: "p2", isGM: false, isSelf: false }
  ];
  users.filter = Array.prototype.filter.bind(users);
  globalThis.game = {
    user: users.find((u) => u.isSelf),
    users,
    settings: {
      register: (ns, k, c) => { registered[k] = c; },
      get: (ns, k) => {
        // CoC7's own settings (e.g. worldEra); like Foundry, an unregistered one throws.
        if (ns === "CoC7") {
          if (k in coc7) return coc7[k];
          throw new Error(`${ns}.${k} is not a registered game setting`);
        }
        reads.push(k); return k in values ? values[k] : registered[k].default;
      }
    }
  };
  globalThis.CONFIG = {};
  globalThis.ChatMessage = { create: (d) => chat.push(d) };
  globalThis.console.warn = () => {};
  return { hooks, registered, chat, reads, values };
}

/**
 * A CoC7 actor shaped like 8.15's data (see the build guide's "Actor and item data").
 * skills: [{ name, value, base?, cocid?, own? }] become skill items; `base` is system.adjustments.base.
 * Pass `system` to replace the whole system object (for actors with missing fields).
 */
export function makeActor({ name = "Actor", type = "character", characteristics = {}, luck, san, sanMax,
  idea, know, skills = [], otherItems = [], system } = {}) {
  const chars = Object.fromEntries(Object.entries(characteristics).map(([k, v]) => [k, { value: v }]));
  const items = skills.map(({ name: skillName, value, base, cocid, own }) => ({
    type: "skill",
    name: skillName,
    flags: cocid ? { CoC7: { cocidFlag: { id: cocid } } } : {},
    system: { value, adjustments: { base: base ?? value }, properties: own ? { own: true } : {} }
  }));
  return {
    name, type,
    items: [...items, ...otherItems],
    system: system ?? {
      characteristics: chars,
      attribs: { lck: { value: luck }, san: { value: san, max: sanMax } },
      config: { idea: { value: idea ?? chars.int?.value }, know: { value: know ?? chars.edu?.value } }
    }
  };
}

/**
 * CoC7's side of a roll request, on top of makeEnv(): the system id, its link class, its CoC ID lookup,
 * Foundry's i18n, clipboard, notifications and whisper recipients, and world items and compendiums.
 * Records everything Rollbox asks of them in the returned `calls`.
 * @param {object} [options]
 * @param {boolean} [options.links] CONFIG.CoC7Link registered (false: CoC7 missing).
 * @param {boolean} [options.linkActorClick] CoC7Link._onLinkActorClick present.
 * @param {(cocid: string) => number} [options.cocidMatches] how many items fromCoCIDBest finds; null: no lookup.
 * @param {object[]} [options.worldItems] game.items; [options.packIndex] one Item compendium's index.
 * The world's era is "standard" (CoC7's `worldEra`).
 */
export function makeCoC7({ links = true, linkActorClick = true, cocidMatches = () => 1, worldItems = [],
  packIndex = [] } = {}) {
  const calls = { linkActorClick: [], cocid: [], copied: [], warnings: [], notices: [] };
  game.system = { id: "CoC7" };
  game.i18n = {
    has: (key) => key === "CoC7.MessageTargetCheckRequested",
    format: (key, data) => `Your keeper has requested ${data.name} make a ${data.check} roll.`
  };
  game.clipboard = { copyPlainText: async (text) => { calls.copied.push(text); } };
  game.items = worldItems;
  game.packs = [{ documentName: "Item", indexed: false, index: null, getIndex: async () => packIndex }];
  const getSetting = game.settings.get;
  game.settings.get = (ns, k) => (ns === "CoC7" && k === "worldEra" ? "standard" : getSetting(ns, k));
  game.CoC7 = cocidMatches === null ? {} : {
    cocid: { fromCoCIDBest: async ({ cocid }) => { calls.cocid.push(cocid); return Array(cocidMatches(cocid)).fill({}); } }
  };
  globalThis.ui = { notifications: { warn: (t) => calls.notices.push(t), info: () => {} } };
  globalThis.console.warn = (t) => calls.warnings.push(t);
  ChatMessage.getWhisperRecipients = (name) => (name === "GM" ? game.users.filter((u) => u.isGM) : []);
  if (links) {
    class CoC7Link {}
    if (linkActorClick) CoC7Link._onLinkActorClick = async (actor, options) => { calls.linkActorClick.push({ actor, options }); };
    CONFIG.CoC7Link = { documentClass: CoC7Link };
  }
  return calls;
}

/**
 * A CoC7 actor (makeActor) that can be rolled: uuid, player owners, CoC7's check methods (recorded in
 * `actor.calls`), item ids and uuids, weapons and a damage bonus.
 * weapons: [{ id, name, main, alt, usesAlternativeSkill }] where main/alt are skill names (or { id, name }).
 */
export function makeRollActor({ uuid, owners = [], weapons = [], db, methods = true, ...options } = {}) {
  const actor = makeActor(options);
  actor.uuid = uuid ?? `Actor.${actor.name.replace(/\s+/g, "")}`;
  actor.owners = owners;
  actor.calls = [];
  actor.items.forEach((item, i) => { item.id ??= `item${i}`; item.uuid = `${actor.uuid}.Item.${item.id}`; });
  const ref = (skill) => (typeof skill === "string" ? { id: "", name: skill } : (skill ?? { id: "", name: "" }));
  for (const w of weapons) {
    actor.items.push({ type: "weapon", id: w.id, name: w.name, uuid: `${actor.uuid}.Item.${w.id}`, flags: {},
      system: { skill: { main: ref(w.main), alternativ: ref(w.alt) }, usesAlternativeSkill: w.usesAlternativeSkill === true } });
  }
  if (actor.system.attribs) actor.system.attribs.db = { value: db };
  if (methods) {
    for (const m of ["skillCheck", "characteristicCheck", "attributeCheck", "runRoll"]) {
      actor[m] = async (...args) => { actor.calls.push([m, ...args]); };
    }
  }
  return actor;
}

let n = 0;
export async function load(env) {
  await import(MOD + "main.js?v=" + (n++)); // fresh main.js only
  env.hooks.init?.forEach((f) => f());
  env.hooks.setup?.forEach((f) => f());
  env.hooks.ready?.forEach((f) => f());
}
