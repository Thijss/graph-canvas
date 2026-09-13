import { describe, expect, it } from "vitest";
import {
  parseBoundaryText,
  parseEdgeText,
  parseGroups,
  serializeBoundaries,
  serializeEdges,
  serializeGroups,
} from "../src/js/graph/parser.js";

describe("parseEdgeText", () => {
  it("parses edges, labels, and floating nodes", () => {
    expect(parseEdgeText("A B blue, dotted, backup\nC")).toEqual({
      edges: [{
        from: "A",
        to: "B",
        color: "blue",
        style: "dotted",
        label: "backup",
        line: 0,
      }],
      floatingNodes: [{
        from: "C",
        to: "",
        color: "yellow",
        style: "solid",
        label: "",
        line: 1,
      }],
      nodes: ["A", "B", "C"],
    });
  });

  it("uses defaults when edge labels are missing or ambiguous", () => {
    expect(parseEdgeText("A B\nB C blue,green")).toEqual({
      edges: [
        { from: "A", to: "B", color: "yellow", style: "solid", label: "", line: 0 },
        { from: "B", to: "C", color: "yellow", style: "solid", label: "blue,green", line: 1 },
      ],
      floatingNodes: [],
      nodes: ["A", "B", "C"],
    });
  });
});

describe("edge and boundary serialization", () => {
  it("serializes normalized edges without implicit defaults", () => {
    expect(serializeEdges([
      { from: "A", to: "B", color: "yellow", style: "solid", label: "" },
      { from: "B", to: "C", color: "red", style: "dotted", label: "important" },
      { from: "D", to: "" },
    ])).toBe("A B\nB C red,dotted,important\nD");
  });

  it("filters boundary members that are not graph nodes", () => {
    expect(parseBoundaryText(
      "team A,B,missing Core team\ninvalid! A\nempty missing",
      ["A", "B"],
    )).toEqual([
      { type: "TEAM", name: "Core team", members: ["A", "B"] },
    ]);
  });

  it("round-trips boundary serialization", () => {
    const boundaries = [
      { type: "TEAM", name: "Core team", members: ["A", "B"] },
      { type: "COLOR-2", name: "", members: ["C"] },
    ];
    expect(parseBoundaryText(serializeBoundaries(boundaries), ["A", "B", "C"]))
      .toEqual(boundaries);
  });
});

describe("group parsing and serialization", () => {
  it("filters unknown members and assigns fallback labels", () => {
    expect(parseGroups("Team A,B,missing\nCustom B,C", ["A", "B", "C"])).toEqual([
      { label: "Team", nodes: ["A", "B"] },
      { label: "Custom", nodes: ["B", "C"] },
    ]);
  });

  it("serializes groups with generated labels when needed", () => {
    expect(serializeGroups([
      { label: "", nodes: ["A", "B"] },
      { label: "People", nodes: ["C"] },
    ])).toBe("A A,B\nPeople C");
  });
});
