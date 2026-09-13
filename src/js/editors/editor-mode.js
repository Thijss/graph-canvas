export function wireEditorModeToggle({
  editor,
  list,
  addButton,
  visualButton,
  sourceButton,
  sourceMode,
  syncFromSource,
  syncToSource,
}) {
  const setMode = (mode) => {
    const isSourceMode = mode === sourceMode;
    editor.classList.toggle(`is-${sourceMode}`, isSourceMode);
    editor.setAttribute("aria-hidden", String(!isSourceMode));
    editor.tabIndex = isSourceMode ? 0 : -1;
    list.hidden = isSourceMode;
    addButton.hidden = isSourceMode;
    visualButton.classList.toggle("is-active", !isSourceMode);
    sourceButton.classList.toggle("is-active", isSourceMode);
    visualButton.setAttribute("aria-pressed", String(!isSourceMode));
    sourceButton.setAttribute("aria-pressed", String(isSourceMode));
    if (isSourceMode) {
      syncToSource();
      editor.focus();
    } else {
      syncFromSource();
    }
  };

  visualButton.addEventListener("click", () => setMode("visual"));
  sourceButton.addEventListener("click", () => setMode(sourceMode));
}
