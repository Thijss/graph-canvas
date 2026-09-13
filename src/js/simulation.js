import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceX,
  forceY,
  forceCollide,
} from "./vendor/d3-force.js";
import {
  MIN_NODE_RADIUS,
  LABEL_PADDING,
  BOUNDARY_HULL_MARGIN,
  CHARGE_STRENGTH,
  CHARGE_DISTANCE_MAX,
  CENTER_STRENGTH,
  LINK_STRENGTH,
  SPRING_LENGTH,
  VELOCITY_DECAY,
  COLLIDE_PADDING,
  BOUNDARY_ATTRACTION_STRENGTH,
  BOUNDARY_REPULSION_STRENGTH,
  BOUNDARY_REPULSION_PADDING,
  ALPHA_DECAY,
  ALPHA_MIN,
} from "./config.js";

const measureCtx = document.createElement("canvas").getContext("2d");
measureCtx.font = "750 12px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// Grows the circle's radius so long labels always fit comfortably inside it.
export function getNodeRadius(name) {
  const textWidth = measureCtx.measureText(name).width;
  return Math.max(MIN_NODE_RADIUS, textWidth / 2 + LABEL_PADDING);
}

// New nodes spawn just outside/near the lower half of the visible border, so
// they can be seen rising toward their settled positions once gravity kicks
// in. `state` is passed in explicitly (rather than imported as a singleton)
// so this module stays a self-contained, independently testable algorithm.
// Existing nodes are left untouched — d3-force mutates their x/y/vx/vy in
// place, so this only ever seeds brand-new nodes and prunes removed ones.
export function layoutNodes(state, nodes, width, height) {
  const centerX = width / 2;
  const centerY = height / 2;
  const margin = 20;
  nodes.forEach((name) => {
    if (!state.positions.has(name)) {
      const angle = Math.random() * Math.PI;
      // Point on the rectangle's inscribed border ellipse, so it's visible right at the edge.
      state.positions.set(name, {
        id: name,
        x: Math.min(Math.max(centerX + Math.cos(angle) * (width / 2 - margin), margin), width - margin),
        y: Math.min(Math.max(centerY + Math.sin(angle) * (height / 2 - margin), margin), height - margin),
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
      });
    }
  });
  for (const name of state.positions.keys()) {
    if (!nodes.includes(name)) {
      state.positions.delete(name);
      state.pinnedNodes.delete(name);
    }
  }
}

// Places nodes into directed top-down layers. Nodes in cycles are placed in
// the first layer because they have no unambiguous topological depth.
export function layoutTopDown(state, nodes, edges, width, height, levelGap = 120) {
  const levels = new Map(nodes.map((name) => [name, 0]));
  const incoming = new Map(nodes.map((name) => [name, 0]));
  const outgoing = new Map(nodes.map((name) => [name, []]));

  edges.forEach(({ from, to }) => {
    if (from === to || !incoming.has(from) || !incoming.has(to)) return;
    incoming.set(to, incoming.get(to) + 1);
    outgoing.get(from).push(to);
  });

  const queue = nodes.filter((name) => incoming.get(name) === 0);
  const visited = new Set();
  while (queue.length) {
    const name = queue.shift();
    visited.add(name);
    outgoing.get(name).forEach((target) => {
      levels.set(target, Math.max(levels.get(target), levels.get(name) + 1));
      incoming.set(target, incoming.get(target) - 1);
      if (incoming.get(target) === 0) queue.push(target);
    });
  }

  const layers = new Map();
  nodes.forEach((name) => {
    const level = visited.has(name) ? levels.get(name) : 0;
    const layer = layers.get(level) ?? [];
    layer.push(name);
    layers.set(level, layer);
  });

  const layerGap = levelGap;
  layers.forEach((layer, level) => {
    const nodeGap = width / (layer.length + 1);
    layer.forEach((name, index) => {
      const node = state.positions.get(name);
      if (!node) return;
      node.x = nodeGap * (index + 1);
      node.y = layerGap * (level + 1);
      node.vx = 0;
      node.vy = 0;
    });
  });
}

// d3 integrates velocity into position internally as part of its own tick
// step (before the "tick" event fires), so clamping nodes to the canvas
// can't be done as a custom force — it must run as a post-processing step
// after each tick (and once immediately after layout), mirroring how the old
// hand-rolled physics loop clamped position every frame.
export function clampToBounds(state, nodes, width, height, view = null) {
  const left = view?.x ?? 0;
  const top = view?.y ?? 0;
  const right = left + (view ? width / view.scale : width);
  const bottom = top + (view ? height / view.scale : height);
  nodes.forEach((name) => {
    const n = state.positions.get(name);
    if (!n) return;
    const radius = state.nodeRadii.get(name) ?? MIN_NODE_RADIUS;
    n.x = Math.min(Math.max(n.x, left + radius), right - radius);
    n.y = Math.min(Math.max(n.y, top + radius), bottom - radius);
  });
}

export function getBoundaryBounds(state, boundary) {
  const points = boundary.members
    .map((name) => {
      const p = state.positions.get(name);
      return p ? { x: p.x, y: p.y, name } : null;
    })
    .filter(Boolean);
  if (!points.length) return null;

  return {
    left: Math.min(...points.map((point) => point.x - (state.nodeRadii.get(point.name) ?? MIN_NODE_RADIUS))) - BOUNDARY_HULL_MARGIN,
    right: Math.max(...points.map((point) => point.x + (state.nodeRadii.get(point.name) ?? MIN_NODE_RADIUS))) + BOUNDARY_HULL_MARGIN,
    top: Math.min(...points.map((point) => point.y - (state.nodeRadii.get(point.name) ?? MIN_NODE_RADIUS))) - BOUNDARY_HULL_MARGIN,
    bottom: Math.max(...points.map((point) => point.y + (state.nodeRadii.get(point.name) ?? MIN_NODE_RADIUS))) + BOUNDARY_HULL_MARGIN,
  };
}

