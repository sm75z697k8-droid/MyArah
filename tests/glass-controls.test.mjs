import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("frosted controls show a blurred translucent backdrop and a thin border", () => {
  const css = read("src/styles/map.css");
  const tokens = read("src/styles/tokens.css");
  assert.match(css, /border: 1px solid var\(--glass-stroke\)/);
  assert.match(css, /-webkit-backdrop-filter: blur\(12px\)/);
  assert.match(css, /backdrop-filter: blur\(12px\)/);
  assert.match(css, /background: var\(--glass-fill\)/);
  assert.match(css, /@supports not/);
  const values = [...tokens.matchAll(/--glass-fill:\s*rgba\([^;]*,\s*(0\.\d+)\)/g)];
  assert.equal(values.length, 2);
  for (const value of values) assert.ok(Number(value[1]) < 0.65);
});

test("static controls have no decorative animation and remain connected", () => {
  const main = read("src/main.js");
  const html = read("index.html");
  const cssFiles = ["src/styles/map.css", "src/styles/location.css"];
  for (const file of cssFiles) {
    const css = read(file);
    assert.doesNotMatch(css, /@keyframes|^\s*(?:animation|transition)\s*:/m);
  }
  assert.doesNotMatch(main, /installPressMotion|press-motion/);
  assert.doesNotMatch(html, /bubbles\.css|location-spinner/);
  assert.match(html, /id="locate-button"/);
  assert.match(html, /id="theme-toggle"/);
  assert.match(read("src/styles/location.css"), /location-control\[aria-busy="true"\]/);
});
