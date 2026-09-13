// Mutable simulation/UI state shared across modules. Kept as properties on a
// single object so other modules can mutate fields without needing to
// reassign live bindings across module boundaries.
export const state = {
  // name -> live d3-force node object { id, x, y, vx, vy, fx, fy }. d3 mutates
  // these objects in place every tick, so any module holding a reference
  // automatically sees the latest position — no separate velocities map is
  // needed since vx/vy live directly on the node object.
  positions: new Map(),
  dragging: null, // { name, pointerId } while a node is being dragged
  panning: null, // { pointerId, lastX, lastY } while the empty canvas is being dragged to pan
  pinnedNodes: new Set(), // nodes frozen in place via double-click, exempt from physics (node.fx/fy set)
  lastNodeClick: { name: null, time: 0 }, // manual double-click detection (see pointerdown)
  nodeRadii: new Map(),
  simulation: null, // the persistent d3 forceSimulation instance, created lazily by engine.js
  layoutMode: "physics",
  dagLevelSpacing: 120,
  showBoundaryHulls: true,
  showGroups: true,
  view: { scale: 1, x: 0, y: 0 }, // pan/zoom applied via the graph SVG's viewBox (see js/zoom.js); x/y are the viewBox origin in node-coordinate space
};
