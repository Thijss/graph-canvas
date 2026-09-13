import { COLOR_PALETTE, getStationTypeColor, isCanonicalStationColorType } from "./config.js";
import { edgeEditor, stationEditor, stationEmptyState, stationList, stationListHeader } from "./dom.js";
import { parseGraph, parseStationText, serializeStations } from "./parser.js";

function createField(label, value, className) {
  const wrapper = document.createElement("label");
  wrapper.className = `station-field ${className}`;

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
  wrapper.className = "station-field station-nodes";

  const caption = document.createElement("span");
  caption.textContent = "Nodes";
  const editor = document.createElement("div");
  editor.className = "station-node-editor";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Node + Enter";
  input.title = "Type a node ID and press Enter to add it";
  input.setAttribute("aria-label", "Nodes");
  input.autocomplete = "off";
  input.spellcheck = false;
  editor.append(input);
  wrapper.append(caption, editor);

  const values = [...members];
  const renderNodes = (notify = true) => {
    editor.querySelectorAll(".station-node-chip").forEach((chip) => chip.remove());
    values.forEach((node) => {
      const chip = document.createElement("span");
      chip.className = "station-node-chip";
      chip.textContent = node;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "station-node-remove";
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

// Builds the station color selector: clicking the swatch dot opens a small
// popover of the 10 fixed palette colors as clickable circles. A hidden input
// holds the actual station type value used for reading/serializing rows.
// Legacy/custom type words (e.g. "SUB", used by the physics layout for
// special substation positioning) are preserved verbatim until the user picks
// a palette color, so switching to Visual mode never silently discards or
// recolors data from an existing saved graph.
function createColorField(value, previewColor, onChange) {
  const wrapper = document.createElement("div");
  wrapper.className = "station-field station-type";

  const control = document.createElement("div");
  control.className = "station-color-control";

  const hiddenInput = document.createElement("input");
  hiddenInput.type = "hidden";
  hiddenInput.value = value || "COLOR-1";

  const swatchButton = document.createElement("button");
  swatchButton.type = "button";
  swatchButton.className = "station-color-swatch";
  swatchButton.setAttribute("aria-haspopup", "listbox");
  swatchButton.setAttribute("aria-expanded", "false");

  const popover = document.createElement("div");
  popover.className = "station-color-popover";
  popover.setAttribute("role", "listbox");
  popover.hidden = true;

  const options = COLOR_PALETTE.map((color, i) => {
    const optionValue = `COLOR-${i + 1}`;
    const option = document.createElement("button");
    option.type = "button";
    option.className = "station-color-option";
    option.style.background = color;
    option.setAttribute("role", "option");
    option.setAttribute("aria-label", `Color ${i + 1}`);
    option.dataset.value = optionValue;
    popover.append(option);
    return option;
  });

  const updateSwatch = () => {
    const currentIsCanonical = isCanonicalStationColorType(hiddenInput.value);
    swatchButton.style.background = currentIsCanonical
      ? getStationTypeColor(hiddenInput.value, 0)
      : previewColor || "#aab2bf";
    swatchButton.setAttribute(
      "aria-label",
      `Color group: ${currentIsCanonical ? `Color ${hiddenInput.value.split("-")[1]}` : hiddenInput.value}`,
    );
    options.forEach((option) => {
      const isSelected = option.dataset.value === hiddenInput.value;
      option.classList.toggle("is-selected", isSelected);
      option.setAttribute("aria-selected", String(isSelected));
    });
  };

  function closePopover() {
    popover.hidden = true;
    swatchButton.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", handleOutsideClick, true);
    document.removeEventListener("keydown", handleKeydown, true);
  }
  function handleOutsideClick(event) {
    if (!control.contains(event.target)) closePopover();
  }
  function handleKeydown(event) {
    if (event.key === "Escape") {
      closePopover();
      swatchButton.focus();
    }
  }
  function openPopover() {
    popover.hidden = false;
    swatchButton.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", handleOutsideClick, true);
    document.addEventListener("keydown", handleKeydown, true);
  }

  swatchButton.addEventListener("click", () => {
    if (popover.hidden) openPopover();
    else closePopover();
  });
  options.forEach((option) => {
    option.addEventListener("click", () => {
      hiddenInput.value = option.dataset.value;
      updateSwatch();
      closePopover();
      onChange();
    });
  });

  updateSwatch();
  control.append(swatchButton, popover);
  wrapper.append(control);
  return { wrapper, input: hiddenInput };
}

function createStationRow(station, index, onChange, previewColor) {
  const row = document.createElement("div");
  row.className = "station-row";
  row.dataset.stationIndex = String(index);

  const type = createColorField(station.type ?? "", previewColor, onChange);
  const nodes = createNodesField(station.members, onChange);
  const name = createField("Name", station.name ?? "", "station-name");

  const deleteButton = document.createElement("button");
  deleteButton.className = "station-delete-button";
  deleteButton.type = "button";
  deleteButton.title = "Delete station";
  deleteButton.setAttribute("aria-label", `Delete station ${index + 1}`);
  deleteButton.textContent = "×";

  const actions = document.createElement("div");
  actions.className = "station-actions";
  actions.append(deleteButton);
  row.append(type.wrapper, nodes.wrapper, name.wrapper, actions);

  name.input.addEventListener("input", onChange);
  deleteButton.addEventListener("click", () => {
    row.remove();
    onChange();
  });
  row._getMembers = nodes.getValues;
  return row;
}

function readRows() {
  return [...stationList.querySelectorAll(".station-row")].map((row) => {
    const [type, name] = row.querySelectorAll(".station-type input[type=hidden], .station-name input");
    return {
      type: type.value.trim(),
      members: row._getMembers(),
      name: name.value.trim(),
    };
  }).filter((station) => station.type || station.members.length || station.name);
}

// Mirrors the renderer's station-color assignment (see renderer.js) so the
// Visual editor's swatch preview matches what will actually be drawn for
// legacy/custom station types that don't use the canonical COLOR-N scheme.
function computeStationPreviewColors(stations) {
  const colors = new Map();
  stations.forEach((station) => {
    if (!colors.has(station.type)) {
      colors.set(station.type, getStationTypeColor(station.type, colors.size));
    }
  });
  return colors;
}

function updateListState() {
  const hasRows = stationList.querySelectorAll(".station-row").length > 0;
  stationEmptyState.hidden = hasRows;
  stationListHeader.hidden = !hasRows;
}

function updateSourceText() {
  stationEditor.value = serializeStations(readRows());
  updateListState();
  stationEditor.dispatchEvent(new Event("input", { bubbles: true }));
}

export function syncStationEditor() {
  const { nodes } = parseGraph(edgeEditor.value);
  const stations = parseStationText(stationEditor.value, nodes);
  const previewColors = computeStationPreviewColors(stations);
  stationList.replaceChildren(
    stationListHeader,
    stationEmptyState,
    ...stations.map((station, index) => createStationRow(station, index, updateSourceText, previewColors.get(station.type))),
  );
  updateListState();
}

export function addStation() {
  const index = stationList.children.length;
  const row = createStationRow({ type: "", members: [], name: "" }, index, updateSourceText);
  stationList.append(row);
  updateListState();
  row.querySelector("input")?.focus();
}
