/** The reload card whispered after a reload through Rollbox. See docs/action-flyout.md. */
import { escapeHtml, numberOrNull, warn } from "../../utils.js";
import { ownersOf } from "../../roll-requests/index.js";

// CoC7 keeps Sex as free text.
function pronoun(actor) {
  const sex = String(actor?.system?.infos?.sex ?? "").trim().toLowerCase();
  if (/^(m|male|man|he)\b/.test(sex)) return "his";
  if (/^(f|female|woman|she)\b/.test(sex)) return "her";
  return "their";
}

function reloadText(actor, weapon) {
  const loaded = Math.max(0, numberOrNull(weapon?.system?.ammo) ?? 0);
  const capacity = numberOrNull(weapon?.system?.bullets);
  const count = capacity ? ` (${loaded}/${capacity})` : "";
  return `${actor?.name ?? "Someone"} reloads ${pronoun(actor)} ${weapon?.name ?? "weapon"}${count}.`;
}

/**
 * Posts the reload card, whispered to the Keepers and the character's players.
 * @param {Actor} actor
 * @param {Item} weapon
 * @returns {Promise<ChatMessage|null>}
 */
export async function postReloadCard(actor, weapon) {
  if (!actor || !weapon || typeof globalThis.ChatMessage?.create !== "function") return null;
  const keepers = globalThis.ChatMessage.getWhisperRecipients?.("GM") ?? [];
  const whisper = [...new Set([...keepers, ...(ownersOf(actor) ?? [])].map((user) => user?.id).filter(Boolean))];
  // An empty whisper list would post publicly.
  if (!whisper.length) return null;
  try {
    const speaker = globalThis.ChatMessage.getSpeaker?.({ actor }) ?? { alias: actor.name };
    return await ChatMessage.create({ speaker, whisper,
      content: `<div class="rollbox-reload-card"><p>${escapeHtml(reloadText(actor, weapon))}</p></div>` }) ?? null;
  } catch (error) {
    warn("couldn't post the reload card.", error);
    return null;
  }
}
