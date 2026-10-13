// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  loadLayoutMode,
  loadEditorModes,
  loadSavedEditors,
  loadSettings,
  saveEditors,
  saveEditorModes,
  saveSettings,
} from "../src/js/persistence.js";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
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
    expect(localStorage.length).toBe(0);
  });

  it("does not load editor text saved in localStorage", () => {
    localStorage.setItem("graph-editor:edges", "Shared A B");
    localStorage.setItem("graph-editor:boundaries", "SHARED A,B");
    localStorage.setItem("graph-editor:groups", "Shared A,B");

    expect(loadSavedEditors()).toEqual({
      edgesText: null,
      boundariesText: null,
      groupsText: null,
    });
  });
});

describe("editor mode persistence", () => {
  it("defaults only the boundary and group modes", () => {
    expect(loadEditorModes()).toEqual({ boundaries: "visual", groups: "visual" });
  });

  it.each(["visual", "raw"])("ignores the legacy %s edge mode", (edges) => {
    localStorage.setItem("graph-editor:editor-modes", JSON.stringify({
      edges, boundaries: "text", groups: "visual",
    }));
    expect(loadEditorModes()).toEqual({ boundaries: "text", groups: "visual" });
  });

  it("saves and loads boundary and group modes", () => {
    saveEditorModes({ boundaries: "visual", groups: "text" });
    expect(loadEditorModes()).toEqual({ boundaries: "visual", groups: "text" });
    expect(JSON.parse(localStorage.getItem("graph-editor:editor-modes")))
      .toEqual({ boundaries: "visual", groups: "text" });
  });

  it("uses defaults for invalid saved modes", () => {
    localStorage.setItem("graph-editor:editor-modes", "{");
    expect(loadEditorModes()).toEqual({ boundaries: "visual", groups: "visual" });
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
