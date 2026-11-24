/** Auto-hide: drops the full character sheet to the compact card after a wait without use. See docs/panel.md. */
import { readSetting } from "./appearance.js";

/** Auto-hide's wait limits, in seconds. */
export const AUTO_HIDE = Object.freeze({ min: 1, max: 300, step: 1, default: 10 });

/** Tracks the wait and whether the panel shows the compact card; one per panel. */
export class AutoHide {
  /**
   * @param {{redraw: () => void, visible: () => boolean}} panel `visible`: the card drops only while the panel shows
   */
  constructor({ redraw, visible }) {
    this.redraw = redraw;
    this.visible = visible;
    this.timer = null;
    this.compact = false;
    this.hovering = false;
  }

  on() {
    return readSetting("rollboxAutoHide", false) === true;
  }

  waitMs() {
    const n = Number(readSetting("rollboxAutoHideAfter", AUTO_HIDE.default));
    const seconds = Number.isFinite(n) ? Math.max(AUTO_HIDE.min, Math.min(AUTO_HIDE.max, n)) : AUTO_HIDE.default;
    return seconds * 1000;
  }

  /** Starts the wait again; it runs out only with the pointer away and the panel showing. */
  schedule() {
    clearTimeout(this.timer);
    this.timer = null;
    if (!this.on()) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.hovering || !this.visible()) return this.schedule();
      this.compact = true;
      this.redraw();
      return undefined;
    }, this.waitMs());
  }

  /** Brings the full card back and starts the wait again. */
  wake() {
    if (this.compact) {
      this.compact = false;
      this.redraw();
    }
    this.schedule();
  }

  stop() {
    clearTimeout(this.timer);
    this.timer = null;
    this.compact = false;
  }

  watch(root) {
    root.addEventListener("pointerenter", () => {
      this.hovering = true;
      this.wake();
    });
    root.addEventListener("pointerleave", () => {
      this.hovering = false;
      this.schedule();
    });
    root.addEventListener("pointerdown", () => this.wake());
  }
}
