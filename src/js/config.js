// --- Force-simulation tuning (d3-force, see js/simulation.js) ---
export const CHARGE_STRENGTH = -300; // node-node repulsion (negative = repulsive); d3's Barnes-Hut approximation keeps this cheap even for hundreds of nodes
export const CHARGE_DISTANCE_MAX = 300; // caps how far repulsion reaches; without this, charge keeps pushing distant nodes apart faster than centering can pull them back, and they pile up against the clamped canvas edge
export const CENTER_STRENGTH = 0.1; // per-node pull toward canvas center (forceX/forceY) — unlike forceCenter (which only recenters the *average* position), this keeps individual outliers from drifting to the border
export const LINK_STRENGTH = 0.4; // spring stiffness along edges (d3's 0..1 convention, not a raw force constant)
export const SPRING_LENGTH = 150; // ideal edge length
export const VELOCITY_DECAY = 0.3; // d3's per-tick "friction" (lower = livelier motion, more momentum)
export const COLLIDE_PADDING = 6; // extra gap the collision force enforces beyond each node's own radius
export const STATION_ATTRACTION_STRENGTH = 0.01; // pulls station members toward their group's live centroid
export const SUBSTATION_VERTICAL_STRENGTH = 0.08; // strongly keeps substations toward the top of the canvas
export const SUBSTATION_TARGET_RATIO = 0.14; // target substation center as a fraction of canvas height
export const STATION_REPULSION_STRENGTH = 3; // keeps unrelated nodes outside station rectangles
export const STATION_REPULSION_PADDING = 12; // starts pushing unrelated nodes before they touch a hull
export const ALPHA_DECAY = 0.05; // how fast the simulation cools down (higher = settles sooner)
export const ALPHA_MIN = 0.001; // below this, the simulation is considered settled

// --- Canvas zoom (see js/zoom.js) ---
export const MIN_ZOOM = 0.25; // furthest zoomed out (4x smaller than natural size)
export const MAX_ZOOM = 4; // furthest zoomed in (4x larger than natural size)

export const MIN_NODE_RADIUS = 20;
export const LABEL_PADDING = 10; // horizontal breathing room inside the circle, per side
export const STATION_HULL_MARGIN = 16; // breathing room between member node circles and the hull boundary

// Station types: fixed set, each with its own display color used for the hull outline,
// fill, label text, and legend swatch (see styles.css .station-swatch-*).
export const STATION_TYPES = {
  CS: { label: "Control station", color: "#2f7de1" },
  SS: { label: "Switching station", color: "#f2994a" },
  SUB: { label: "Substation", color: "#6b7280" },
};

// Special-case edge keywords: colored + hidden from the visible label. Keys double as
// CSS class names and arrowhead marker ids; keep colors in sync with styles.css.
export const KEYWORD_STYLES = [
  { keyword: "transformer", className: "transformer", color: "#2f7de1" },
  { keyword: "link", className: "link", color: "#2fa84f" },
  { keyword: "x", className: "x", color: "#d84b4b" },
];
export const DEFAULT_EDGE_COLOR = "#facc37";
