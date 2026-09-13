import { EDGE_COLORS } from "../config.js";
import { edgeEditor, edgeEmptyState, edgeList, edgeListHeader, edgeNodeSuggestions } from "../dom.js";
import { parseEdgeText, serializeEdges } from "../parser.js";
import { createPopoverPicker } from "./popover-picker.js";

function createField(label, value, className, withSuggestions = false) {
  const wrapper = document.createElement("label");
  wrapper.className = `edge-field ${className}`;

  const caption = document.createElement("span");
  caption.textContent = label;
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.placeholder = label;
  input.setAttribute("aria-label", label);
  input.autocomplete = "off";
  input.spellcheck = false;
  if (withSuggestions) input.setAttribute("list", edgeNodeSuggestions.id);
  wrapper.append(caption, input);
  return { wrapper, input };
}

function createColorField(value) {
  const wrapper = document.createElement("label");
  wrapper.className = "edge-field edge-color-field";

  const caption = document.createElement("span");
  caption.textContent = "Color";
  const picker = createPopoverPicker({
    value: EDGE_COLORS.some(({ token }) => token === value) ? value : "yellow",
    controlClass: "edge-color-control",
    buttonClass: "edge-color-button",
    popoverClass: "edge-color-popover",
    optionClass: "edge-color-option",
    options: EDGE_COLORS.map(({ token, color }) => ({
      value: token,
      ariaLabel: `Color ${color}`,
      setup: (option) => option.style.setProperty("--edge-color", color),
    })),
    getButtonLabel: (currentValue) => {
      const selected = EDGE_COLORS.find(({ token }) => token === currentValue) ?? EDGE_COLORS[0];
      return `Color ${selected.color}`;
    },
    updateButton: (button, currentValue) => {
      const selected = EDGE_COLORS.find(({ token }) => token === currentValue) ?? EDGE_COLORS[0];
      button.style.setProperty("--edge-color", selected.color);
    },
    dispatchEvents: ["input", "change"],
  });
  const { control, input } = picker;
  wrapper.append(caption, control);
  return { wrapper, input };
}

function createStyleField(value) {
  const wrapper = document.createElement("label");
  wrapper.className = "edge-field edge-style-field";

  const caption = document.createElement("span");
  caption.textContent = "Style";
  const picker = createPopoverPicker({
    value: value === true ? "dotted" : value === "dotted" ? "dotted" : "solid",
    controlClass: "edge-style-control",
    buttonClass: "edge-style-button",
    popoverClass: "edge-style-popover",
    optionClass: "edge-style-option",
    options: [["solid", "Solid line"], ["dotted", "Dotted line"]].map(([optionValue, label]) => ({
      value: optionValue,
      ariaLabel: label,
    })),
    getButtonLabel: (currentValue) => currentValue === "dotted" ? "Style dotted line" : "Style solid line",
    updateButton: (button, currentValue) => {
      button.dataset.style = currentValue;
    },
    dispatchEvents: ["input", "change"],
  });
  const { control, input } = picker;
  wrapper.append(caption, control);
  return { wrapper, input };
}

function createEdgeRow(edge, index, onChange) {
  const row = document.createElement("div");
  row.className = "edge-row";
  row.dataset.edgeIndex = String(index);

  const from = createField("From", edge.from ?? "", "edge-from", true);
  const to = createField("To", edge.to ?? "", "edge-to", true);
  const color = createColorField(edge.color);
  const style = createStyleField(edge.style);
  const label = createField("Label", edge.label ?? "", "edge-labels");

  const actions = document.createElement("div");
  actions.className = "edge-actions";
  const deleteButton = document.createElement("button");
  deleteButton.className = "edge-delete-button";
  deleteButton.type = "button";
  deleteButton.title = "Delete edge";
  deleteButton.setAttribute("aria-label", `Delete edge ${index + 1}`);
  deleteButton.textContent = "×";
  actions.append(deleteButton);

  const error = document.createElement("span");
  error.className = "edge-error-message";
  error.setAttribute("role", "alert");
  row.append(from.wrapper, to.wrapper, color.wrapper, style.wrapper, label.wrapper, actions, error);

  const update = (notify = true) => {
    const hasPartialEndpoints = Boolean(to.input.value && !from.input.value);
    const additionalColors = label.input.value.split(",")
      .map((label) => label.trim().toLowerCase())
      .filter((label) => EDGE_COLORS.some(({ token }) => token === label && token !== "yellow"));
    const hasConflictingColors = color.input.value !== "yellow" && additionalColors.length > 0;
    const message = hasPartialEndpoints
      ? "Add a from node."
      : hasConflictingColors
        ? "Choose only one color per edge."
        : "";
    row.classList.toggle("is-invalid", Boolean(message));
    error.textContent = message;
    error.hidden = !message;
    if (notify) onChange();
  };
  row._refresh = update;
  [from.input, to.input, color.input, style.input, label.input].forEach((input) => input.addEventListener("input", update));
  [color.input, style.input].forEach((input) => input.addEventListener("change", update));
  row.addEventListener("focusin", () => {
    if (!row._editingSnapshot) row._editingSnapshot = readRowValues(row);
  });
  row.addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (!row.contains(document.activeElement)) delete row._editingSnapshot;
    });
  });
  deleteButton.addEventListener("click", () => {
    row.remove();
    onChange();
  });
  update(false);
  return row;
}

