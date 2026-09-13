import { GROUP_COLOR_PALETTE, getGroupColor } from "../config.js";
import { edgeEditor, groupEditor, groupEmptyState, groupList, groupListHeader } from "../dom.js";
import { parseEdgeText, parseGroups, serializeGroups } from "../parser.js";
import {
  createDeleteButton,
  createNodeListField,
  createPopoverPicker,
  updateEditorListState,
} from "./editor-controls.js";

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
  const nodes = createNodeListField({
    members: group.nodes,
    onChange,
    wrapperClass: "boundary-field group-field group-nodes",
    editorClass: "boundary-node-editor group-node-editor",
    chipClass: "boundary-node-chip group-node-chip",
    removeClass: "boundary-node-remove group-node-remove",
  });
  const deleteButton = createDeleteButton({
    className: "group-delete-button",
    itemLabel: "group",
    index,
    onDelete: () => {
      row.remove();
      onChange();
    },
  });
  const color = createColorField(group.label, index, onChange);
  row.append(color.wrapper, nodes.wrapper, deleteButton);
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

export function updateGroupSourceText() {
  groupEditor.value = serializeGroups(readRows());
  updateEditorListState({
    list: groupList,
    rowSelector: ".group-row",
    emptyState: groupEmptyState,
    listHeader: groupListHeader,
  });
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
  updateEditorListState({
    list: groupList,
    rowSelector: ".group-row",
    emptyState: groupEmptyState,
    listHeader: groupListHeader,
  });
}

export function addGroup() {
  const index = groupList.querySelectorAll(".group-row").length;
  const label = index < 26 ? String.fromCharCode(65 + index) : `GROUP-${index + 1}`;
  const row = createGroupRow({ label, nodes: [] }, index, updateGroupSourceText);
  groupList.append(row);
  updateEditorListState({
    list: groupList,
    rowSelector: ".group-row",
    emptyState: groupEmptyState,
    listHeader: groupListHeader,
  });
  row.querySelector("input")?.focus();
}
