import { getAtlasPalette } from "./palettes.js";

// Recolors provider layers by semantic role without changing source data,
// road geometry, line widths, filters, label placement or zoom visibility.
// OpenFreeMap Positron and Dark have different layer names; handle both.
function paintOverrides(layer, palette) {
  const id = layer.id;
  const type = layer.type;

  if (type === "background") {
    return { "background-color": palette.land };
  }

  if (type === "fill") {
    const colors = {
      park: palette.park,
      landuse_park: palette.park,
      landcover_wood: palette.forest,
      landcover_ice_shelf: palette.ice,
      landcover_glacier: palette.ice,
      landuse_residential: palette.residential,
      water: palette.water,
      building: palette.building,
      road_area_pier: palette.pier,
      "aeroway-area": palette.runway,
    };
    const color = colors[id];
    if (!color) return null;
    return id === "building"
      ? { "fill-color": color, "fill-outline-color": palette.buildingOutline }
      : { "fill-color": color };
  }

  if (type === "line") {
    let color;
    if (id === "waterway") color = palette.waterway;
    else if (id === "road_pier") color = palette.pier;
    else if (id.startsWith("tunnel_")) {
      color = id.endsWith("_casing") ? palette.majorCasing : palette.tunnel;
    }
    else if (id.startsWith("highway_motorway")) {
      color = id.endsWith("_casing") ? palette.motorwayCasing
        : id.endsWith("_subtle") ? palette.motorwaySubtle : palette.motorway;
    }
    else if (id.startsWith("highway_major")) {
      color = id.endsWith("_casing") ? palette.majorCasing
        : id.endsWith("_subtle") ? palette.majorSubtle : palette.majorRoad;
    }
    else if (id === "highway_minor") color = palette.minorRoad;
    else if (id === "highway_path") color = palette.path;
    else if (id.startsWith("railway")) {
      color = id.includes("dashline") ? palette.railDash : palette.rail;
    }
    else if (id.startsWith("aeroway-")) {
      color = id.endsWith("-casing") ? palette.runwayCasing : palette.runway;
    }
    else if (id.startsWith("boundary_")) color = palette.boundary;

    return color ? { "line-color": color } : null;
  }

  if (type === "symbol") {
    const isWater = id.startsWith("water_name") || id.startsWith("waterway_");
    const isRoad = id.startsWith("highway-name") ||
      id.startsWith("highway_name") || id.startsWith("highway-shield") ||
      id === "road_shield_us";
    const isPlace = id.startsWith("label_") || id.startsWith("place_");
    const isCountryOrState = /(?:country|state|other|suburb|village)/.test(id);

    if (!isWater && !isRoad && !isPlace && id !== "airport") return null;

    return {
      "text-color": isWater ? palette.labelWater
        : isRoad ? palette.labelRoad
        : isCountryOrState ? palette.labelSecondary : palette.labelPrimary,
      "text-halo-color": isWater ? palette.waterHalo : palette.halo,
      "text-halo-width": isRoad ? 1 : 1.3,
      "text-halo-blur": 0.25,
    };
  }

  return null;
}

export function styleTropicalAtlas(style, theme) {
  if (!style || !Array.isArray(style.layers)) return style;

  const palette = getAtlasPalette(theme);
  return {
    ...style,
    layers: style.layers.map((layer) => {
      const overrides = paintOverrides(layer, palette);
      if (!overrides) return layer;

      const paint = { ...(layer.paint || {}), ...overrides };
      // The upstream dark forest uses a gray sprite pattern that would mask
      // our forest fill. Remove only that pattern, preserving the geometry.
      if (layer.id === "landcover_wood") delete paint["fill-pattern"];

      return { ...layer, paint };
    }),
  };
}
