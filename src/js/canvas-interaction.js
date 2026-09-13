import { MIN_NODE_RADIUS } from "./config.js";
import { draw, restartSimulation } from "./engine.js";
import { updateBorderBump, clearBorderBump } from "./renderer.js";
import { computeZoomedView, viewBoxString, screenToNodeSpace } from "./zoom.js";

export function setupCanvasInteraction({
  graph,
  graphWrap,
  fullscreenButton,
  zoomInButton,
  zoomOutButton,
  state,
}) {
  const applyViewBox = () => {
    graph.setAttribute("viewBox", viewBoxString(state.view, graph.getBoundingClientRect()));
  };
  const zoomFromCenter = (deltaY) => {
    const bounds = graph.getBoundingClientRect();
    state.view = computeZoomedView(state.view, deltaY, {
      x: bounds.width / 2,
      y: bounds.height / 2,
    });
    applyViewBox();
  };

  graph.addEventListener("wheel", (event) => {
    if (!event.ctrlKey) return;

    event.preventDefault();
    const bounds = graph.getBoundingClientRect();
    state.view = computeZoomedView(state.view, event.deltaY, {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
    applyViewBox();
  }, { passive: false });

  graph.addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-node]")) return;
    state.panning = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY };
    graphWrap.classList.add("panning");
  });

  window.addEventListener("pointermove", (event) => {
    if (state.panning && event.pointerId === state.panning.pointerId) {
      const dx = event.clientX - state.panning.lastX;
      const dy = event.clientY - state.panning.lastY;
      state.panning.lastX = event.clientX;
      state.panning.lastY = event.clientY;
      state.view = {
        ...state.view,
        x: state.view.x - dx / state.view.scale,
        y: state.view.y - dy / state.view.scale,
      };
      applyViewBox();
      return;
    }
    if (!state.dragging) return;
    const bounds = graph.getBoundingClientRect();
    const radius = state.nodeRadii.get(state.dragging.name) ?? MIN_NODE_RADIUS;
    const cursor = screenToNodeSpace(state.view, { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    const viewWidth = bounds.width / state.view.scale;
    const viewHeight = bounds.height / state.view.scale;
    const x = Math.min(Math.max(cursor.x, state.view.x + radius), state.view.x + viewWidth - radius);
    const y = Math.min(Math.max(cursor.y, state.view.y + radius), state.view.y + viewHeight - radius);
    const node = state.positions.get(state.dragging.name);
    if (node) {
      node.x = x;
      node.y = y;
      node.fx = x;
      node.fy = y;
    }
    updateBorderBump(x, y, radius, {
      left: state.view.x,
      right: state.view.x + viewWidth,
      top: state.view.y,
      bottom: state.view.y + viewHeight,
    });
    if (state.layoutMode === "physics") {
      state.simulation?.alpha(Math.max(state.simulation.alpha(), 0.3)).restart();
    } else {
      draw();
    }
  });

  window.addEventListener("pointerup", () => {
    if (state.panning) {
      state.panning = null;
      graphWrap.classList.remove("panning");
    }
    if (!state.dragging) return;
    const node = state.positions.get(state.dragging.name);
    if (node && !state.pinnedNodes.has(state.dragging.name)) {
      node.fx = null;
      node.fy = null;
    }
    state.dragging = null;
    clearBorderBump();
    restartSimulation(0.3);
  });

  window.addEventListener("resize", () => {
    applyViewBox();
    restartSimulation(0.5);
  });
  fullscreenButton.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else graphWrap.requestFullscreen?.();
  });
  zoomInButton.addEventListener("click", () => zoomFromCenter(-30));
  zoomOutButton.addEventListener("click", () => zoomFromCenter(30));
  document.addEventListener("fullscreenchange", () => {
    const isFullscreen = document.fullscreenElement === graphWrap;
    fullscreenButton.textContent = isFullscreen ? "⤦" : "⛶";
    fullscreenButton.setAttribute("aria-label", isFullscreen ? "Exit fullscreen" : "Toggle fullscreen");
    applyViewBox();
    restartSimulation(0.4);
  });

  applyViewBox();
}
