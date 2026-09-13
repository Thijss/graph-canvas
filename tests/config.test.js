import { describe, expect, it } from "vitest";
import {
  COLOR_PALETTE,
  getBoundaryTypeColor,
  getGroupColor,
  getPaletteColor,
  isCanonicalBoundaryColorType,
} from "../src/js/config.js";

describe("palette helpers", () => {
  it("wraps palette indexes", () => {
    expect(getPaletteColor(COLOR_PALETTE.length)).toBe(COLOR_PALETTE[0]);
  });

  it("recognizes canonical boundary color types case-insensitively", () => {
    expect(isCanonicalBoundaryColorType("color-10")).toBe(true);
    expect(isCanonicalBoundaryColorType("COLOR-11")).toBe(false);
    expect(isCanonicalBoundaryColorType("team")).toBe(false);
  });

  it("maps canonical boundary types to exact palette colors", () => {
    expect(getBoundaryTypeColor("COLOR-2", 0)).toBe(COLOR_PALETTE[1]);
    expect(getBoundaryTypeColor("team", 2)).toBe(COLOR_PALETTE[2]);
  });

  it("supports both generated and named group colors", () => {
    expect(getGroupColor(0)).toBe(getGroupColor("GROUP-1"));
    expect(getGroupColor("GROUP-10")).toBe(getGroupColor(9));
  });
});
