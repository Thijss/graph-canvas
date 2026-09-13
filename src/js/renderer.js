import {
  graph,
  graphWrap,
  emptyState,
  edgeEditor,
  edgeErrors,
  stationMetaCount,
  nodeCount,
  edgeCount,
  statusText,
  statusDot,
  directedToggle,
} from "./dom.js";
import { getRouteColor, getStationTypeColor, KEYWORD_STYLES, LINE_EDGE_COLOR, MIN_NODE_RADIUS, STATION_FILL_OPACITY } from "./config.js";
import { getNodeRadius, getStationBounds } from "./simulation.js";

let currentConflictingEdges = [];
const PARALLEL_EDGE_SPACING = 12;

function hasConflictingLabels(edge) {
  const labels = new Set((edge.label ?? "").split(",").map((part) => part.trim().toLowerCase()));
  return ["link", "transformer", "x"].filter((keyword) => labels.has(keyword)).length > 1;
}

// `state` (positions/pinned nodes/etc.) and `handlers` (interaction callbacks,
// e.g. { onNodeActivity }) are passed in explicitly by the caller (engine.js)
// instead of being imported here. This keeps rendering decoupled from both
// the concrete state store and the simulation-restart logic, so this module
// has no dependency on engine.js and no circular import.
export function render(state, edges, nodes, stations, routes, handlers) {
  graph.replaceChildren();
  state.nodeRadii = new Map(nodes.map((name) => [name, getNodeRadius(name)]));
  edgeCount.textContent = edges.length;
  stationMetaCount.textContent = stations.length;
  nodeCount.textContent = nodes.length;
  emptyState.hidden = nodes.length > 0;
  const conflictingEdges = edges.filter(hasConflictingLabels);
  currentConflictingEdges = conflictingEdges;
  const hasConflictingLabelError = conflictingEdges.length > 0;
  statusDot.classList.toggle("status-error", hasConflictingLabelError);
  updateEdgeErrors(conflictingEdges);
  if (hasConflictingLabelError) {
    statusText.replaceChildren(
      "Error: combine only one of ",
      createBoldStatusPart("link"),
      ", ",
      createBoldStatusPart("transformer"),
      ", or ",
      createBoldStatusPart("x"),
      " per edge",
    );
  } else {
    statusText.textContent = nodes.length ? "No issues" : "Ready to draw";
  }
  if (!nodes.length) return;

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const markerFor = (id, color) =>
    `<marker id="arrowhead-${id}" markerWidth="4" markerHeight="4" refX="3.5" refY="1.75" orient="auto"><path d="M0,0 L4,1.75 L0,3.5 z" fill="${color}"></path></marker>`;
  defs.innerHTML = [
    markerFor("line", LINE_EDGE_COLOR),
    ...KEYWORD_STYLES.map((style) => markerFor(style.className, style.color)),
  ].join("");
  graph.append(defs);
  const stationNodeColors = new Map();
  const routeNodeColors = new Map();
  const stationTypeColors = new Map();
  stations.forEach((station) => {
    if (!stationTypeColors.has(station.type)) {
      stationTypeColors.set(station.type, getStationTypeColor(station.type, stationTypeColors.size));
    }
    const color = stationTypeColors.get(station.type);
    station.members.forEach((member) => stationNodeColors.set(member, color));
    if (state.showStationHulls) drawStationHull(state, station, color);
  });
  if (state.showRoutes) {
    const routeColors = new Map();
    routes.forEach((route) => {
      if (!routeColors.has(route.label)) routeColors.set(route.label, getRouteColor(routeColors.size));
      const color = routeColors.get(route.label);
      route.nodes.forEach((member) => routeNodeColors.set(member, color));
    });
  }
  const drawableEdges = edges.filter((edge) => !hasConflictingLabels(edge));
  const parallelOffsets = getParallelOffsets(drawableEdges);
  drawableEdges.forEach((edge) => drawEdge(state, edge, parallelOffsets.get(edge)));
  nodes.forEach((name) => drawNode(state, name, handlers, stationNodeColors, routeNodeColors));
}

function createBoldStatusPart(text) {
  const part = document.createElement("strong");
  part.textContent = text;
  return part;
}

