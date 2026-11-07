import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePosition, requestCurrentLocation, getLocationErrorMessage, LOCATION_OPTIONS
} from "../src/features/location/geolocation.js";
import { createAccuracyGeometry } from "../src/features/location/accuracy.js";
import { createLocationOverlay } from "../src/features/location/location-overlay.js";
import { createLocationController } from "../src/features/location/location-controller.js";

test("accepts finite coordinates and reports the device's accuracy", () => {
  assert.deepEqual(
    normalizePosition({ coords: { latitude: 3.1385, longitude: 101.6870, accuracy: 25 } }),
    { lat: 3.1385, lng: 101.687, accuracy: 25 }
  );
  assert.equal(normalizePosition({ coords: { latitude: 3, longitude: 101 } }).accuracy, null);
  assert.throws(() => normalizePosition({ coords: { latitude: 95, longitude: 100 } }), /invalid location/);
  assert.throws(() => normalizePosition({ coords: { latitude: NaN, longitude: 100 } }), /invalid location/);
});

test("requests location once with high accuracy and no continuous tracking", async () => {
  let calls = 0;
  let observedOptions;
  const geolocation = {
    getCurrentPosition(success, _failure, options) {
      calls++;
      observedOptions = options;
      success({ coords: { latitude: 1.51, longitude: 103.76, accuracy: 40 } });
    },
    watchPosition() { throw new Error("Unexpected background GPS tracking"); },
  };
  const result = await requestCurrentLocation(geolocation);
  assert.equal(calls, 1);
  assert.deepEqual(observedOptions, LOCATION_OPTIONS);
  assert.deepEqual(result, { lat: 1.51, lng: 103.76, accuracy: 40 });
});

test("handles permission errors and missing geolocation", async () => {
  await assert.rejects(requestCurrentLocation(null), /HTTPS/);
  await assert.rejects(requestCurrentLocation({
    getCurrentPosition(_success, failure) { failure({ code: 1 }); },
  }), { code: 1 });
  assert.match(getLocationErrorMessage({ code: 1 }), /denied/);
  assert.match(getLocationErrorMessage({ code: 2 }), /unavailable/);
  assert.match(getLocationErrorMessage({ code: 3 }), /timed out/);
});

test("accuracy geometry is a closed polygon with a real meter-scale radius", () => {
  const center = { lng: 101.687, lat: 3.1385, accuracy: 100 };
  const result = createAccuracyGeometry(center);
  assert.equal(result.type, "FeatureCollection");
  assert.equal(result.features.length, 1);
  const ring = result.features[0].geometry.coordinates[0];
  assert.equal(ring.length, 65);
  assert.deepEqual(ring[0], ring[64]);
  // Approximate great-circle distance from center to first point.
  const dLat = (ring[0][1] - center.lat) * Math.PI / 180;
  const dLng = (ring[0][0] - center.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(center.lat * Math.PI / 180) * Math.cos(ring[0][1] * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const distance = 6371008.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  assert.ok(Math.abs(distance - 100) < 0.2, `Expected 100 m, got ${distance}`);
  assert.deepEqual(createAccuracyGeometry({ ...center, accuracy: null }).features, []);
});

test("overlay keeps coordinates stable and rebuilds accuracy layers on style.load", () => {
  const originalDocument = globalThis.document;
  const listeners = {};
  const sources = new Map();
  const layers = new Map();
  let lastMarker;
  class FakeMarker {
    constructor({ element }) { this.element = element; lastMarker = this; }
    setLngLat(point) { this.point = point; return this; }
    addTo(map) { this.map = map; return this; }
  }
  const fakeMap = {
    on(event, cb) { listeners[event] = cb; },
    getSource(id) { return sources.get(id); },
    addSource(id, spec) {
      sources.set(id, {
        data: spec.data,
        setData(next) { this.data = next; },
      });
    },
    getLayer(id) { return layers.get(id); },
    addLayer(layer, before) { layers.set(layer.id, { ...layer, before }); },
    getStyle() { return { layers: [{ id: "map-labels", type: "symbol" }] }; },
  };
  globalThis.document = {
    createElement() {
      return { setAttribute() {}, append() {} };
    },
  };
  try {
    const overlay = createLocationOverlay(fakeMap, FakeMarker);
    overlay.show({ lat: 3.14, lng: 101.69, accuracy: 50 });
    assert.deepEqual(lastMarker.point, [101.69, 3.14]);
    assert.equal(sources.size, 1);
    assert.equal(layers.size, 2);
    overlay.show({ lat: 3.15, lng: 101.7, accuracy: 75 });
    assert.deepEqual(lastMarker.point, [101.7, 3.15]);

    // A new style removes application-added sources and layers.
    sources.clear();
    layers.clear();
    listeners["style.load"]();
    assert.equal(sources.size, 1);
    assert.equal(layers.size, 2);
    assert.deepEqual(lastMarker.point, [101.7, 3.15]);
  } finally {
    globalThis.document = originalDocument;
  }
});

test("location controller only flies to coordinates after explicit tap", async () => {
  const originalWindow = globalThis.window;
  let click;
  let fly;
  let shown;
  let requested = 0;
  const attrs = {};
  const button = {
    disabled: false,
    addEventListener(event, cb) { if (event === "click") click = cb; },
    setAttribute(key, value) { attrs[key] = value; },
    removeAttribute(key) { delete attrs[key]; },
  };
  const status = { hidden: true, textContent: "", classList: { toggle() {} } };
  globalThis.window = {
    clearTimeout() {},
    setTimeout() { return 1; },
    matchMedia() { return { matches: false }; },
  };
  try {
    createLocationController({
      button,
      status,
      map: {
        getZoom() { return 11; },
        flyTo(options) { fly = options; },
        jumpTo() { throw new Error("Should animate"); },
      },
      overlay: { show(position) { shown = position; } },
      requestLocation: async () => {
        requested++;
        return { lat: 3.14, lng: 101.69, accuracy: 25 };
      },
    });
    assert.equal(requested, 0);
    await click();
    assert.equal(requested, 1);
    assert.deepEqual(shown, { lat: 3.14, lng: 101.69, accuracy: 25 });
    assert.deepEqual(fly.center, [101.69, 3.14]);
    assert.equal(fly.zoom, 15);
    assert.equal(button.disabled, false);
    assert.equal(attrs["aria-busy"], undefined);
    assert.equal(attrs["data-bubble"], undefined);
    assert.match(status.textContent, /25 m/);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("a rejected location request restores the button without moving the map", async () => {
  const originalWindow = globalThis.window;
  let click;
  let moved = false;
  const attrs = {};
  const button = {
    disabled: false,
    addEventListener(_, cb) { click = cb; },
    setAttribute(key, value) { attrs[key] = value; },
    removeAttribute(key) { delete attrs[key]; },
  };
  const status = { hidden: true, textContent: "", classList: { toggle() {} } };
  globalThis.window = {
    clearTimeout() {},
    setTimeout() { return 1; },
    matchMedia() { return { matches: false }; },
  };
  try {
    createLocationController({
      button, status,
      map: { getZoom() { return 7; }, flyTo() { moved = true; } },
      overlay: { show() { moved = true; } },
      requestLocation: async () => { throw { code: 1 }; },
    });
    await click();
    assert.equal(moved, false);
    assert.equal(button.disabled, false);
    assert.equal(attrs["data-bubble"], undefined);
    assert.match(status.textContent, /denied/);
  } finally {
    globalThis.window = originalWindow;
  }
});
