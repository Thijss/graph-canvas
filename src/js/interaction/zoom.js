import { MIN_ZOOM, MAX_ZOOM } from "../config.js";

// Pure zoom-math helpers, kept independent of the DOM: callers pass in the
// current view + wheel event data and get back a new view to apply
// themselves (see main.js), the same pattern used by simulation.js.

// Computes the next { scale, x, y } view after a wheel delta, keeping
// the point currently under the cursor visually fixed (so zooming feels
// anchored to the pointer instead of jumping to re-center on each step).
// `cursor` is the pointer's position in screen px relative to the graph
// element's top-left.
export function computeZoomedView(view, deltaY, cursor) {
  const zoomFactor = Math.exp(-deltaY * 0.01);
  const scale = Math.min(Math.max(view.scale * zoomFactor, MIN_ZOOM), MAX_ZOOM);
  if (scale === view.scale) return view;

  const nodeSpaceX = view.x + cursor.x / view.scale;
  const nodeSpaceY = view.y + cursor.y / view.scale;
  return {
    scale,
    x: nodeSpaceX - cursor.x / scale,
    y: nodeSpaceY - cursor.y / scale,
  };
}

// Builds the SVG viewBox string for a given view + the element's on-screen size.
export function viewBoxString(view, bounds) {
  return `${view.x} ${view.y} ${bounds.width / view.scale} ${bounds.height / view.scale}`;
}

// Converts a screen-space point (relative to the graph element's top-left)
// into the same node-coordinate space used by the physics simulation,
// accounting for the current pan/zoom.
export function screenToNodeSpace(view, point) {
  return {
    x: view.x + point.x / view.scale,
    y: view.y + point.y / view.scale,
  };
}
