// Persists the editor text (edges + boundaries + groups) to
// localStorage, so a page refresh restores what the user typed. Node
// positions and other UI state are intentionally not persisted.
const EDGES_KEY = "graph-editor:edges";
const BOUNDARIES_KEY = "graph-editor:boundaries";
const GROUPS_KEY = "graph-editor:groups";
const LAYOUT_MODE_KEY = "graph-editor:layout-mode";
const SETTINGS_KEY = "graph-editor:settings";

// Reads previously saved editor text, if any. Returns null values for
// anything that wasn't saved (or if localStorage is unavailable).
export function loadSavedEditors() {
  try {
    return {
      edgesText: localStorage.getItem(EDGES_KEY),
      boundariesText: localStorage.getItem(BOUNDARIES_KEY),
      groupsText: localStorage.getItem(GROUPS_KEY),
    };
  } catch {
    return { edgesText: null, boundariesText: null, groupsText: null };
  }
}

// Saves the current editor text. Silently no-ops if localStorage is
// unavailable (e.g. private browsing with storage disabled).
export function saveEditors(edgesText, boundariesText, groupsText) {
  try {
    localStorage.setItem(EDGES_KEY, edgesText);
    localStorage.setItem(BOUNDARIES_KEY, boundariesText);
    localStorage.setItem(GROUPS_KEY, groupsText);
  } catch {
    // ignore — persistence is a nice-to-have, not a requirement
  }
}

export function loadLayoutMode() {
  try {
    const mode = localStorage.getItem(LAYOUT_MODE_KEY);
    return ["physics", "hierarchy", "custom"].includes(mode) ? mode : "physics";
  } catch {
    return "physics";
  }
}

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
    const layoutMode = ["physics", "hierarchy", "custom"].includes(saved.layoutMode)
      ? saved.layoutMode
      : loadLayoutMode();
    return {
      layoutMode,
      showBoundaryHulls: saved.showBoundaryHulls !== false,
      showGroups: saved.showGroups !== false,
      showArrows: saved.showArrows === true,
      darkMode: saved.darkMode === true,
      repulsion: typeof saved.repulsion === "string" && /^-?\d+$/.test(saved.repulsion)
        ? saved.repulsion
        : "4000",
      dagLevelSpacing: Number.isFinite(saved.dagLevelSpacing) && saved.dagLevelSpacing >= 60 && saved.dagLevelSpacing <= 300
        ? saved.dagLevelSpacing
        : 120,
    };
  } catch {
    return {
      layoutMode: loadLayoutMode(),
      showBoundaryHulls: true,
      showGroups: true,
      showArrows: false,
      repulsion: "4000",
      dagLevelSpacing: 120,
    };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(LAYOUT_MODE_KEY, settings.layoutMode);
  } catch {
    // ignore — persistence is a nice-to-have, not a requirement
  }
}
