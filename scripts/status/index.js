/** Status effects' public surface: other parts import status from here only. See docs/status.md. */
export {
  BOUT_REASON, ROLLBOX_STATUSES, downReason, getStatuses, hasStatus, isHeld, playerBlock, readRoundNotesWith,
  setRollboxStatus
} from "./statuses.js";
export { attackDice } from "./effects.js";
