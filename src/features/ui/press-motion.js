/**
 * Short spring-jump animation for frosted controls.
 * Responds to a tap immediately, never waiting for GPS or network results.
 */
export const JUMP_FRAMES = Object.freeze([
  { transform: "translateY(0) scale(1)", offset: 0 },
  { transform: "translateY(2px) scale(0.94)", offset: 0.12 },
  { transform: "translateY(-11px) scale(1.055)", offset: 0.4 },
  { transform: "translateY(0) scale(0.965)", offset: 0.68 },
  { transform: "translateY(-3px) scale(1.012)", offset: 0.83 },
  { transform: "translateY(0) scale(1)", offset: 1 },
]);

export const JUMP_OPTIONS = Object.freeze({
  duration: 560,
  easing: "cubic-bezier(0.28, 0.02, 0.20, 1)",
  fill: "none",
});

export function installPressMotion(
  buttons,
  { reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches } = {},
) {
  for (const button of buttons) {
    let activeAnimation = null;

    button.addEventListener("click", () => {
      if (button.disabled || reducedMotion() || typeof button.animate !== "function") return;

      // Rapid taps restart rather than stacking jump animations.
      activeAnimation?.cancel();
      const animation = button.animate(JUMP_FRAMES, JUMP_OPTIONS);
      activeAnimation = animation;
      animation.addEventListener("finish", () => {
        if (activeAnimation === animation) activeAnimation = null;
      }, { once: true });
    });
  }
}
