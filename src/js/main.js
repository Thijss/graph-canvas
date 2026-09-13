import {
  edgeEditor,
  edgeList,
  addEdgeButton,
  visualEdgeModeButton,
  rawEdgeModeButton,
  boundaryEditor,
  boundaryList,
  addBoundaryButton,
  boundaryVisualModeButton,
  boundaryTextModeButton,
  groupEditor,
  groupList,
  addGroupButton,
  groupVisualModeButton,
  groupTextModeButton,
  graph,
  graphWrap,
  statusText,
  directedToggle,
  hullToggle,
  groupsToggle,
  layoutModeButtons,
  repulsionSlider,
  repulsionControl,
  dagSpacingSlider,
  dagSpacingControl,
  clearButton,
  templateButton,
  openButton,
  fileInput,
  templateDialog,
  templateDialogClose,
  templateList,
  fullscreenButton,
  themeToggle,
  helpButton,
  helpDialog,
  helpDialogClose,
  helpContent,
  zoomInButton,
  zoomOutButton,
  disclaimerButton,
  disclaimerDialog,
  disclaimerDialogClose,
  licenseButton,
  licenseDialog,
  licenseDialogClose,
  licenseContent,
} from "./dom.js";
import { state } from "./state.js";
import { draw, restartSimulation } from "./engine.js";
import { updateEdgeErrors } from "./renderer.js";
import { loadSavedEditors, saveEditors, loadSettings, saveSettings } from "./persistence.js";
import { readGraphFile, splitGraphText } from "./file-io.js";
import { addEdge, syncEdgeEditor } from "./editors/edge-editor.js";
import { addBoundary, syncBoundaryEditor, updateBoundarySourceText } from "./editors/boundary-editor.js";
import { addGroup, syncGroupEditor, updateGroupSourceText } from "./editors/group-editor.js";
import { wireEditorModeToggle } from "./editors/editor-mode.js";
import { wireDialog } from "./dialogs.js";
import { setupCanvasInteraction } from "./canvas-interaction.js";
import { setupExportDialog } from "./export-dialog.js";

function persistEditors() {
  saveEditors(edgeEditor.value, boundaryEditor.value, groupEditor.value);
}

function persistSettings() {
  saveSettings({
    layoutMode: state.layoutMode,
    dagLevelSpacing: state.dagLevelSpacing,
    showBoundaryHulls: state.showBoundaryHulls,
    showGroups: state.showGroups,
    showArrows: directedToggle.checked,
    darkMode: document.documentElement.classList.contains("dark"),
    repulsion: repulsionSlider.value,
  });
}

function updateLayoutControlVisibility() {
  repulsionControl.hidden = state.layoutMode !== "physics";
  dagSpacingControl.hidden = state.layoutMode !== "hierarchy";
}

// Typing in the edge/boundary editors debounces the redraw+physics restart by
// 1s, so rapid keystrokes don't each trigger a full re-layout — only once
// typing pauses. Buttons that replace the text outright (Clear/Load template)
// cancel any pending debounce so they take effect immediately instead of
// being overwritten by a stale scheduled redraw.
let editorDrawTimer = null;
function scheduleEditorRedraw() {
  persistEditors();
  window.clearTimeout(editorDrawTimer);
  editorDrawTimer = window.setTimeout(() => {
    editorDrawTimer = null;
    restartSimulation();
    if (edgeEditor.classList.contains("is-raw")) syncEdgeEditor();
    if (boundaryEditor.classList.contains("is-text")) syncBoundaryEditor();
    if (groupEditor.classList.contains("is-text")) syncGroupEditor();
  }, 500);
}
function cancelScheduledEditorRedraw() {
  window.clearTimeout(editorDrawTimer);
  editorDrawTimer = null;
}

clearButton.addEventListener("click", () => {
  cancelScheduledEditorRedraw();
  edgeEditor.value = "";
  boundaryEditor.value = "";
  groupEditor.value = "";
  syncEdgeEditor();
  syncBoundaryEditor();
  syncGroupEditor();
  persistEditors();
  state.positions.clear();
  state.pinnedNodes.clear();
  restartSimulation();
});
const templateFiles = new Map();

function renderTemplateOptions(templates) {
  templateList.replaceChildren();
  templates.forEach((template) => {
    const option = document.createElement("button");
    option.className = "template-option";
    option.type = "button";
    option.dataset.template = template.id;

    const title = document.createElement("strong");
    title.textContent = template.title;
    const description = document.createElement("span");
    description.textContent = template.description;
    option.append(title, description);
    templateList.append(option);
  });
}

