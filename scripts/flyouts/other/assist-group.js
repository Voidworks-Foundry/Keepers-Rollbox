/**
 * Players' assist groups: the flag on the helped character, the Keeper's relay handlers and the rollers' cards.
 * See docs/assist.md.
 */
import { MODULE_ID, actorFromUuid, dotted, isActiveKeeper, isKeeper, warn } from "../../utils.js";
import {
  askKeeper, checkCardActor, checkResult, isCheckOf, onKeeperRequest, ownersOf, registerHelperCheck
} from "../../roll-requests/index.js";
import { ownCharacter, panelOnFor, playerFeatureOn } from "../../player/index.js";

// Permanent once released: renaming it loses every saved group.
const GROUP_FLAG = "assistGroup";

/**
 * Returns whether an updateActor's changes set or removed the assist group flag.
 * @param {object} changes Foundry's update data
 * @returns {boolean}
 */
export function groupChanged(changes) {
  const flags = changes?.flags?.[MODULE_ID];
  // Foundry v14: a removed flag stays as its key with a ForcedDeletion value, so the key is tested, not the value.
  return Boolean(flags) && typeof flags === "object" && GROUP_FLAG in flags;
}

/**
 * Returns the group on a helped character, or null without one or when the flag is malformed.
 * @param {Actor} actor
 * @returns {{helpers: string[], sent: object|null}|null}
 */
export function groupOf(actor) {
  try {
    const flag = actor?.getFlag?.(MODULE_ID, GROUP_FLAG);
    if (!flag || typeof flag !== "object") return null;
    const helpers = Array.isArray(flag.helpers) ? flag.helpers.filter((uuid) => typeof uuid === "string") : [];
    const sent = flag.sent && typeof flag.sent === "object" ? flag.sent : null;
    return helpers.length || sent ? { helpers, sent } : null;
  } catch {
    return null;
  }
}

// An unlinked token's character keeps its flag on the token, so scenes' unlinked tokens are searched too.
function holders() {
  const actors = Array.from(globalThis.game?.actors ?? []);
  try {
    for (const scene of Array.from(globalThis.game?.scenes ?? [])) {
      for (const token of Array.from(scene?.tokens ?? [])) {
        if (token?.actorLink === false && token.actor) actors.push(token.actor);
      }
    }
  } catch (error) {
    warn("couldn't read the scenes' tokens for assist groups.", error);
  }
  return actors;
}

function allGroups() {
  const found = [];
  for (const actor of holders()) {
    const group = groupOf(actor);
    if (group) found.push({ actor, group });
  }
  return found;
}

/**
 * Returns the group this character helps in, is helped by (`helped` is themselves), or is named in once sent.
 * @param {Actor} actor
 * @returns {{helped: Actor, group: object}|null}
 */
export function standing(actor) {
  const key = dotted(actor?.uuid);
  if (!key) return null;
  for (const { actor: helped, group } of allGroups()) {
    if (dotted(helped.uuid) === key) return { helped, group };
    const named = group.sent ? [...group.sent.helpers, ...group.sent.rollers].map((entry) => dotted(entry.uuid))
      : group.helpers.map(dotted);
    if (named.includes(key)) return { helped, group };
  }
  return null;
}

/**
 * Returns the helpers waiting in a character's unsent group, as actors.
 * @param {Actor} actor
 * @returns {Actor[]}
 */
export function waitingHelpers(actor) {
  const group = groupOf(actor);
  if (!group || group.sent) return [];
  return group.helpers.map((uuid) => actorFromUuid(uuid)).filter(Boolean);
}

async function writeGroup(actor, group) {
  try {
    if (group) await actor.setFlag(MODULE_ID, GROUP_FLAG, group);
    else await actor.unsetFlag(MODULE_ID, GROUP_FLAG);
    return true;
  } catch (error) {
    warn(`couldn't update ${actor?.name ?? "the character"}'s assist group.`, error);
    return false;
  }
}

// A helper is in one waiting group at a time.
async function leaveAll(helperUuid, except = null) {
  for (const { actor, group } of allGroups()) {
    if (actor === except || group.sent) continue;
    const helpers = group.helpers.filter((uuid) => dotted(uuid) !== dotted(helperUuid));
    if (helpers.length !== group.helpers.length) await writeGroup(actor, helpers.length ? { helpers, sent: null } : null);
  }
}

const assistAllowed = () => playerFeatureOn("assist");

/**
 * Puts the player's own investigator in the helped character's group, leaving any other; Keeper's relay handler.
 * Security check: refused unless the helper is the player's own investigator and the helped one another character.
 * @param {{helpedUuid: string, helperUuid: string}} payload
 * @param {User} user the player who asked
 * @returns {Promise<boolean>}
 */
export async function joinForPlayer({ helpedUuid, helperUuid } = {}, user) {
  const own = ownCharacter(user);
  const helped = actorFromUuid(helpedUuid);
  if (!assistAllowed() || !own || dotted(own.uuid) !== dotted(helperUuid) || !canBeHelped(helped, own)) {
    warn(`refused ${user?.name ?? "a player"}'s assist: only their own investigator can help another character.`);
    return false;
  }
  await leaveAll(own.uuid, helped);
  const group = groupOf(helped);
  const helpers = group && !group.sent ? group.helpers : [];
  if (helpers.some((uuid) => dotted(uuid) === dotted(own.uuid))) return true;
  return writeGroup(helped, { helpers: [...helpers, own.uuid], sent: null });
}

