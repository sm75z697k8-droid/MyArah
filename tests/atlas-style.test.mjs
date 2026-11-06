import test from "node:test";
import assert from "node:assert/strict";
import { getAtlasPalette } from "../src/features/map/styles/palettes.js";
import { styleTropicalAtlas } from "../src/features/map/styles/tropical-atlas.js";

function fixture() {
  return {
    version: 8,
    name: "Provider original",
    sprite: "https://example.org/sprite",
    glyphs: "https://example.org/fonts/{fontstack}/{range}.pbf",
    sources: { osm: { type: "vector", url: "https://example.org/tiles" } },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#ffffff" } },
      { id: "water", type: "fill", source: "osm", "source-layer": "water", paint: { "fill-color": "#ddd" } },
      { id: "park", type: "fill", paint: { "fill-color": "#ddd" } },
      { id: "landuse_park", type: "fill", paint: { "fill-color": "#ddd" } },
      { id: "landcover_wood", type: "fill", paint: { "fill-pattern": "wood-pattern", "fill-color": "#444" } },
      {
        id: "highway_motorway_inner", type: "line",
        filter: ["==", ["get", "class"], "motorway"],
        layout: { "line-cap": "round" },
        paint: { "line-color": "#fff", "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1, 15, 8] },
      },
      { id: "highway_motorway_bridge_casing", type: "line", paint: { "line-color": "#aaa", "line-width": 5 } },
      { id: "label_city", type: "symbol", layout: { "text-field": ["get", "name"] }, paint: { "text-color": "#222" } },
      { id: "place_city", type: "symbol", layout: { "text-field": ["get", "name"] }, paint: { "text-color": "#222" } },
      { id: "water_name", type: "symbol", layout: { "text-field": ["get", "name"] }, paint: { "text-color": "#222" } },
      { id: "custom-untouched", type: "circle", paint: { "circle-color": "#abcd12" } },
    ],
  };
}

test("day map uses the Tropical Atlas limestone palette", () => {
  const style = styleTropicalAtlas(fixture(), "light");
  const palette = getAtlasPalette("light");
  assert.equal(style.layers[0].paint["background-color"], palette.land);
  assert.equal(style.layers[1].paint["fill-color"], palette.water);
  assert.equal(style.layers[2].paint["fill-color"], palette.park);
  assert.equal(style.layers[5].paint["line-color"], palette.motorway);
  assert.equal(style.layers[7].paint["text-color"], palette.labelPrimary);
});

test("night map uses petrol, forest and readable pale text", () => {
  const style = styleTropicalAtlas(fixture(), "dark");
  const palette = getAtlasPalette("dark");
  assert.equal(style.layers[0].paint["background-color"], palette.land);
  assert.equal(style.layers[3].paint["fill-color"], palette.park);
  assert.equal(style.layers[5].paint["line-color"], palette.motorway);
  assert.equal(style.layers[8].paint["text-color"], palette.labelPrimary);
  assert.equal(style.layers[9].paint["text-color"], palette.labelWater);
});

test("preserves map source data, sprites, glyphs, geometry and widths", () => {
  const original = fixture();
  const updated = styleTropicalAtlas(original, "dark");
  assert.deepEqual(updated.sources, original.sources);
  assert.equal(updated.sprite, original.sprite);
  assert.equal(updated.glyphs, original.glyphs);
  assert.equal(updated.layers.length, original.layers.length);
  assert.deepEqual(updated.layers[5].filter, original.layers[5].filter);
  assert.deepEqual(updated.layers[5].layout, original.layers[5].layout);
  assert.deepEqual(updated.layers[5].paint["line-width"], original.layers[5].paint["line-width"]);
  assert.deepEqual(updated.layers[7].layout, original.layers[7].layout);
  assert.strictEqual(updated.layers[10], original.layers[10]);
});

test("does not mutate the OpenFreeMap base style", () => {
  const original = fixture();
  const before = structuredClone(original);
  styleTropicalAtlas(original, "light");
  styleTropicalAtlas(original, "dark");
  assert.deepEqual(original, before);
});

test("removes forest pattern so the assigned forest color is visible", () => {
  const styled = styleTropicalAtlas(fixture(), "dark");
  assert.equal(Object.hasOwn(styled.layers[4].paint, "fill-pattern"), false);
  assert.equal(styled.layers[4].paint["fill-color"], getAtlasPalette("dark").forest);
});

test("preserves unknown layers and handles absent style data", () => {
  assert.equal(styleTropicalAtlas(null, "light"), null);
  const original = fixture();
  const updated = styleTropicalAtlas(original, "light");
  assert.strictEqual(updated.layers[10], original.layers[10]);
});

test("unexpected theme values safely choose light", () => {
  assert.strictEqual(getAtlasPalette("other"), getAtlasPalette("light"));
  assert.equal(styleTropicalAtlas(fixture(), "other").layers[0].paint["background-color"], getAtlasPalette("light").land);
});
