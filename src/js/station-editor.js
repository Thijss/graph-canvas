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

function createStationRow(station, index, onChange) {
  const row = document.createElement("div");
  row.className = "station-row";
  row.dataset.stationIndex = String(index);

  const type = createField("Color group", station.type ?? "", "station-type");
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

  [type.input, name.input].forEach((input) => input.addEventListener("input", onChange));
  deleteButton.addEventListener("click", () => {
    row.remove();
    onChange();
  });
  row._getMembers = nodes.getValues;
  return row;
}

function readRows() {
  return [...stationList.querySelectorAll(".station-row")].map((row) => {
    const [type, name] = row.querySelectorAll(".station-type input, .station-name input");
    return {
      type: type.value.trim(),
      members: row._getMembers(),
      name: name.value.trim(),
    };
  }).filter((station) => station.type || station.members.length || station.name);
}

function updateListState() {
  stationEmptyState.hidden = stationList.querySelectorAll(".station-row").length > 0;
}

function updateSourceText() {
  stationEditor.value = serializeStations(readRows());
  updateListState();
  stationEditor.dispatchEvent(new Event("input", { bubbles: true }));
}

export function syncStationEditor() {
  const { nodes } = parseGraph(edgeEditor.value);
  const stations = parseStationText(stationEditor.value, nodes);
  stationList.replaceChildren(
    stationListHeader,
    stationEmptyState,
    ...stations.map((station, index) => createStationRow(station, index, updateSourceText)),
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
