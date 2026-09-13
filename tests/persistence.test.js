// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  loadLayoutMode,
  loadSavedEditors,
  loadSettings,
  saveEditors,
  saveSettings,
} from "../src/js/persistence.js";

beforeEach(() => {
  localStorage.clear();
});

describe("editor persistence", () => {
  it("returns null values when no editor text has been saved", () => {
    expect(loadSavedEditors()).toEqual({
      edgesText: null,
      boundariesText: null,
      groupsText: null,
    });
  });

  it("saves and loads all editor text", () => {
    saveEditors("A B", "TEAM A,B", "People A,B");

    expect(loadSavedEditors()).toEqual({
      edgesText: "A B",
      boundariesText: "TEAM A,B",
      groupsText: "People A,B",
    });
  });
});

describe("settings persistence", () => {
  it("uses safe defaults when no settings have been saved", () => {
    expect(loadSettings()).toEqual({
      layoutMode: "physics",
      showBoundaryHulls: true,
      showGroups: true,
      showArrows: false,
      darkMode: false,
      repulsion: "4000",
      dagLevelSpacing: 120,
    });
  });

  it("loads valid settings and persists the layout mode key", () => {
    saveSettings({
      layoutMode: "hierarchy",
      showBoundaryHulls: false,
      showGroups: false,
      showArrows: true,
      darkMode: true,
      repulsion: "-2500",
      dagLevelSpacing: 180,
    });

    expect(loadLayoutMode()).toBe("hierarchy");
    expect(loadSettings()).toEqual({
      layoutMode: "hierarchy",
      showBoundaryHulls: false,
      showGroups: false,
      showArrows: true,
      darkMode: true,
      repulsion: "-2500",
      dagLevelSpacing: 180,
    });
  });

  it("falls back to defaults for invalid saved values", () => {
    localStorage.setItem("graph-editor:settings", JSON.stringify({
      layoutMode: "invalid",
      showBoundaryHulls: "yes",
      showGroups: false,
      showArrows: "yes",
      darkMode: 1,
      repulsion: "not-a-number",
      dagLevelSpacing: 500,
    }));
    localStorage.setItem("graph-editor:layout-mode", "custom");

    expect(loadSettings()).toEqual({
      layoutMode: "custom",
      showBoundaryHulls: true,
      showGroups: false,
      showArrows: false,
      darkMode: false,
      repulsion: "4000",
      dagLevelSpacing: 120,
    });
  });

  it("uses defaults when saved settings are not valid JSON", () => {
    localStorage.setItem("graph-editor:settings", "{");

    expect(loadSettings()).toEqual({
      layoutMode: "physics",
      showBoundaryHulls: true,
      showGroups: true,
      showArrows: false,
      darkMode: false,
      repulsion: "4000",
      dagLevelSpacing: 120,
    });
  });
});
