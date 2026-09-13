import { EDGE_COLORS, STATION_TYPE_PATTERN } from "./config.js";

const EDGE_COLOR_TOKENS = EDGE_COLORS.map(({ token }) => token);

// Parses one edge's optional comma-separated labels into the normalized fields
// used by the visual editor. Every edge has a primary color: unstyled edges
// and conflicting colors use `line`; other labels remain additional data.
function normalizeEdgeLabels(label) {
  const labels = (label ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const edgeColors = labels.filter((part) => EDGE_COLOR_TOKENS.includes(part.toLowerCase()));
  const color = edgeColors.length === 1 ? edgeColors[0].toLowerCase() : "line";
  const open = labels.some((part) => part.toLowerCase() === "open");
  const additionalLabels = edgeColors.length === 1
    ? labels.filter((part) => part.toLowerCase() !== color && part.toLowerCase() !== "open")
    : labels.filter((part) => part.toLowerCase() !== "open");
  return {
    color,
    open,
    labels: additionalLabels,
    label: labels.length ? labels.join(",") : undefined,
  };
}

// Parses raw edge-list text into normalized edge records. Lines with 2+ values
// are edges, while a lone value is a standalone/floating node. Pure function —
// callers pass in the raw text, so this module has no dependency on the DOM.
export function parseEdgeText(text) {
  const edges = [];
  const floatingNodes = [];
  const nodeSet = new Set();
  text.split(/\r?\n/).forEach((line, lineIndex) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    // Only "from" and "to" are single whitespace-delimited tokens; everything
    // after that is the raw label, so it may freely contain spaces/commas
    // (e.g. "transformer, open").
    const match = trimmed.match(/^(\S+)(?:\s+(\S+)(?:\s+([\s\S]*))?)?$/);
    const [, from, to, rest] = match;
    if (!to) {
      floatingNodes.push({ from, to: "", color: "line", open: false, labels: [], line: lineIndex });
      nodeSet.add(from);
      return;
    }
    const normalizedLabels = normalizeEdgeLabels(rest);
    const edge = {
      from,
      to,
      ...normalizedLabels,
      line: lineIndex,
    };
    edges.push(edge);
    nodeSet.add(edge.from);
    nodeSet.add(edge.to);
  });
  return { edges, floatingNodes, nodes: [...nodeSet] };
}

// Serializes normalized edge records using explicit primary colors in the TXT
// edge syntax. Additional labels are emitted after the selected color.
export function serializeEdges(edges) {
  return edges
    .map(({ from, to, color, open = false, labels = [], label }) => {
      if (!to) return from;
      const serializedLabels = [color, open ? "open" : undefined, ...labels].filter(Boolean);
      const fallbackLabel = serializedLabels.length ? serializedLabels.join(",") : label;
      return [from, to, fallbackLabel].filter(Boolean).join(" ");
    })
    .join("\n");
}

// Backwards-compatible graph parser used by the renderer and simulation.
export function parseGraph(text) {
  return parseEdgeText(text);
}

// Parses raw station-group text into normalized station records. Each line:
// TYPE node,node,... [name] — TYPE is the first token (a word containing
// letters, digits, hyphens, or underscores), the second token is the
// comma-separated member list, and anything after it is the optional station
// name. Member ids not present in `existingNodes` are dropped. Every input line
// remains a separate station, even when multiple lines use the same type. A
// node can belong to at most one station; if it's referenced by more than one
// line, the last line wins.
export function parseStationText(text, existingNodes) {
  const nodeSet = new Set(existingNodes);
  const stations = [];
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const tokens = trimmed.split(/\s+/);
    const typeToken = tokens[0];
    if (!STATION_TYPE_PATTERN.test(typeToken) || tokens.length < 2) return;
    const type = typeToken.toUpperCase();
    const members = tokens[1]
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id && nodeSet.has(id));
    if (!members.length) return;
    const nameTokens = tokens.slice(2);
    const name = nameTokens.length ? nameTokens.join(" ") : "";
    stations.push({ type, name, members });
  });
  // Enforce single membership: later lines win over earlier ones for the same node.
  const ownerIndex = new Map();
  stations.forEach((station, index) => {
    station.members.forEach((member) => ownerIndex.set(member, index));
  });
  stations.forEach((station, index) => {
    station.members = station.members.filter((member) => ownerIndex.get(member) === index);
  });
  return stations.filter((station) => station.members.length);
}

// Backwards-compatible station parser used by the renderer and simulation.
export function parseStations(text, existingNodes) {
  return parseStationText(text, existingNodes);
}

// Serializes normalized station records using the existing TXT syntax.
export function serializeStations(stations) {
  return stations
    .map(({ type, members = [], name = "" }) => [type, members.join(","), name.trim()].filter(Boolean).join(" "))
    .join("\n");
}

// Parses route text. Each line is LABEL node,node,...; every line remains a
// separate route, and nodes not present in `existingNodes` are dropped.
export function parseRoutes(text, existingNodes) {
  const nodeSet = new Set(existingNodes);
  const routes = [];
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const tokens = trimmed.split(/\s+/);
    if (tokens.length < 2) return;
    const nodes = tokens[1]
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id && nodeSet.has(id));
    if (!nodes.length) return;
    routes.push({ label: tokens[0], nodes });
  });
  return routes;
}
