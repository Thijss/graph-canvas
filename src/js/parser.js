import { STATION_TYPE_PATTERN } from "./config.js";

// Parses raw edge-list text: lines with 2+ values are edges, a lone value is a
// standalone/floating node with no connections. Pure function — callers pass
// in the raw text, so this module has no dependency on the DOM.
export function parseGraph(text) {
  const edges = [];
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
      nodeSet.add(from);
      return;
    }
    const edge = { from, to, label: rest ? rest.trim() : undefined, line: lineIndex };
    edges.push(edge);
    nodeSet.add(edge.from);
    nodeSet.add(edge.to);
  });
  return { edges, nodes: [...nodeSet] };
}

// Parses raw station-group text. Each line: TYPE node,node,... [name] — TYPE is
// the first token (a word containing letters, digits, hyphens, or underscores),
// the second token is the comma-separated member list (no spaces inside it),
// and anything after it is the optional station name. Member ids not present in
// `existingNodes` are dropped. Every input line remains a separate station,
// even when multiple lines use the same type. A node can belong to at most one
// station; if it's referenced by more than one line, the last line wins. Pure
// function — no DOM dependency, same rationale as parseGraph.
export function parseStations(text, existingNodes) {
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