export function updateEdgeErrors(conflictingEdges = currentConflictingEdges) {
  edgeErrors.replaceChildren();
  const lineHeight = parseFloat(getComputedStyle(edgeEditor).lineHeight);
  const paddingTop = parseFloat(getComputedStyle(edgeEditor).paddingTop);
  edgeErrors.style.transform = `translateY(${-edgeEditor.scrollTop}px)`;
  conflictingEdges.forEach((edge) => {
    const line = document.createElement("span");
    line.className = "editor-error-line";
    line.style.top = `${paddingTop + edge.line * lineHeight + lineHeight / 2}px`;
    edgeErrors.append(line);

    const marker = document.createElement("span");
    marker.className = "editor-error";
    marker.setAttribute("aria-label", "Invalid label combination");
    marker.title = "Only one of link, transformer, or x may be used per edge";
    marker.textContent = "×";
    marker.style.top = `${paddingTop + edge.line * lineHeight}px`;
    edgeErrors.append(marker);
  });
}

// Draws one station's rectangular group boundary and its name label.
function drawStationHull(state, station, color) {
  const bounds = getStationBounds(state, station);
  if (!bounds) return;

  const rectangle = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rectangle.classList.add("station-hull");
  rectangle.setAttribute("x", bounds.left);
  rectangle.setAttribute("y", bounds.top);
  rectangle.setAttribute("width", bounds.right - bounds.left);
  rectangle.setAttribute("height", bounds.bottom - bounds.top);
  rectangle.setAttribute("fill", color);
  rectangle.setAttribute("stroke", color);
  graph.append(rectangle);

  if (station.name) {
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.classList.add("station-label");
    label.setAttribute("x", (bounds.left + bounds.right) / 2);
    label.setAttribute("y", bounds.top - 8);
    label.setAttribute("fill", color);
    label.textContent = station.name;
    graph.append(label);
  }
}

function getParallelOffsets(edges) {
  const groups = new Map();
  edges.forEach((edge) => {
    const key = JSON.stringify([edge.from, edge.to]);
    const group = groups.get(key) ?? [];
    group.push(edge);
    groups.set(key, group);
  });

  const offsets = new Map();
  groups.forEach((group) => {
    const center = (group.length - 1) / 2;
    group.forEach((edge, index) => {
      offsets.set(edge, (index - center) * PARALLEL_EDGE_SPACING);
    });
  });
  return offsets;
}

