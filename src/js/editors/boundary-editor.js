import { COLOR_PALETTE, getBoundaryTypeColor, isCanonicalBoundaryColorType } from "../config.js";
import { edgeEditor, boundaryEditor, boundaryEmptyState, boundaryList, boundaryListHeader } from "../dom.js";
import { parseGraph, parseBoundaryText, serializeBoundaries } from "../parser.js";
import { createPopoverPicker } from "./popover-picker.js";

function createField(label, value, className) {
  const wrapper = document.createElement("label");
  wrapper.className = `boundary-field ${className}`;

  const caption = document.createElement("span");
  caption.textContent = label;
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.placeholder = label;
  input.setAttribute("aria-label", label);
  input.autocomplete = "off";
  input.spellcheck = false;
  wrapper.append(caption, input);
  return { wrapper, input };
}

function createNodesField(members, onChange) {
  const wrapper = document.createElement("label");
  wrapper.className = "boundary-field boundary-nodes";

  const caption = document.createElement("span");
  caption.textContent = "Nodes";
  const editor = document.createElement("div");
  editor.className = "boundary-node-editor";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Node ID, then [Enter]";
  input.title = "Type a node ID and press Enter to add it";
  input.setAttribute("aria-label", "Nodes");
  input.autocomplete = "off";
  input.spellcheck = false;
  editor.append(input);
  wrapper.append(caption, editor);

  const values = [...members];
  const renderNodes = (notify = true) => {
    editor.querySelectorAll(".boundary-node-chip").forEach((chip) => chip.remove());
    values.forEach((node) => {
      const chip = document.createElement("span");
      chip.className = "boundary-node-chip";
      chip.textContent = node;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "boundary-node-remove";
      remove.setAttribute("aria-label", `Remove node ${node}`);
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        values.splice(values.indexOf(node), 1);
        renderNodes();
      });
      chip.append(remove);
      editor.insertBefore(chip, input);
    });
    if (notify) onChange();
  };
  const addNode = (value) => {
    const node = value.trim();
    if (!node || values.includes(node)) return;
    values.push(node);
    renderNodes();
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addNode(input.value);
      input.value = "";
    } else if (event.key === "Backspace" && !input.value && values.length) {
      values.pop();
      renderNodes();
    }
  });
  input.addEventListener("input", () => {
    if (!input.value.includes(",")) return;
    input.value.split(",").forEach(addNode);
    input.value = "";
  });
  renderNodes(false);
  return { wrapper, getValues: () => [...values], input };
}

// Builds the boundary color selector: clicking the swatch dot opens a small
// popover of the 10 fixed palette colors as clickable circles. A hidden input
// holds the actual boundary type value used for reading/serializing rows.
// Legacy/custom type words are preserved verbatim until the user picks a
// palette color, so switching to Visual mode never silently discards or
// recolors data from an existing saved graph.
function createColorField(value, previewColor, onChange) {
  const wrapper = document.createElement("div");
  wrapper.className = "boundary-field boundary-type";

  const picker = createPopoverPicker({
    value: value || "COLOR-1",
    controlClass: "boundary-color-control",
    buttonClass: "boundary-color-swatch",
    popoverClass: "boundary-color-popover",
    optionClass: "boundary-color-option",
    options: COLOR_PALETTE.map((color, i) => ({
      value: `COLOR-${i + 1}`,
      ariaLabel: `Color ${i + 1}`,
      setup: (option) => { option.style.background = color; },
    })),
    getButtonLabel: (currentValue) => {
      const currentIsCanonical = isCanonicalBoundaryColorType(currentValue);
      return `Color boundary: ${currentIsCanonical ? `Color ${currentValue.split("-")[1]}` : currentValue}`;
    },
    updateButton: (button, currentValue) => {
      const currentIsCanonical = isCanonicalBoundaryColorType(currentValue);
      button.style.background = currentIsCanonical
        ? getBoundaryTypeColor(currentValue, 0)
        : previewColor || "#aab2bf";
    },
    onSelect: () => onChange(),
  });
  const { control, input } = picker;
  wrapper.append(control);
  return { wrapper, input };
}