// --- Custom d3-force forces -------------------------------------------------
// Each factory returns a plain `(alpha) => void` function that mutates node
// vx/vy directly, following d3's custom-force convention (see
// https://d3js.org/d3-force#custom-forces). They close over the `boundaries`
// array captured at the time updateSimulationForces() built them, and re-read
// live positions from `state.positions` on every call.

// Boundary clustering: pull each member toward its boundary's own live centroid so
// boundaries visually cluster together (the charge/collide forces above still
// keep them from collapsing into a single point).
function createBoundaryClusterForce(state, boundaries) {
  return function force(alpha) {
    boundaries.forEach((boundary) => {
      if (boundary.members.length < 2) return;
      let cx = 0;
      let cy = 0;
      let count = 0;
      boundary.members.forEach((name) => {
        const n = state.positions.get(name);
        if (!n) return;
        cx += n.x;
        cy += n.y;
        count++;
      });
      if (count < 2) return;
      cx /= count;
      cy /= count;
      boundary.members.forEach((name) => {
        const n = state.positions.get(name);
        if (!n) return;
        n.vx += (cx - n.x) * BOUNDARY_ATTRACTION_STRENGTH * alpha;
        n.vy += (cy - n.y) * BOUNDARY_ATTRACTION_STRENGTH * alpha;
      });
    });
  };
}

// Keeps unrelated nodes outside boundary rectangles. This also separates two
// boundaries because every member of the other boundary is treated as foreign.
function createBoundaryHullForce(state, boundaries, nodes) {
  return function force(alpha) {
    boundaries.forEach((boundary) => {
      const bounds = getBoundaryBounds(state, boundary);
      if (!bounds) return;
      const members = new Set(boundary.members);
      nodes.forEach((name) => {
        if (members.has(name)) return;
        const n = state.positions.get(name);
        if (!n) return;
        const radius = state.nodeRadii.get(name) ?? MIN_NODE_RADIUS;
        const left = bounds.left - radius - BOUNDARY_REPULSION_PADDING;
        const right = bounds.right + radius + BOUNDARY_REPULSION_PADDING;
        const top = bounds.top - radius - BOUNDARY_REPULSION_PADDING;
        const bottom = bounds.bottom + radius + BOUNDARY_REPULSION_PADDING;
        if (n.x < left || n.x > right || n.y < top || n.y > bottom) return;

        const distances = [
          { distance: n.x - left, x: -1, y: 0 },
          { distance: right - n.x, x: 1, y: 0 },
          { distance: n.y - top, x: 0, y: -1 },
          { distance: bottom - n.y, x: 0, y: 1 },
        ];
        const nearest = distances.reduce((best, current) => (
          current.distance < best.distance ? current : best
        ));
        const push = (nearest.distance + 1) * BOUNDARY_REPULSION_STRENGTH * alpha;
        n.vx += nearest.x * push;
        n.vy += nearest.y * push;
      });
    });
  };
}

// Creates a fresh, stopped d3-force simulation with no nodes/forces yet.
// Callers must follow up with updateSimulationForces() before starting it.
// Kept separate from that function so engine.js can attach its "tick"
// listener exactly once, right after creation, without depending on the
// graph-specific force configuration.
export function createSimulation() {
  return forceSimulation([])
    .alphaDecay(ALPHA_DECAY)
    .alphaMin(ALPHA_MIN)
    .velocityDecay(VELOCITY_DECAY)
    .stop(); // engine.js drives ticking explicitly when the Physics layout mode is active
}

// Reconfigures an existing simulation's nodes and forces to match the current
// graph. Safe to call every time the graph text changes; d3 preserves each
// retained node object's x/y/vx/vy (only brand-new ones, seeded by
// layoutNodes, start from their spawn position). `chargeStrength` lets the
// caller override the default repulsion (e.g. from the UI slider); it should
// be a negative number (more negative = stronger repulsion).
export function updateSimulationForces(state, nodes, edges, boundaries, width, height, chargeStrength = CHARGE_STRENGTH) {
  const nodeObjects = nodes.map((name) => state.positions.get(name)).filter(Boolean);
  // Self-loops aren't part of the physical spring layout (they're drawn as a
  // fixed loop above the node), so they're excluded from the link force.
  const linkObjects = edges
    .filter((edge) => edge.from !== edge.to)
    .map((edge) => ({ source: edge.from, target: edge.to }));

  // Node array must be set before (re)attaching forces below: d3 initializes
  // a force against whatever node array is current at the moment it's attached.
  state.simulation.nodes(nodeObjects);
  state.simulation
    .force("charge", forceManyBody().strength(chargeStrength).distanceMax(CHARGE_DISTANCE_MAX))
    .force("link", forceLink(linkObjects).id((d) => d.id).distance(SPRING_LENGTH).strength(LINK_STRENGTH))
    // Per-node pull toward the canvas center (not forceCenter, which only
    // recenters the *average* position and lets individual nodes drift to
    // the border under strong repulsion — see CENTER_STRENGTH in config.js).
    .force("x", forceX(width / 2).strength(CENTER_STRENGTH))
    .force("y", forceY(height / 2).strength(CENTER_STRENGTH))
    .force("collide", forceCollide((d) => (state.nodeRadii.get(d.id) ?? MIN_NODE_RADIUS) + COLLIDE_PADDING))
    .force("boundaryCluster", createBoundaryClusterForce(state, boundaries))
    .force("boundaryHull", createBoundaryHullForce(state, boundaries, nodes));
}
