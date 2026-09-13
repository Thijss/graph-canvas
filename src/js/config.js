// --- Force-simulation tuning (d3-force, see js/simulation.js) ---
export const CHARGE_STRENGTH = -300; // node-node repulsion (negative = repulsive); d3's Barnes-Hut approximation keeps this cheap even for hundreds of nodes
export const CHARGE_DISTANCE_MAX = 300; // caps how far repulsion reaches; without this, charge keeps pushing distant nodes apart faster than centering can pull them back, and they pile up against the clamped canvas edge
export const CENTER_STRENGTH = 0.1; // per-node pull toward canvas center (forceX/forceY) — unlike forceCenter (which only recenters the *average* position), this keeps individual outliers from drifting to the border
export const LINK_STRENGTH = 0.4; // spring stiffness along edges (d3's 0..1 convention, not a raw force constant)
export const SPRING_LENGTH = 150; // ideal edge length
export const VELOCITY_DECAY = 0.3; // d3's per-tick "friction" (lower = livelier motion, more momentum)
export const COLLIDE_PADDING = 6; // extra gap the collision force enforces beyond each node's own radius
export const BOUNDARY_ATTRACTION_STRENGTH = 0.01; // pulls boundary members toward their boundary's live centroid
export const BOUNDARY_REPULSION_STRENGTH = 3; // keeps unrelated nodes outside boundary rectangles
export const BOUNDARY_REPULSION_PADDING = 12; // starts pushing unrelated nodes before they touch a hull
export const ALPHA_DECAY = 0.05; // how fast the simulation cools down (higher = settles sooner)
export const ALPHA_MIN = 0.001; // below this, the simulation is considered settled

// --- Canvas zoom (see js/zoom.js) ---
export const MIN_ZOOM = 0.25; // furthest zoomed out (4x smaller than natural size)
export const MAX_ZOOM = 4; // furthest zoomed in (4x larger than natural size)

export const MIN_NODE_RADIUS = 20;
export const LABEL_PADDING = 10; // horizontal breathing room inside the circle, per side
export const BOUNDARY_HULL_MARGIN = 16; // breathing room between member node circles and the hull boundary
export const BOUNDARY_FILL_OPACITY = 0.5;
export const NODE_CLICK_PHYSICS_LOCK_MS = 300;

// Boundary types are words made from letters, digits, hyphens, and underscores.
export const BOUNDARY_TYPE_PATTERN = /^[a-z0-9_-]+$/i;

// Types are assigned colors in their order of first appearance by the
// renderer. The palette is intentionally limited to ten colors.
export const COLOR_PALETTE = [
  "#4e79a7",
  "#f28e2b",
  "#bab0ab",
  "#76b7b2",
  "#59a14f",
  "#edc948",
  "#b07aa1",
  "#ff9da7",
  "#9c755f",
  "#e15759",
];

export function getPaletteColor(index) {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

// Canonical boundary color keywords (COLOR-1..COLOR-10) let the visual boundary
// editor assign an exact palette color directly instead of relying on order of
// first appearance. Custom/legacy type words keep using order-based palette
// assignment for backward compatibility with existing saved graphs.
const CANONICAL_BOUNDARY_COLOR_PATTERN = /^COLOR-([1-9]|10)$/;

export function isCanonicalBoundaryColorType(type) {
  return CANONICAL_BOUNDARY_COLOR_PATTERN.test((type ?? "").toUpperCase());
}

export function getBoundaryTypeColor(type, fallbackIndex) {
  const match = CANONICAL_BOUNDARY_COLOR_PATTERN.exec((type ?? "").toUpperCase());
  if (match) {
    const index = Number(match[1]) - 1;
    if (index < COLOR_PALETTE.length) return COLOR_PALETTE[index];
  }
  return getPaletteColor(fallbackIndex);
}

export const GROUP_COLOR_PALETTE = [
  "hsl(335 62% 68% / 1)",
  "hsl(28 92% 60% / 1)",
  "hsl(105 52% 55% / 1)",
  "hsl(174 45% 60% / 1)",
  "hsl(208 58% 58% / 1)",
  "hsl(270 45% 62% / 1)",
  "hsl(68 65% 58% / 1)",
  "hsl(48 90% 60% / 1)",
  "hsl(320 62% 65% / 1)",
  "hsl(20 12% 60% / 1)",
];

export function getGroupColor(labelOrIndex, fallbackIndex = 0) {
  const index = typeof labelOrIndex === "number"
    ? labelOrIndex
    : Number(/^GROUP-([1-9]|10)$/i.exec(labelOrIndex ?? "")?.[1] ?? fallbackIndex + 1) - 1;
  return GROUP_COLOR_PALETTE[(index + GROUP_COLOR_PALETTE.length) % GROUP_COLOR_PALETTE.length];
}

export const EDGE_COLORS = [
  { token: "yellow", className: "yellow", color: "#facc37" },
  { token: "blue", className: "blue", color: "#2f7de1" },
  { token: "green", className: "green", color: "#2fa84f" },
  { token: "red", className: "red", color: "#d84b4b" },
];
