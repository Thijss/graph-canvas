import { EDGE_COLORS, BOUNDARY_TYPE_PATTERN } from "../config.js";

const EDGE_COLOR_TOKENS = EDGE_COLORS.map(({ token }) => token);

// Parses one edge's optional comma-separated values into the normalized fields
// used by the visual editor. Yellow and solid are the implicit defaults.
function normalizeEdgeLabels(label) {
  const labels = (label ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const edgeColors = labels.filter((part) => EDGE_COLOR_TOKENS.includes(part.toLowerCase()));
  const styleValues = labels.filter((part) => ["solid", "dotted"].includes(part.toLowerCase()));
  const color = edgeColors.length === 1 ? edgeColors[0].toLowerCase() : "yellow";
  const style = styleValues.length === 1 ? styleValues[0].toLowerCase() : "solid";
  const additionalLabels = labels.filter((part) => (
    part.toLowerCase() !== color
    && !["solid", "dotted"].includes(part.toLowerCase())
  ));
  return {
    color,
    style,
    label: additionalLabels.join(","),
  };
}

function parseEndpoint(token) {
  if (!token.startsWith("\"")) return token;
  try {
    return JSON.parse(token);
  } catch {
    return token;
  }
}

function serializeEndpoint(value) {
  return /[\s"\\]/.test(value) ? JSON.stringify(value) : value;
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
    // after that is the raw label, so it may freely contain spaces/commas.
    // Quoted endpoints may contain spaces (e.g. `"Node A" B`).
    const match = trimmed.match(/^(("(?:\\.|[^"\\])*"|[^\s]+))(?:\s+(("(?:\\.|[^"\\])*"|[^\s]+))(?:\s+([\s\S]*))?)?$/);
    if (!match) return;
    const [, fromToken, , toToken, , rest] = match;
    const from = parseEndpoint(fromToken);
    const to = toToken ? parseEndpoint(toToken) : "";
    if (!to) {
      floatingNodes.push({ from, to: "", color: "yellow", style: "solid", label: "", line: lineIndex });
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
    .map(({ from, to, color = "yellow", style = "solid", label = "" }) => {
      if (!to) return serializeEndpoint(from);
      const serializedLabels = [
        color !== "yellow" ? color : undefined,
        style !== "solid" ? style : undefined,
        ...label.split(",").map((part) => part.trim()).filter(Boolean),
      ].filter(Boolean);
      const fallbackLabel = serializedLabels.length ? serializedLabels.join(",") : label;
      return [serializeEndpoint(from), serializeEndpoint(to), fallbackLabel].filter(Boolean).join(" ");
    })
    .join("\n");
}

// Parses raw boundary text into normalized boundary records. Each line:
// TYPE node,node,... [name] — TYPE is the first token (a word containing
// letters, digits, hyphens, or underscores), the second token is the
// comma-separated member list, and anything after it is the optional boundary
// name. Member ids not present in `existingNodes` are dropped. Every input line
// remains a separate boundary, even when multiple lines use the same type. A
// Nodes may belong to multiple boundaries.
export function parseBoundaryText(text, existingNodes) {
  const nodeSet = new Set(existingNodes);
  const boundaries = [];
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const tokens = trimmed.split(/\s+/);
    const typeToken = tokens[0];
    if (!BOUNDARY_TYPE_PATTERN.test(typeToken) || tokens.length < 2) return;
    const type = typeToken.toUpperCase();
    const members = tokens[1]
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id && nodeSet.has(id));
    if (!members.length) return;
    const nameTokens = tokens.slice(2);
    const name = nameTokens.length ? nameTokens.join(" ") : "";
    boundaries.push({ type, name, members });
  });
  return boundaries.filter((boundary) => boundary.members.length);
}

// Serializes normalized boundary records using the existing TXT syntax.
export function serializeBoundaries(boundaries) {
  return boundaries
    .map(({ type, members = [], name = "" }) => [type, members.join(","), name.trim()].filter(Boolean).join(" "))
    .join("\n");
}

// Parses group text. Each line is LABEL node,node,...; every line remains a
// separate group, and nodes not present in `existingNodes` are dropped.
export function parseGroups(text, existingNodes) {
  const nodeSet = new Set(existingNodes);
  const groups = [];
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
    groups.push({ label: tokens[0], nodes });
  });
  return groups;
}

export function serializeGroups(groups) {
  return groups
    .map(({ label = "", nodes = [] }, index) => [
      label.trim() || (index < 26 ? String.fromCharCode(65 + index) : `GROUP-${index + 1}`),
      nodes.join(","),
    ].join(" "))
    .join("\n");
}
