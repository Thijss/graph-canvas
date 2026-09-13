// Shared hidden-input picker used by the visual editors for colors and styles.
export function createPopoverPicker({
  value,
  controlClass,
  buttonClass,
  popoverClass,
  optionClass,
  options,
  getButtonLabel,
  updateButton,
  normalizeValue = (currentValue) => currentValue,
  onSelect,
  dispatchEvents = [],
}) {
  const control = document.createElement("div");
  const input = document.createElement("input");
  const button = document.createElement("button");
  const popover = document.createElement("div");

  control.className = controlClass;
  input.type = "hidden";
  input.value = value;
  button.type = "button";
  button.className = buttonClass;
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  popover.className = popoverClass;
  popover.setAttribute("role", "listbox");
  popover.hidden = true;

  const optionElements = options.map((optionData) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = optionClass;
    option.dataset.value = optionData.value;
    option.setAttribute("role", "option");
    option.setAttribute("aria-label", optionData.ariaLabel);
    optionData.setup?.(option);
    option.addEventListener("click", () => {
      input.value = optionData.value;
      update();
      close();
      dispatchEvents.forEach((eventType) => input.dispatchEvent(new Event(eventType, { bubbles: true })));
      onSelect?.(input.value);
    });
    popover.append(option);
    return option;
  });

  const update = () => {
    updateButton?.(button, input.value);
    button.setAttribute("aria-label", getButtonLabel(input.value));
    optionElements.forEach((option) => {
      const isSelected = normalizeValue(option.dataset.value) === normalizeValue(input.value);
      option.classList.toggle("is-selected", isSelected);
      option.setAttribute("aria-selected", String(isSelected));
    });
  };
  const close = () => {
    popover.hidden = true;
    button.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", handleOutsideClick, true);
    document.removeEventListener("keydown", handleKeydown, true);
  };
  const handleOutsideClick = (event) => {
    if (!control.contains(event.target)) close();
  };
  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      close();
      button.focus();
    }
  };
  button.addEventListener("click", () => {
    if (popover.hidden) {
      popover.hidden = false;
      button.setAttribute("aria-expanded", "true");
      document.addEventListener("pointerdown", handleOutsideClick, true);
      document.addEventListener("keydown", handleKeydown, true);
    } else {
      close();
    }
  });

  update();
  control.append(input, button, popover);
  return { control, input, update };
}

export function createNodeListField({
  members,
  onChange,
  wrapperClass,
  editorClass,
  chipClass,
  removeClass,
}) {
  const wrapper = document.createElement("label");
  wrapper.className = wrapperClass;
  const caption = document.createElement("span");
  caption.textContent = "Nodes";
  const editor = document.createElement("div");
  editor.className = editorClass;
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
  const chipSelector = chipClass.split(/\s+/).map((className) => `.${className}`).join("");
  const renderNodes = (notify = true) => {
    editor.querySelectorAll(chipSelector).forEach((chip) => chip.remove());
    values.forEach((node) => {
      const chip = document.createElement("span");
      chip.className = chipClass;
      chip.textContent = node;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = removeClass;
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

export function updateEditorListState({ list, rowSelector, emptyState, listHeader }) {
  const hasRows = list.querySelectorAll(rowSelector).length > 0;
  emptyState.hidden = hasRows;
  listHeader.hidden = !hasRows;
}

export function createDeleteButton({ className, itemLabel, index, onDelete }) {
  const deleteButton = document.createElement("button");
  deleteButton.className = className;
  deleteButton.type = "button";
  deleteButton.title = `Delete ${itemLabel}`;
  deleteButton.setAttribute("aria-label", `Delete ${itemLabel} ${index + 1}`);
  deleteButton.textContent = "×";
  deleteButton.addEventListener("click", onDelete);
  return deleteButton;
}
