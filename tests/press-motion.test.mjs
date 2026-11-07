import test from "node:test";
import assert from "node:assert/strict";
import { installPressMotion, JUMP_FRAMES, JUMP_OPTIONS } from "../src/features/ui/press-motion.js";

function fakeButton({ disabled = false, hasAnimation = true } = {}) {
  const handlers = {};
  const plays = [];
  const button = {
    disabled,
    addEventListener(type, handler) { handlers[type] = handler; },
    click() { handlers.click(); },
    plays,
  };
  if (hasAnimation) {
    button.animate = (frames, options) => {
      const animation = {
        cancelled: false,
        cancel() { this.cancelled = true; },
        addEventListener() {},
      };
      plays.push({ frames, options, animation });
      return animation;
    };
  }
  return button;
}

test("glass control jumps on tap with translateY and scale only", () => {
  const button = fakeButton();
  installPressMotion([button], { reducedMotion: () => false });
  button.click();
  assert.equal(button.plays.length, 1);
  assert.deepEqual(button.plays[0].frames, JUMP_FRAMES);
  assert.deepEqual(button.plays[0].options, JUMP_OPTIONS);
  assert.ok(JUMP_FRAMES.some(frame => frame.transform.includes("translateY(-11px)")));
  assert.ok(JUMP_FRAMES.every(frame => Object.keys(frame).every(key => key === "transform" || key === "offset")));
});

test("repeat taps cancel the previous jump rather than stacking animations", () => {
  const button = fakeButton();
  installPressMotion([button], { reducedMotion: () => false });
  button.click();
  const first = button.plays[0].animation;
  button.click();
  assert.equal(first.cancelled, true);
  assert.equal(button.plays.length, 2);
});

test("disabled, reduced-motion, and Web Animations-free browsers avoid extra motion", () => {
  const disabled = fakeButton({ disabled: true });
  const reduced = fakeButton();
  const noAPI = fakeButton({ hasAnimation: false });
  installPressMotion([disabled], { reducedMotion: () => false });
  installPressMotion([reduced], { reducedMotion: () => true });
  installPressMotion([noAPI], { reducedMotion: () => false });
  disabled.click();
  reduced.click();
  assert.doesNotThrow(() => noAPI.click());
  assert.equal(disabled.plays.length, 0);
  assert.equal(reduced.plays.length, 0);
});