async function loadTemplateManifest() {
  const response = await fetch("templates/index.json");
  if (!response.ok) throw new Error("Could not load template manifest");
  const templates = await response.json();
  if (!Array.isArray(templates)) throw new Error("Invalid template manifest");

  templates.forEach((template) => {
    if (
      typeof template.id !== "string" ||
      typeof template.title !== "string" ||
      typeof template.description !== "string" ||
      typeof template.file !== "string" ||
      !/^[\w.-]+$/.test(template.file)
    ) {
      throw new Error("Invalid template entry");
    }
    templateFiles.set(template.id, `templates/${template.file}`);
  });
  renderTemplateOptions(templates);
}

async function loadTemplate(templateName) {
  cancelScheduledEditorRedraw();
  try {
    const templateFile = templateFiles.get(templateName);
    if (!templateFile) throw new Error(`Unknown template: ${templateName}`);
    const response = await fetch(templateFile);
    if (!response.ok) throw new Error(`Could not load template: ${templateName}`);
    const templateText = await response.text();
    const { edgesText, boundariesText, groupsText } = splitGraphText(templateText);
    edgeEditor.value = edgesText.trim();
    syncEdgeEditor();
    boundaryEditor.value = boundariesText.trim();
    syncBoundaryEditor();
    groupEditor.value = groupsText.trim();
    syncGroupEditor();
    persistEditors();
  } catch {
    statusText.textContent = "Couldn't load template (serve this page over http(s) to enable it)";
  }
  // Clear right before restarting (not before the awaited fetch) so there's
  // no window where the still-running animation loop can tick against
  // emptied positions for the old node list and crash.
  state.positions.clear();
  state.pinnedNodes.clear();
  restartSimulation();
}
wireDialog({
  dialog: templateDialog,
  openButton: templateButton,
  closeButton: templateDialogClose,
});
let helpLoaded = false;
async function loadHelp() {
  if (helpLoaded) return;
  try {
    const response = await fetch("content/help.html");
    if (!response.ok) throw new Error("Could not load help");
    helpContent.innerHTML = await response.text();
    helpLoaded = true;
  } catch {
    helpContent.textContent = "Could not load help content.";
  }
}
wireDialog({
  dialog: helpDialog,
  openButton: helpButton,
  closeButton: helpDialogClose,
  onOpen: loadHelp,
});
openButton.addEventListener("click", () => fileInput.click());
setupExportDialog({ graph, edgeEditor, boundaryEditor, groupEditor, statusText });
fileInput.addEventListener("change", async () => {
  const [file] = fileInput.files;
  fileInput.value = "";
  if (!file) return;

  try {
    const { edgesText, boundariesText, groupsText } = await readGraphFile(file);

    cancelScheduledEditorRedraw();
    edgeEditor.value = edgesText.trim();
    syncEdgeEditor();
    boundaryEditor.value = boundariesText.trim();
    syncBoundaryEditor();
    groupEditor.value = groupsText.trim();
    syncGroupEditor();
    persistEditors();
    state.positions.clear();
    state.pinnedNodes.clear();
    restartSimulation();
  } catch (error) {
    statusText.textContent = `Couldn't open file: ${error.message}`;
  }
});
templateList.addEventListener("click", (event) => {
  const option = event.target.closest("[data-template]");
  if (option) {
    templateDialog.close();
    loadTemplate(option.dataset.template);
  }
});
wireDialog({
  dialog: disclaimerDialog,
  openButton: disclaimerButton,
  closeButton: disclaimerDialogClose,
});
async function loadLicense() {
  try {
    const response = await fetch("LICENSE");
    if (!response.ok) throw new Error("Could not load license");
    licenseContent.textContent = await response.text();
  } catch {
    licenseContent.textContent = "Could not load the license.";
  }
}
wireDialog({
  dialog: licenseDialog,
  openButton: licenseButton,
  closeButton: licenseDialogClose,
  onOpen: loadLicense,
});
edgeEditor.addEventListener("input", scheduleEditorRedraw);
edgeEditor.addEventListener("scroll", () => updateEdgeErrors());
boundaryEditor.addEventListener("input", scheduleEditorRedraw);
groupEditor.addEventListener("input", scheduleEditorRedraw);
directedToggle.addEventListener("change", () => {
  persistSettings();
  draw();
});
hullToggle.addEventListener("change", () => {
  state.showBoundaryHulls = hullToggle.checked;
  persistSettings();
  draw();
});
groupsToggle.addEventListener("change", () => {
  state.showGroups = groupsToggle.checked;
  persistSettings();
  draw();
});
layoutModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.layoutMode = button.dataset.layoutMode;
    persistSettings();
    updateLayoutControlVisibility();
    layoutModeButtons.forEach((modeButton) => {
      const isActive = modeButton === button;
      modeButton.classList.toggle("is-active", isActive);
      modeButton.setAttribute("aria-pressed", String(isActive));
    });
    restartSimulation(state.layoutMode === "physics" ? 0.6 : 0);
  });
});
repulsionSlider.addEventListener("input", () => {
  persistSettings();
  restartSimulation(0.5); // reheat so nodes visibly resettle at the new spacing
});
dagSpacingSlider.addEventListener("input", () => {
  state.dagLevelSpacing = Number(dagSpacingSlider.value);
  persistSettings();
  restartSimulation(0);
});
const { edgesText, boundariesText, groupsText } = loadSavedEditors();
if (edgesText !== null) edgeEditor.value = edgesText;
if (boundariesText !== null) boundaryEditor.value = boundariesText;
if (groupsText !== null) groupEditor.value = groupsText;
syncEdgeEditor();
syncBoundaryEditor();
syncGroupEditor();
addEdgeButton.addEventListener("click", addEdge);
addBoundaryButton.addEventListener("click", addBoundary);
addGroupButton.addEventListener("click", addGroup);

