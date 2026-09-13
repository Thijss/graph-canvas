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
