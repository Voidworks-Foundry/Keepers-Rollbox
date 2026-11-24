/** The Keeper's flee notice and its way into CoC7's chase tool. See docs/combat.md. */
import { isKeeper, warn } from "../utils.js";
import { showFightNotice } from "./fight-boxes.js";

/** Creates and opens a CoC7 Chase item, as Items › Create Item › Chase does; null when CoC7 has none. */
async function openChase(name) {
  const types = globalThis.game?.documentTypes?.Item ?? Object.keys(globalThis.CONFIG?.Item?.dataModels ?? {});
  if (!Array.from(types ?? []).includes("chase")) return null;
  try {
    const ItemClass = globalThis.getDocumentClass?.("Item") ?? globalThis.Item;
    const item = await ItemClass.create({ name: `${name} flees`, type: "chase" });
    item?.sheet?.render?.(true);
    return item ?? null;
  } catch (error) {
    warn("couldn't open CoC7's chase tool.", error);
    return null;
  }
}

/**
 * Shows the Keeper the flee notice, which can open a chase.
 * @param {string} name
 * @param {{combatant?: Combatant}} [options] a player's fled combatant, still in the encounter
 * @returns {HTMLElement|null} null on a player's client
 */
export function fleeNotice(name, { combatant = null } = {}) {
  if (!isKeeper()) return null;
  const letGo = async () => {
    try {
      if (combatant && combatant.parent?.combatants?.get?.(combatant.id)) await combatant.delete();
    } catch (error) {
      warn("couldn't take the fled combatant out of the encounter.", error);
    }
  };
  const chase = async () => {
    await letGo();
    if (await openChase(name)) return;
    showFightNotice({ lead: "Chase:", kind: "chase",
      text: " set it up in CoC7's chase tool (Items › Create Item › Chase). Speed rolls: CON for everyone in it.",
      buttons: [["OK", () => {}, true]] });
  };
  return showFightNotice({ lead: `${name} flees.`, text: " Does anyone give chase?", kind: "flee",
    buttons: [["Let them go", letGo], ["Chase", chase, true]] });
}
