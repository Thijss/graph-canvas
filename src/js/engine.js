import { graph, repulsionSlider, edgeEditor, stationEditor } from "./dom.js";
import { state } from "./state.js";
import { parseGraph, parseStations } from "./parser.js";
import { layoutNodes, layoutTopDown, createSimulation, updateSimulationForces, clampToBounds } from "./simulation.js";
import { render } from "./renderer.js";

// This is the only module that wires the mutable app `state` to the pure
// parsing/simulation/rendering modules — those stay decoupled and only ever
// receive what they need as explicit parameters, instead of reaching for
// singletons or each other.
const handlers = { onNodeActivity: (heat) => restartSimulation(heat) };

// The most recently parsed graph and canvas size, kept so the simulation's
// "tick" callback (registered once, in draw() below) always clamps/renders
// against up-to-date edges/nodes/stations/dimensions without needing to
// re-parse the textareas or re-measure the canvas on every animation frame.
let currentGraph = { edges: [], nodes: [], stations: [] };
let currentSize = { width: 800, height: 520 };

function readGraph() {
  const { edges, nodes } = parseGraph(edgeEditor.value);
  const stations = parseStations(stationEditor.value, nodes);
  return { edges, nodes, stations };
}

// Re-parses the textareas, seeds any new nodes, and reconfigures the physics
// simulation's forces to match. Renders once immediately (covers the
// physics-off case, and gives instant feedback before any tick fires).
export function draw() {
  const { edges, nodes, stations } = readGraph();
  const { width, height } = graph.getBoundingClientRect();
  const w = width || 800;
  const h = height || 520;

  layoutNodes(state, nodes, w, h);
  if (state.layoutMode === "hierarchy") layoutTopDown(state, nodes, edges, w, h, state.dagLevelSpacing);

  if (!state.simulation) {
    state.simulation = createSimulation();
    // Registered once: every subsequent tick re-clamps/re-renders using
    // whatever the latest parsed graph and canvas size are, not a stale
    // snapshot from simulation creation time.
    state.simulation.on("tick", () => {
      clampToBounds(state, currentGraph.nodes, currentSize.width, currentSize.height, state.view);
      render(state, currentGraph.edges, currentGraph.nodes, currentGraph.stations, handlers);
    });
  }
  updateSimulationForces(state, nodes, edges, stations, w, h, -Number(repulsionSlider.value));

  currentGraph = { edges, nodes, stations };
  currentSize = { width: w, height: h };
  clampToBounds(state, nodes, w, h, state.view);
  render(state, edges, nodes, stations, handlers);
}

// Reheats the simulation (e.g. after nodes/edges change) so gravity animates
// again. Reflects the current graph text first via draw(), then either
// resumes or halts d3's own internal timer depending on the physics toggle.
export function restartSimulation(heat = 1) {
  draw();
  if (state.layoutMode === "physics") {
    state.simulation.alpha(Math.max(state.simulation.alpha(), heat, 0.8)).restart();
  } else {
    state.simulation.stop();
  }
}