function readRows() {
  return [...edgeList.querySelectorAll(".edge-row")].map((row) => {
    const inputs = row.querySelectorAll("input, select");
    const [from, to, color, style, label] = inputs;
    return {
      from: from.value.trim(),
      to: to.value.trim(),
      color: color.value,
      style: style.value,
      label: label.value
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part && part.toLowerCase() !== color.value.toLowerCase())
        .join(","),
    };
  }).filter((edge) => edge.from || edge.to || edge.label);
}

function readRowValues(row) {
  const [from, to, color, style, label] = row.querySelectorAll("input, select");
  return { from: from.value, color: color.value, to: to.value, style: style.value, label: label.value };
}

function restoreRow(row, values) {
  const [from, to, color, style, label] = row.querySelectorAll("input, select");
  from.value = values.from;
  color.value = values.color;
  to.value = values.to;
  style.value = values.style;
  label.value = values.label;
}

function updateListState() {
  const hasRows = edgeList.querySelectorAll(".edge-row").length > 0;
  edgeEmptyState.hidden = hasRows;
  edgeListHeader.hidden = !hasRows;
}

function updateNodeSuggestions() {
  const ids = new Set();
  edgeList.querySelectorAll(".edge-row").forEach((row) => {
    const [from, to] = row.querySelectorAll("input, select");
    [from.value.trim(), to.value.trim()].filter(Boolean).forEach((id) => ids.add(id));
  });
  edgeNodeSuggestions.replaceChildren(
    ...[...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((id) => {
      const option = document.createElement("option");
      option.value = id;
      return option;
    }),
  );
}

export function syncEdgeEditor() {
  const { edges, floatingNodes } = parseEdgeText(edgeEditor.value);
  const rows = [...edges, ...floatingNodes].sort((a, b) => a.line - b.line);
  edgeList.replaceChildren(edgeListHeader, edgeEmptyState, ...rows.map((edge, index) => createEdgeRow(edge, index, updateSourceText)));
  updateListState();
  updateNodeSuggestions();
}

function updateSourceText() {
  edgeEditor.value = serializeEdges(readRows());
  updateListState();
  updateNodeSuggestions();
  edgeEditor.dispatchEvent(new Event("input", { bubbles: true }));
}

export function addEdge() {
  const index = edgeList.children.length;
  const row = createEdgeRow({ from: "", to: "", color: "yellow", style: "solid", label: "" }, index, updateSourceText);
  edgeList.append(row);
  updateListState();
  row.querySelector("input")?.focus();
}

edgeList.addEventListener("keydown", (event) => {
  const row = event.target.closest(".edge-row");
  if (!row) return;
  if (event.key === "Enter") {
    event.preventDefault();
    addEdge();
  } else if (event.key === "Escape") {
    if (row._editingSnapshot) {
      restoreRow(row, row._editingSnapshot);
      delete row._editingSnapshot;
      row._refresh();
    } else if (!readRowValues(row).from && !readRowValues(row).to) {
      row.remove();
      updateSourceText();
    }
  } else if (event.key === "Delete" && !event.target.value) {
    row.remove();
    updateSourceText();
  }
});
