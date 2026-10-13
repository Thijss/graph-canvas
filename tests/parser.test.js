import { describe, expect, it } from "vitest";
import {
  normalizeTxtImportEdgeAliases,
  normalizeTxtImportStringList,
  parseBoundaryText,
  parseEdgeText,
  parseGroups,
  serializeBoundaries,
  serializeEdges,
  serializeGroups,
} from "../src/js/graph/parser.js";

describe("normalizeTxtImportStringList", () => {
  it("converts comma-separated strings across lines into graph text", () => {
    expect(normalizeTxtImportStringList('"1 2", "3 4 open",\n"3 5 blue"'))
      .toBe("1 2\n3 4 open\n3 5 blue");
  });

  it("allows surrounding whitespace and a trailing comma", () => {
    expect(normalizeTxtImportStringList(' \r\n"1 2",\r\n"3 4", \r\n'))
      .toBe("1 2\n3 4");
    expect(normalizeTxtImportStringList('"1 2",')).toBe("1 2");
  });

  it("preserves commas inside edge options and decodes escaped endpoints", () => {
    expect(normalizeTxtImportStringList(
      '"\\"Node A\\" \\"Node B\\" blue,dotted,backup", "C D open"',
    )).toBe('"Node A" "Node B" blue,dotted,backup\nC D open');
  });

  it("leaves ordinary TXT and quoted node names unchanged", () => {
    const text = '"Node A" "Node B" blue,dotted\n"Standalone node"\nA B open';
    expect(normalizeTxtImportStringList(text)).toBe(text);
    expect(normalizeTxtImportStringList('"Standalone node"')).toBe('"Standalone node"');
    expect(normalizeTxtImportStringList("A B\nC D")).toBe("A B\nC D");
  });

  it("ignores full-line and inline comments in a string list", () => {
    expect(normalizeTxtImportStringList([
      "# this is a comment, hello!",
      '"S10 20 4,transformer", #asdasd',
      '  "20 30 5,transformer", "30 40 6,transformer" # last edge',
    ].join("\n"))).toBe(
      "S10 20 4,transformer\n20 30 5,transformer\n30 40 6,transformer",
    );
  });

  it("ignores comments in ordinary TXT while preserving hashes in quoted nodes", () => {
    expect(normalizeTxtImportStringList(
      '# Heading\r\n"Node #1" B open # comment\r\nB C link # another',
    )).toBe('\r\n"Node #1" B open \r\nB C link ');
  });

  it("preserves hashes and escaped quotes inside list entries", () => {
    expect(normalizeTxtImportStringList(
      '"\\"Node #1\\" B blue,label #1", "B C label \\"#2\\"" # comment',
    )).toBe('"Node #1" B blue,label #1\nB C label "#2"');
  });

  it("allows a trailing comma before a comment", () => {
    expect(normalizeTxtImportStringList('"A B", "C D", # done'))
      .toBe("A B\nC D");
  });

  it("treats comment-only input as empty text, including commas in comments", () => {
    expect(normalizeTxtImportStringList("# this is a comment, hello!")).toBe("");
  });

  it("rejects malformed lists instead of importing them as graph text", () => {
    expect(() => normalizeTxtImportStringList('"A B", "C D'))
      .toThrow(SyntaxError);
    expect(() => normalizeTxtImportStringList('"A B",, "C D"'))
      .toThrow(SyntaxError);
  });

  it("rejects non-string entries", () => {
    for (const entry of ["42", "null", "{}", '["C D"]']) {
      expect(() => normalizeTxtImportStringList(`"A B", ${entry}`))
        .toThrow("Import list must contain only strings.");
    }
  });
});

describe("normalizeTxtImportEdgeAliases", () => {
  it("maps PGM edge labels without changing node names", () => {
    expect(normalizeTxtImportEdgeAliases(
      "A B open\nC D transformer\nE F link\nopen transformer link",
    )).toBe("A B dashed\nC D blue\nE F green\nopen transformer green");
  });

  it("maps aliases in comma-separated labels case-insensitively", () => {
    expect(normalizeTxtImportEdgeAliases("A B OPEN,Transformer,LINK"))
      .toBe("A B dashed,blue,green");
  });

  it("preserves quoted endpoints, standalone nodes, and unrelated labels", () => {
    expect(normalizeTxtImportEdgeAliases(
      '"open transformer" "link node" open, transformer, backup link\nopen\nA B reopened,hyperlink,transformers',
    )).toBe('"open transformer" "link node" dashed, blue, backup link\nopen\nA B reopened,hyperlink,transformers');
  });

  it("parses normalized aliases as edge styles and colors", () => {
    const { edges } = parseEdgeText(normalizeTxtImportEdgeAliases(
      "A B open,transformer,backup\nB C link",
    ));
    expect(edges).toEqual([
      { from: "A", to: "B", color: "blue", style: "dashed", label: "backup", line: 0 },
      { from: "B", to: "C", color: "green", style: "solid", label: "", line: 1 },
    ]);
  });
});

describe("parseEdgeText", () => {
  it("parses edges, labels, and floating nodes", () => {
    expect(parseEdgeText("A B blue, dashed, backup\nC")).toEqual({
      edges: [{
        from: "A",
        to: "B",
        color: "blue",
        style: "dashed",
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

  it("accepts dotted as a legacy alias for dashed", () => {
    expect(parseEdgeText("A B dotted").edges[0].style).toBe("dashed");
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

  it("supports spaces in quoted endpoint names", () => {
    expect(parseEdgeText('"Node A" "Node B" blue,important')).toEqual({
      edges: [{
        from: "Node A",
        to: "Node B",
        color: "blue",
        style: "solid",
        label: "important",
        line: 0,
      }],
      floatingNodes: [],
      nodes: ["Node A", "Node B"],
    });
  });
});

describe("edge and boundary serialization", () => {
  it("serializes normalized edges without implicit defaults", () => {
    expect(serializeEdges([
      { from: "A", to: "B", color: "yellow", style: "solid", label: "" },
      { from: "B", to: "C", color: "red", style: "dashed", label: "important" },
      { from: "D", to: "" },
    ])).toBe("A B\nB C red,dashed,important\nD");
  });

  it("quotes endpoint names containing spaces", () => {
    const edges = [
      { from: "Node A", to: "Node B", color: "yellow", style: "solid", label: "" },
      { from: "Standalone node", to: "" },
    ];
    expect(serializeEdges(edges)).toBe('"Node A" "Node B"\n"Standalone node"');
    expect(parseEdgeText(serializeEdges(edges)).edges).toEqual([
      { from: "Node A", to: "Node B", color: "yellow", style: "solid", label: "", line: 0 },
    ]);
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
