import { EDGE_TYPE_KEYWORDS } from "./config.js";
import { edgeEditor, edgeEmptyState, edgeList, edgeListHeader, edgeNodeSuggestions } from "./dom.js";
import { parseEdgeText, serializeEdges } from "./parser.js";

const EDGE_TYPES = [...new Set(EDGE_TYPE_KEYWORDS)];

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

function createTypeField(value) {
  const wrapper = document.createElement("label");
  wrapper.className = "edge-field edge-type-field";

  const caption = document.createElement("span");
  caption.textContent = "Type";
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Type");
  EDGE_TYPES.forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    select.append(option);
  });
  select.value = EDGE_TYPES.includes(value) ? value : "line";
  wrapper.append(caption, select);
  return { wrapper, input: select };
}

function createOpenField(value) {
  const wrapper = document.createElement("label");
  wrapper.className = "edge-field edge-open-field";

  const caption = document.createElement("span");
  caption.textContent = "Open";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(value);
  checkbox.setAttribute("aria-label", "Open");
  wrapper.append(caption, checkbox);
  return { wrapper, input: checkbox };
}

function createEdgeRow(edge, index, onChange) {
  const row = document.createElement("div");
  row.className = "edge-row";
  row.dataset.edgeIndex = String(index);

  const from = createField("From", edge.from ?? "", "edge-from", true);
  const to = createField("To", edge.to ?? "", "edge-to", true);
  const type = createTypeField(edge.type);
  const open = createOpenField(edge.open);
  const labels = createField("Labels", edge.labels.join(", "), "edge-labels");

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
  row.append(from.wrapper, to.wrapper, type.wrapper, open.wrapper, labels.wrapper, actions, error);

  const update = (notify = true) => {
    const hasPartialEndpoints = Boolean(to.input.value && !from.input.value);
    const styleLabels = [type.input.value, ...labels.input.value.split(",").map((label) => label.trim().toLowerCase())]
      .filter((label) => ["link", "transformer", "x"].includes(label));
    const hasConflictingStyles = new Set(styleLabels).size > 1;
    const message = hasPartialEndpoints
      ? "Add a from node."
      : hasConflictingStyles
        ? "Choose only one of link, transformer, or x."
        : "";
    row.classList.toggle("is-invalid", Boolean(message));
    error.textContent = message;
    error.hidden = !message;
    if (notify) onChange();
  };
  row._refresh = update;
  [from.input, to.input, type.input, open.input, labels.input].forEach((input) => input.addEventListener("input", update));
  type.input.addEventListener("change", update);
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
    const [from, to, type, open, labels] = inputs;
    return {
      from: from.value.trim(),
      to: to.value.trim(),
      type: type.value,
      open: open.checked,
      labels: labels.value
        .split(",")
        .map((label) => label.trim())
        .filter((label) => label && label.toLowerCase() !== type.value.toLowerCase()),
    };
  }).filter((edge) => edge.from || edge.to || edge.labels.length);
}

function readRowValues(row) {
  const [from, to, type, open, labels] = row.querySelectorAll("input, select");
  return { from: from.value, type: type.value, to: to.value, open: open.checked, labels: labels.value };
}

function restoreRow(row, values) {
  const [from, to, type, open, labels] = row.querySelectorAll("input, select");
  from.value = values.from;
  type.value = values.type;
  to.value = values.to;
  open.checked = values.open;
  labels.value = values.labels;
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
  const row = createEdgeRow({ from: "", to: "", type: "line", open: false, labels: [] }, index, updateSourceText);
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
