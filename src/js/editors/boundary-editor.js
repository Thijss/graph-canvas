import { COLOR_PALETTE, getBoundaryTypeColor, isCanonicalBoundaryColorType } from "../config.js";
import { edgeEditor, boundaryEditor, boundaryEmptyState, boundaryList, boundaryListHeader } from "../dom.js";
import { parseEdgeText, parseBoundaryText, serializeBoundaries } from "../parser.js";
import {
  createDeleteButton,
  createNodeListField,
  createPopoverPicker,
  updateEditorListState,
} from "./editor-controls.js";

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
  const nodes = createNodeListField({
    members: boundary.members,
    onChange,
    wrapperClass: "boundary-field boundary-nodes",
    editorClass: "boundary-node-editor",
    chipClass: "boundary-node-chip",
    removeClass: "boundary-node-remove",
  });
  const name = createField("Name", boundary.name ?? "", "boundary-name");

  const deleteButton = createDeleteButton({
    className: "boundary-delete-button",
    itemLabel: "boundary",
    index,
    onDelete: () => {
      row.remove();
      onChange();
    },
  });

  const actions = document.createElement("div");
  actions.className = "boundary-actions";
  actions.append(deleteButton);
  row.append(type.wrapper, nodes.wrapper, name.wrapper, actions);

  name.input.addEventListener("input", onChange);
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

export function updateBoundarySourceText() {
  boundaryEditor.value = serializeVisualBoundaries(readRows());
  updateEditorListState({
    list: boundaryList,
    rowSelector: ".boundary-row",
    emptyState: boundaryEmptyState,
    listHeader: boundaryListHeader,
  });
  boundaryEditor.dispatchEvent(new Event("input", { bubbles: true }));
}

export function syncBoundaryEditor() {
  const { nodes } = parseEdgeText(edgeEditor.value);
  const boundaries = parseBoundaryText(boundaryEditor.value, nodes);
  const previewColors = computeBoundaryPreviewColors(boundaries);
  boundaryList.replaceChildren(
    boundaryListHeader,
    boundaryEmptyState,
    ...boundaries.map((boundary, index) => createBoundaryRow(boundary, index, updateBoundarySourceText, previewColors.get(boundary.type))),
  );
  updateEditorListState({
    list: boundaryList,
    rowSelector: ".boundary-row",
    emptyState: boundaryEmptyState,
    listHeader: boundaryListHeader,
  });
}

export function addBoundary() {
  const index = boundaryList.children.length;
  const row = createBoundaryRow({ type: "", members: [], name: "" }, index, updateBoundarySourceText);
  boundaryList.append(row);
  updateEditorListState({
    list: boundaryList,
    rowSelector: ".boundary-row",
    emptyState: boundaryEmptyState,
    listHeader: boundaryListHeader,
  });
  row.querySelector("input")?.focus();
}
