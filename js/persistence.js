// Persists just the two textareas' raw text (edges + stations) to
// localStorage, so a page refresh restores what the user typed. Node
// positions and other UI state are intentionally not persisted.
const EDGES_KEY = "graph-editor:edges";
const STATIONS_KEY = "graph-editor:stations";
const LAYOUT_MODE_KEY = "graph-editor:layout-mode";
const SETTINGS_KEY = "graph-editor:settings";

// Reads previously saved editor text, if any. Returns null values for
// anything that wasn't saved (or if localStorage is unavailable).
export function loadSavedEditors() {
  try {
    return {
      edgesText: localStorage.getItem(EDGES_KEY),
      stationsText: localStorage.getItem(STATIONS_KEY),
    };
  } catch {
    return { edgesText: null, stationsText: null };
  }
}

// Saves the current editor text. Silently no-ops if localStorage is
// unavailable (e.g. private browsing with storage disabled).
export function saveEditors(edgesText, stationsText) {
  try {
    localStorage.setItem(EDGES_KEY, edgesText);
    localStorage.setItem(STATIONS_KEY, stationsText);
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

export function saveLayoutMode(mode) {
  try {
    localStorage.setItem(LAYOUT_MODE_KEY, mode);
  } catch {
    // ignore — persistence is a nice-to-have, not a requirement
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
      showStationHulls: saved.showStationHulls === true,
      showArrows: saved.showArrows !== false,
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
      showStationHulls: false,
      showArrows: true,
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
