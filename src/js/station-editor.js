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

function createStationRow(station, index, onChange) {
  const row = document.createElement("div");
  row.className = "station-row";
  row.dataset.stationIndex = String(index);

  const type = createField("Type", station.type ?? "", "station-type");
  const nodes = createField("Nodes", station.members.join(", "), "station-nodes");
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

  [type.input, nodes.input, name.input].forEach((input) => input.addEventListener("input", onChange));
  deleteButton.addEventListener("click", () => {
    row.remove();
    onChange();
  });
  return row;
}

function readRows() {
  return [...stationList.querySelectorAll(".station-row")].map((row) => {
    const [type, members, name] = row.querySelectorAll("input");
    return {
      type: type.value.trim(),
      members: members.value.split(",").map((member) => member.trim()).filter(Boolean),
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
