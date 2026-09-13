import { GROUP_COLOR_PALETTE, getGroupColor } from "../config.js";
import { edgeEditor, groupEditor, groupEmptyState, groupList, groupListHeader } from "../dom.js";
import { parseEdgeText, parseGroups, serializeGroups } from "../parser.js";
import { createPopoverPicker } from "./popover-picker.js";

function createNodesField(members, onChange) {
  const wrapper = document.createElement("label");
  wrapper.className = "boundary-field group-field group-nodes";
  const caption = document.createElement("span");
  caption.textContent = "Nodes";
  const editor = document.createElement("div");
  editor.className = "boundary-node-editor group-node-editor";
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
    editor.querySelectorAll(".group-node-chip").forEach((chip) => chip.remove());
    values.forEach((node) => {
      const chip = document.createElement("span");
      chip.className = "boundary-node-chip group-node-chip";
      chip.textContent = node;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "boundary-node-remove group-node-remove";
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

function createColorField(value, index, onChange) {
  const wrapper = document.createElement("div");
  wrapper.className = "boundary-field group-field group-color";
  const picker = createPopoverPicker({
    value: value || `GROUP-${(index % GROUP_COLOR_PALETTE.length) + 1}`,
    controlClass: "boundary-color-control",
    buttonClass: "boundary-color-swatch",
    popoverClass: "boundary-color-popover",
    optionClass: "boundary-color-option",
    options: GROUP_COLOR_PALETTE.map((color, optionIndex) => ({
      value: `GROUP-${optionIndex + 1}`,
      ariaLabel: `Group color ${optionIndex + 1}`,
      setup: (option) => { option.style.background = color; },
    })),
    normalizeValue: (currentValue) => currentValue.toUpperCase(),
    getButtonLabel: (currentValue) => {
      const match = /^GROUP-([1-9]|10)$/i.exec(currentValue);
      return `Group color ${match ? Number(match[1]) : index + 1}`;
    },
    updateButton: (button, currentValue) => {
      const match = /^GROUP-([1-9]|10)$/i.exec(currentValue);
      button.style.background = getGroupColor(match ? Number(match[1]) - 1 : index);
    },
    onSelect: () => onChange(),
  });
  const { control, input } = picker;
  wrapper.append(control);
  return { wrapper, input };
}

function createGroupRow(group, index, onChange) {
  const row = document.createElement("div");
  row.className = "group-row";
  const nodes = createNodesField(group.nodes, onChange);
  const deleteButton = document.createElement("button");
  deleteButton.className = "group-delete-button";
  deleteButton.type = "button";
  deleteButton.title = "Delete group";
  deleteButton.setAttribute("aria-label", `Delete group ${index + 1}`);
  deleteButton.textContent = "×";
  const color = createColorField(group.label, index, onChange);
  row.append(color.wrapper, nodes.wrapper, deleteButton);
  deleteButton.addEventListener("click", () => {
    row.remove();
    onChange();
  });
  row._getLabel = () => color.input.value;
  row._getMembers = nodes.getValues;
  return row;
}

function readRows() {
  return [...groupList.querySelectorAll(".group-row")].map((row) => ({
    label: row._getLabel(),
    nodes: row._getMembers(),
  })).filter((group) => group.nodes.length);
}

function updateListState() {
  const hasRows = groupList.querySelectorAll(".group-row").length > 0;
  groupEmptyState.hidden = hasRows;
  groupListHeader.hidden = !hasRows;
}

export function updateGroupSourceText() {
  groupEditor.value = serializeGroups(readRows());
  updateListState();
  groupEditor.dispatchEvent(new Event("input", { bubbles: true }));
}

export function syncGroupEditor() {
  const { nodes } = parseEdgeText(edgeEditor.value);
  const groups = parseGroups(groupEditor.value, nodes);
  groupList.replaceChildren(
    groupListHeader,
    groupEmptyState,
    ...groups.map((group, index) => createGroupRow(group, index, updateGroupSourceText)),
  );
  updateListState();
}

export function addGroup() {
  const index = groupList.querySelectorAll(".group-row").length;
  const label = index < 26 ? String.fromCharCode(65 + index) : `GROUP-${index + 1}`;
  const row = createGroupRow({ label, nodes: [] }, index, updateGroupSourceText);
  groupList.append(row);
  updateListState();
  row.querySelector("input")?.focus();
}