function createBoundaryRow(boundary, index, onChange, previewColor) {
  const row = document.createElement("div");
  row.className = "boundary-row";
  row.dataset.boundaryIndex = String(index);

  const type = createColorField(boundary.type ?? "", previewColor, onChange);
  const nodes = createNodesField(boundary.members, onChange);
  const name = createField("Name", boundary.name ?? "", "boundary-name");

  const deleteButton = document.createElement("button");
  deleteButton.className = "boundary-delete-button";
  deleteButton.type = "button";
  deleteButton.title = "Delete boundary";
  deleteButton.setAttribute("aria-label", `Delete boundary ${index + 1}`);
  deleteButton.textContent = "×";

  const actions = document.createElement("div");
  actions.className = "boundary-actions";
  actions.append(deleteButton);
  row.append(type.wrapper, nodes.wrapper, name.wrapper, actions);

  name.input.addEventListener("input", onChange);
  deleteButton.addEventListener("click", () => {
    row.remove();
    onChange();
  });
  row._getMembers = nodes.getValues;
  row._getType = () => type.input.value;
  row._getName = () => name.input.value;
  return row;
}

function readRows() {
  return [...boundaryList.querySelectorAll(".boundary-row")].map((row) => {
    if (!row._getType || !row._getMembers || !row._getName) return null;
    return {
      type: row._getType().trim(),
      members: row._getMembers(),
      name: row._getName().trim(),
    };
  }).filter((boundary) => boundary && (boundary.members.length || boundary.name));
}

// Mirrors the renderer's boundary-color assignment (see renderer.js) so the
// Visual editor's swatch preview matches what will actually be drawn for
// legacy/custom boundary types that don't use the canonical COLOR-N scheme.
function computeBoundaryPreviewColors(boundaries) {
  const colors = new Map();
  boundaries.forEach((boundary) => {
    if (!colors.has(boundary.type)) {
      colors.set(boundary.type, getBoundaryTypeColor(boundary.type, colors.size));
    }
  });
  return colors;
}

function colorBoundaryLabel(index) {
  return String.fromCharCode("A".charCodeAt(0) + index);
}

function serializeVisualBoundaries(boundaries) {
  const typeColors = computeBoundaryPreviewColors(boundaries);
  const colorLabels = new Map();
  typeColors.forEach((color) => {
    if (!colorLabels.has(color)) colorLabels.set(color, colorBoundaryLabel(colorLabels.size));
  });
  return serializeBoundaries(boundaries.map((boundary) => ({
    ...boundary,
    type: colorLabels.get(typeColors.get(boundary.type)),
  })));
}

function updateListState() {
  const hasRows = boundaryList.querySelectorAll(".boundary-row").length > 0;
  boundaryEmptyState.hidden = hasRows;
  boundaryListHeader.hidden = !hasRows;
}

export function updateBoundarySourceText() {
  boundaryEditor.value = serializeVisualBoundaries(readRows());
  updateListState();
  boundaryEditor.dispatchEvent(new Event("input", { bubbles: true }));
}

export function syncBoundaryEditor() {
  const { nodes } = parseGraph(edgeEditor.value);
  const boundaries = parseBoundaryText(boundaryEditor.value, nodes);
  const previewColors = computeBoundaryPreviewColors(boundaries);
  boundaryList.replaceChildren(
    boundaryListHeader,
    boundaryEmptyState,
    ...boundaries.map((boundary, index) => createBoundaryRow(boundary, index, updateBoundarySourceText, previewColors.get(boundary.type))),
  );
  updateListState();
}

export function addBoundary() {
  const index = boundaryList.children.length;
  const row = createBoundaryRow({ type: "", members: [], name: "" }, index, updateBoundarySourceText);
  boundaryList.append(row);
  updateListState();
  row.querySelector("input")?.focus();
}