/**
 * Takes the player's own investigator out of the group it waits in; Keeper's relay handler.
 * @param {object} _payload
 * @param {User} user
 * @returns {Promise<boolean>}
 */
export async function leaveForPlayer(_payload, user) {
  const own = ownCharacter(user);
  if (!assistAllowed() || !own) return false;
  await leaveAll(own.uuid);
  return true;
}

const groupHelpers = (group) => (group.sent ? group.sent.helpers.map((entry) => entry?.uuid) : group.helpers).map(dotted);

/**
 * Tells whether a player's relayed helpers are real: each roller's group holds every helper and the player's own one.
 * Security check, so a hand-typed helper list naming anyone else is refused.
 * @param {Actor[]} rollers
 * @param {Actor[]} helpers
 * @param {User} user the player who asked
 * @returns {boolean}
 */
export function helpersInGroup(rollers, helpers, user) {
  const own = dotted(ownCharacter(user)?.uuid);
  if (!own || !rollers.length || !helpers.length) return false;
  return rollers.every((roller) => {
    const found = standing(roller);
    if (!found) return false;
    const named = groupHelpers(found.group);
    return named.includes(own) && helpers.every((helper) => named.includes(dotted(helper?.uuid)));
  });
}

/**
 * Records on the group what the Keeper sent, until every roller has rolled.
 * @param {Actor} helped
 * @param {{use: string, difficulty: string, label: string, helpers: {actor: Actor, value: number}[],
 *   rollers: {actor: Actor, value: number}[]}} sent
 * @returns {Promise<boolean>}
 */
export async function markSent(helped, { use, difficulty, label, helpers, rollers }) {
  const entry = ({ actor, value }) => ({ uuid: actor.uuid, name: actor.name ?? "", value });
  return writeGroup(helped, { helpers: groupOf(helped)?.helpers ?? [], sent: { use, difficulty, label: label ?? "",
    helpers: helpers.map(entry), rollers: rollers.map(entry), rolled: [], at: Date.now() } });
}

/**
 * Clears the character's group, waiting or sent; does nothing on a player's client.
 * @param {Actor} helped
 * @returns {Promise<boolean>} true when there was a group and it was cleared
 */
export async function clearGroup(helped) {
  if (!isKeeper() || !groupOf(helped)) return false;
  return writeGroup(helped, null);
}

/**
 * Tells whether a roller rolls from their panel's Roll button instead of a chat request: a player owner's panel is on.
 * @param {Actor} actor
 * @returns {boolean}
 */
export function rollsOnPanel(actor) {
  return assistAllowed() && (ownersOf(actor) ?? []).some(panelOnFor);
}

const waitsFor = (sent, roller) => Boolean(sent) && sent.rollers.some((r) => dotted(r.uuid) === roller)
  && !sent.rolled.includes(roller);

/**
 * Counts a roller's rolled check of the group's characteristic and clears the group once all have rolled.
 * Active Keeper only; another check, or a standby card not yet rolled, doesn't count.
 * @param {ChatMessage} message
 * @returns {Promise<void>}
 */
export async function onRollerCard(message) {
  if (!isActiveKeeper()) return;
  const roller = checkCardActor(message);
  if (!roller || !allGroups().some(({ group }) => waitsFor(group.sent, roller))) return;
  const result = await checkResult(message);
  if (!result) return;
  for (const { actor, group } of allGroups()) {
    const sent = group.sent;
    if (!waitsFor(sent, roller) || !isCheckOf(result, sent.use)) continue;
    const rolled = [...sent.rolled, roller];
    if (rolled.length >= sent.rollers.length) await writeGroup(actor, null);
    else await writeGroup(actor, { helpers: group.helpers, sent: { ...sent, rolled } });
  }
}

/**
 * Registers the Keeper's relay handlers and card hooks for assist groups; does nothing on a player's client.
 * @returns {boolean} true when registered
 */
export function registerAssistGroups() {
  if (!isKeeper()) return false;
  onKeeperRequest("assistJoin", joinForPlayer);
  onKeeperRequest("assistLeave", leaveForPlayer);
  registerHelperCheck(helpersInGroup);
  if (typeof Hooks?.on === "function") {
    Hooks.on("createChatMessage", onRollerCard);
    Hooks.on("updateChatMessage", onRollerCard);
  }
  return true;
}

/**
 * Asks the Keeper's client to put the player's investigator in the helped character's group.
 * @param {Actor} helped
 * @param {Actor} helper
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function joinGroup(helped, helper) {
  const reply = await askKeeper("assistJoin", { helpedUuid: helped?.uuid, helperUuid: helper?.uuid });
  return reply.ok && reply.answer === true ? { ok: true } : { ok: false, reason: reply.reason ?? "the Keeper's Rollbox refused it" };
}

/**
 * Asks the Keeper's client to take the player's investigator out of its group.
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function leaveGroup() {
  const reply = await askKeeper("assistLeave", {});
  return { ok: reply.ok && reply.answer === true, reason: reply.reason };
}

/**
 * Tells whether a player can help this character: any but their own.
 * @param {Actor} actor
 * @param {Actor} own
 * @returns {boolean}
 */
export function canBeHelped(actor, own) {
  return Boolean(actor?.uuid) && Boolean(own) && dotted(actor.uuid) !== dotted(own.uuid);
}
