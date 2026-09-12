// Multi-touch gesture handling for the graph canvas.
// This module owns pointer bookkeeping for pinch zooming so main.js can keep
// the canvas setup focused on wiring gestures to the existing view state.
import { computeZoomedView } from "./zoom.js";

export function createPinchZoomController({ graph, graphWrap, state, applyViewBox }) {
  const activePointers = new Map();
  let pinchDistance = null;

  function updatePointer(event) {
    const pointer = activePointers.get(event.pointerId);
    if (pointer) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }
  }

  return {
    pointerDown(event) {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activePointers.size !== 2) return false;

      state.panning = null;
      graphWrap.classList.remove("panning");
      const [first, second] = activePointers.values();
      pinchDistance = Math.hypot(second.x - first.x, second.y - first.y);
      return true;
    },

    pointerMove(event) {
      updatePointer(event);
      if (activePointers.size < 2) return false;

      const [first, second] = activePointers.values();
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      if (pinchDistance && distance > 0) {
        const bounds = graph.getBoundingClientRect();
        const ratio = distance / pinchDistance;
        const deltaY = -Math.log(ratio) / 0.01;
        state.view = computeZoomedView(state.view, deltaY, {
          x: (first.x + second.x) / 2 - bounds.left,
          y: (first.y + second.y) / 2 - bounds.top,
        });
        pinchDistance = distance;
        applyViewBox();
      }
      return true;
    },

    pointerUp(event) {
      activePointers.delete(event.pointerId);
      if (activePointers.size < 2) pinchDistance = null;
    },

    pointerCancel(event) {
      activePointers.delete(event.pointerId);
      if (activePointers.size < 2) pinchDistance = null;
    },
  };
}
