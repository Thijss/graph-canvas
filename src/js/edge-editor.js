import { EDGE_COLORS } from "./config.js";
import { edgeEditor, edgeEmptyState, edgeList, edgeListHeader, edgeNodeSuggestions } from "./dom.js";
import { parseEdgeText, serializeEdges } from "./parser.js";

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
  const control = document.createElement("div");
  control.className = "edge-color-control";
  const input = document.createElement("input");
  input.type = "hidden";
  input.value = EDGE_COLORS.some(({ token }) => token === value) ? value : "line";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "edge-color-button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  const popover = document.createElement("div");
  popover.className = "edge-color-popover";
  popover.setAttribute("role", "listbox");
  popover.hidden = true;

  const updateSelectedColor = () => {
    const selected = EDGE_COLORS.find(({ token }) => token === input.value) ?? EDGE_COLORS[0];
    button.style.setProperty("--edge-color", selected.color);
    button.setAttribute("aria-label", `Color ${selected.color}`);
    popover.querySelectorAll("button").forEach((option) => {
      const isSelected = option.dataset.value === input.value;
      option.classList.toggle("is-selected", isSelected);
      option.setAttribute("aria-selected", String(isSelected));
    });
  };
  const closePopover = () => {
    popover.hidden = true;
    button.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", handleOutsideClick, true);
  };
  const handleOutsideClick = (event) => {
    if (!control.contains(event.target)) closePopover();
  };
  button.addEventListener("click", () => {
    if (popover.hidden) {
      popover.hidden = false;
      button.setAttribute("aria-expanded", "true");
      document.addEventListener("pointerdown", handleOutsideClick, true);
    } else {
      closePopover();
    }
  });
  EDGE_COLORS.forEach(({ token, color }) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "edge-color-option";
    option.dataset.value = token;
    option.setAttribute("role", "option");
    option.setAttribute("aria-label", `Color ${color}`);
    option.style.setProperty("--edge-color", color);
    option.addEventListener("click", () => {
      input.value = token;
      updateSelectedColor();
      closePopover();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    popover.append(option);
  });
  updateSelectedColor();
  control.append(input, button, popover);
  wrapper.append(caption, control);
  return { wrapper, input };
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
  const color = createColorField(edge.color);
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
  row.append(from.wrapper, to.wrapper, color.wrapper, open.wrapper, labels.wrapper, actions, error);

  const update = (notify = true) => {
    const hasPartialEndpoints = Boolean(to.input.value && !from.input.value);
    const additionalColors = labels.input.value.split(",")
      .map((label) => label.trim().toLowerCase())
      .filter((label) => EDGE_COLORS.some(({ token }) => token === label && token !== "line"));
    const hasConflictingColors = color.input.value !== "line" && additionalColors.length > 0;
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
  [from.input, to.input, color.input, open.input, labels.input].forEach((input) => input.addEventListener("input", update));
  color.input.addEventListener("change", update);
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
    const [from, to, color, open, labels] = inputs;
    return {
      from: from.value.trim(),
      to: to.value.trim(),
      color: color.value,
      open: open.checked,
      labels: labels.value
        .split(",")
        .map((label) => label.trim())
        .filter((label) => label && label.toLowerCase() !== color.value.toLowerCase()),
    };
  }).filter((edge) => edge.from || edge.to || edge.labels.length);
}

function readRowValues(row) {
  const [from, to, color, open, labels] = row.querySelectorAll("input, select");
  return { from: from.value, color: color.value, to: to.value, open: open.checked, labels: labels.value };
}

function restoreRow(row, values) {
  const [from, to, color, open, labels] = row.querySelectorAll("input, select");
  from.value = values.from;
  color.value = values.color;
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
  const row = createEdgeRow({ from: "", to: "", color: "line", open: false, labels: [] }, index, updateSourceText);
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