function drawEdge(state, edge, parallelOffset = 0) {
  const start = state.positions.get(edge.from);
  const end = state.positions.get(edge.to);
  const startRadius = state.nodeRadii.get(edge.from) ?? MIN_NODE_RADIUS;
  const endRadius = state.nodeRadii.get(edge.to) ?? MIN_NODE_RADIUS;
  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  line.classList.add("edge-line");

  // Labels are comma-separated; each part can be plain text or a special keyword.
  const parts = (edge.label ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  let colorKey = "line";
  const visibleParts = parts.filter((part) => {
    if (/^line$/i.test(part)) return false;
    if (/open/i.test(part)) { line.classList.add("open"); return false; }
    const match = KEYWORD_STYLES.find((style) => new RegExp(style.keyword, "i").test(part));
    if (match) {
      line.classList.add(match.className);
      colorKey = match.className; // last match wins, mirroring CSS cascade order
      return false;
    }
    return true;
  });
  const displayLabel = visibleParts.join(", ");
  if (edge.from === edge.to) {
    line.classList.add("self");
    const scale = startRadius / MIN_NODE_RADIUS;
    line.setAttribute("d", `M ${start.x - 5 * scale} ${start.y - startRadius + 1} C ${start.x - 52 * scale + parallelOffset} ${start.y - 72 * scale}, ${start.x + 52 * scale + parallelOffset} ${start.y - 72 * scale}, ${start.x + 5 * scale} ${start.y - startRadius + 1}`);
  } else {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const directionX = dx / length;
    const directionY = dy / length;
    const perpendicularX = -directionY;
    const perpendicularY = directionX;
    const endpointOffset = Math.max(
      -Math.min(startRadius, endRadius) + 2,
      Math.min(parallelOffset, Math.min(startRadius, endRadius) - 2),
    );
    const startAlong = Math.sqrt(Math.max(0, (startRadius + 1) ** 2 - endpointOffset ** 2));
    const endAlong = Math.sqrt(Math.max(0, (endRadius + 1) ** 2 - endpointOffset ** 2));
    const x1 = start.x + directionX * startAlong + perpendicularX * endpointOffset;
    const y1 = start.y + directionY * startAlong + perpendicularY * endpointOffset;
    const x2 = end.x - directionX * endAlong + perpendicularX * endpointOffset;
    const y2 = end.y - directionY * endAlong + perpendicularY * endpointOffset;
    const offsetX = perpendicularX * parallelOffset;
    const offsetY = perpendicularY * parallelOffset;
    const midpointX = (x1 + x2) / 2;
    const midpointY = (y1 + y2) / 2;
    line.setAttribute("d", `M ${x1} ${y1} Q ${midpointX + offsetX * 2} ${midpointY + offsetY * 2} ${x2} ${y2}`);
  }
  if (directedToggle.checked && edge.from !== edge.to) line.setAttribute("marker-end", `url(#arrowhead-${colorKey})`);
  graph.append(line);

  if (displayLabel) {
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    let x = edge.from === edge.to ? start.x + parallelOffset : (start.x + end.x) / 2;
    let y = edge.from === edge.to ? start.y - 62 * (startRadius / MIN_NODE_RADIUS) : (start.y + end.y) / 2 - 7;
    if (edge.from !== edge.to) {
      const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
      x += -(end.y - start.y) / length * parallelOffset;
      y += (end.x - start.x) / length * parallelOffset;
    }
    label.classList.add("edge-label");
    label.setAttribute("x", x);
    label.setAttribute("y", y);
    label.textContent = displayLabel;
    graph.append(label);
  }
}

function drawNode(state, name, handlers, stationNodeColors, routeNodeColors) {
  const point = state.positions.get(name);
  const radius = state.nodeRadii.get(name) ?? MIN_NODE_RADIUS;
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.dataset.node = name;
  const stationColor = stationNodeColors.get(name);
  const nodeColor = routeNodeColors.get(name);
  const shape = document.createElementNS("http://www.w3.org/2000/svg", stationColor ? "rect" : "circle");
  shape.classList.add("node-circle");
  if (stationColor) shape.classList.add("node-square");
  if (state.pinnedNodes.has(name)) shape.classList.add("pinned");
  if (nodeColor) {
    shape.style.fill = nodeColor;
    shape.style.fillOpacity = routeNodeColors.has(name) ? "0.8" : STATION_FILL_OPACITY;
  }
  if (stationColor) {
    shape.setAttribute("x", point.x - radius);
    shape.setAttribute("y", point.y - radius);
    shape.setAttribute("width", radius * 2);
    shape.setAttribute("height", radius * 2);
  } else {
    shape.setAttribute("cx", point.x);
    shape.setAttribute("cy", point.y);
    shape.setAttribute("r", radius);
  }
  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.classList.add("node-label");
  label.setAttribute("x", point.x);
  label.setAttribute("y", point.y);
  label.textContent = name;
  group.append(shape, label);
  group.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    // preventDefault above suppresses native click/dblclick synthesis, so detect
    // double-clicks manually from consecutive pointerdown timestamps instead.
    const now = performance.now();
    const isDoubleClick = state.lastNodeClick.name === name && now - state.lastNodeClick.time < 350;
    state.lastNodeClick = { name: isDoubleClick ? null : name, time: now };
    if (isDoubleClick) {
      const node = state.positions.get(name);
      if (state.pinnedNodes.has(name)) {
        state.pinnedNodes.delete(name);
        if (node) { node.fx = null; node.fy = null; } // release back to physics control
      } else {
        state.pinnedNodes.add(name);
        if (node) {
          node.fx = node.x; // d3's fixed-position convention: freezes the node in place
          node.fy = node.y;
          node.vx = 0;
          node.vy = 0;
        }
      }
      handlers.onNodeActivity(0.3);
      return;
    }
    state.dragging = { name, pointerId: event.pointerId };
    const node = state.positions.get(name);
    if (node) { node.vx = 0; node.vy = 0; }
    handlers.onNodeActivity(0.4); // let neighboring nodes react while dragging
  });
  graph.append(group);
}

// Lights up the graph border on whichever side(s) a dragged node is currently pressed against.
export function updateBorderBump(x, y, radius, bounds) {
  const touchLeft = x <= bounds.left + radius + 0.5;
  const touchRight = x >= bounds.right - radius - 0.5;
  const touchTop = y <= bounds.top + radius + 0.5;
  const touchBottom = y >= bounds.bottom - radius - 0.5;
  const shadows = [];
  if (touchTop) shadows.push("inset 0 6px 0 -1px var(--orange)");
  if (touchBottom) shadows.push("inset 0 -6px 0 -1px var(--orange)");
  if (touchLeft) shadows.push("inset 6px 0 0 -1px var(--orange)");
  if (touchRight) shadows.push("inset -6px 0 0 -1px var(--orange)");
  graphWrap.style.boxShadow = shadows.join(", ");
}

export function clearBorderBump() {
  graphWrap.style.boxShadow = "";
}