wireEditorModeToggle({
  editor: edgeEditor,
  list: edgeList,
  addButton: addEdgeButton,
  visualButton: visualEdgeModeButton,
  sourceButton: rawEdgeModeButton,
  sourceMode: "raw",
  syncFromSource: syncEdgeEditor,
  syncToSource: () => {},
});
wireEditorModeToggle({
  editor: boundaryEditor,
  list: boundaryList,
  addButton: addBoundaryButton,
  visualButton: boundaryVisualModeButton,
  sourceButton: boundaryTextModeButton,
  sourceMode: "text",
  syncFromSource: syncBoundaryEditor,
  syncToSource: updateBoundarySourceText,
});
wireEditorModeToggle({
  editor: groupEditor,
  list: groupList,
  addButton: addGroupButton,
  visualButton: groupVisualModeButton,
  sourceButton: groupTextModeButton,
  sourceMode: "text",
  syncFromSource: syncGroupEditor,
  syncToSource: updateGroupSourceText,
});
document.querySelectorAll(".panel-section-toggle").forEach((toggle) => {
  const toggleSection = () => {
    const section = toggle.closest(".panel-section");
    const collapsed = section.classList.toggle("is-collapsed");
    toggle.setAttribute("aria-expanded", String(!collapsed));
    const title = section.querySelector("h2")?.textContent ?? "section";
    toggle.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${title} section`);
  };
  toggle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    toggleSection();
  });
  toggle.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleSection();
    }
  });
});
const settings = loadSettings();
document.documentElement.classList.toggle("dark", settings.darkMode);
themeToggle.setAttribute("aria-label", settings.darkMode ? "Enable light mode" : "Enable dark mode");
themeToggle.addEventListener("click", () => {
  const darkMode = document.documentElement.classList.toggle("dark");
  themeToggle.setAttribute("aria-label", darkMode ? "Enable light mode" : "Enable dark mode");
  persistSettings();
});
state.layoutMode = settings.layoutMode;
state.showBoundaryHulls = settings.showBoundaryHulls;
state.showGroups = settings.showGroups;
state.dagLevelSpacing = settings.dagLevelSpacing;
directedToggle.checked = settings.showArrows;
repulsionSlider.value = settings.repulsion;
dagSpacingSlider.value = state.dagLevelSpacing;
hullToggle.checked = state.showBoundaryHulls;
groupsToggle.checked = state.showGroups;
updateLayoutControlVisibility();
layoutModeButtons.forEach((button) => {
  const isActive = button.dataset.layoutMode === state.layoutMode;
  button.classList.toggle("is-active", isActive);
  button.setAttribute("aria-pressed", String(isActive));
});

setupCanvasInteraction({
  graph,
  graphWrap,
  fullscreenButton,
  zoomInButton,
  zoomOutButton,
  state,
});

// Use restartSimulation (not a bare draw()) so any restored graph settles
// gradually via the normal alpha decay, instead of sitting at raw spawn
// positions until the first user interaction triggers a full-strength,
// all-at-once physics burst.
restartSimulation();

loadTemplateManifest().catch(() => {
  templateList.textContent = "Couldn't load templates.";
});
