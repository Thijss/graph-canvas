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
  saveButton,
  fileInput,
  saveDialog,
  saveDialogClose,
  saveDialogCancel,
  saveDialogBack,
  saveForm,
  saveFilename,
  saveDialogTitle,
  exportOptions,
  exportPngButton,
  exportSvgButton,
  exportTxtButton,
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
import { MIN_NODE_RADIUS } from "./config.js";
import { draw, restartSimulation } from "./engine.js";
import { updateBorderBump, clearBorderBump, updateEdgeErrors } from "./renderer.js";
import { loadSavedEditors, saveEditors, loadSettings, saveSettings } from "./persistence.js";
import { computeZoomedView, viewBoxString, screenToNodeSpace } from "./zoom.js";
import { readGraphFile, splitGraphText, downloadGraphFile, downloadGraphPng, downloadGraphSvg } from "./file-io.js";
import { addEdge, syncEdgeEditor } from "./edge-editor.js";
import { addBoundary, syncBoundaryEditor, updateBoundarySourceText } from "./boundary-editor.js";
import { addGroup, syncGroupEditor, updateGroupSourceText } from "./group-editor.js";

let exportFormat = "txt";

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

function applyViewBox() {
  graph.setAttribute("viewBox", viewBoxString(state.view, graph.getBoundingClientRect()));
}

function zoomFromCenter(deltaY) {
  const bounds = graph.getBoundingClientRect();
  state.view = computeZoomedView(state.view, deltaY, {
    x: bounds.width / 2,
    y: bounds.height / 2,
  });
  applyViewBox();
}

// Dragging empty canvas space pans the view. Node drag handles its own
// pointerdown (see renderer.js's drawNode) and doesn't stop propagation, so
// bail out here whenever the event originated on a node.
graph.addEventListener("pointerdown", (event) => {
  if (event.target.closest("[data-node]")) return;
  state.panning = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY };
  graphWrap.classList.add("panning");
});

window.addEventListener("pointermove", (event) => {
  if (state.panning && event.pointerId === state.panning.pointerId) {
    const dx = event.clientX - state.panning.lastX;
    const dy = event.clientY - state.panning.lastY;
    state.panning.lastX = event.clientX;
    state.panning.lastY = event.clientY;
    // Screen-space drag deltas need to be scaled back into node-coordinate
    // space by the current zoom level, same conversion as node dragging below.
    state.view = {
      ...state.view,
      x: state.view.x - dx / state.view.scale,
      y: state.view.y - dy / state.view.scale,
    };
    applyViewBox();
    return;
  }
  if (!state.dragging) return;
  const bounds = graph.getBoundingClientRect();
  const radius = state.nodeRadii.get(state.dragging.name) ?? MIN_NODE_RADIUS;
  const cursor = screenToNodeSpace(state.view, { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
  const viewWidth = bounds.width / state.view.scale;
  const viewHeight = bounds.height / state.view.scale;
  const x = Math.min(Math.max(cursor.x, state.view.x + radius), state.view.x + viewWidth - radius);
  const y = Math.min(Math.max(cursor.y, state.view.y + radius), state.view.y + viewHeight - radius);
  const node = state.positions.get(state.dragging.name);
  if (node) {
    node.x = x;
    node.y = y;
    // d3's fixed-position convention: while fx/fy are set, the simulation
    // leaves this node alone and just copies them into x/y every tick.
    node.fx = x;
    node.fy = y;
  }
  updateBorderBump(x, y, radius, {
    left: state.view.x,
    right: state.view.x + viewWidth,
    top: state.view.y,
    bottom: state.view.y + viewHeight,
  });
  if (state.layoutMode === "physics") {
    state.simulation?.alpha(Math.max(state.simulation.alpha(), 0.3)).restart();
  } else {
    draw(); // physics off: just re-render the dragged node at its new spot
  }
});
window.addEventListener("pointerup", () => {
  if (state.panning) {
    state.panning = null;
    graphWrap.classList.remove("panning");
  }
  if (!state.dragging) return;
  const node = state.positions.get(state.dragging.name);
  // Only release back to physics control if the node wasn't explicitly
  // pinned (double-clicked) — pinned nodes keep fx/fy set indefinitely.
  if (node && !state.pinnedNodes.has(state.dragging.name)) {
    node.fx = null;
    node.fy = null;
  }
  state.dragging = null;
  clearBorderBump();
  restartSimulation(0.3); // gently settle the released node back into place
});

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
templateButton.addEventListener("click", () => templateDialog.showModal());
let helpLoaded = false;
helpButton.addEventListener("click", async () => {
  helpDialog.showModal();
  if (helpLoaded) return;
  try {
    const response = await fetch("content/help.html");
    if (!response.ok) throw new Error("Could not load help");
    helpContent.innerHTML = await response.text();
    helpLoaded = true;
  } catch {
    helpContent.textContent = "Could not load help content.";
  }
});
helpDialogClose.addEventListener("click", () => helpDialog.close());
helpDialog.addEventListener("click", (event) => {
  if (event.target === helpDialog) helpDialog.close();
});
openButton.addEventListener("click", () => fileInput.click());
saveButton.addEventListener("click", () => {
  exportFormat = "txt";
  saveDialogTitle.textContent = "Choose export format";
  exportOptions.hidden = false;
  saveForm.hidden = true;
  saveDialog.showModal();
});
saveDialogClose.addEventListener("click", () => saveDialog.close());
saveDialogCancel.addEventListener("click", () => saveDialog.close());
saveDialogBack.addEventListener("click", () => {
  saveDialogTitle.textContent = "Choose export format";
  exportOptions.hidden = false;
  saveForm.hidden = true;
});
function chooseExportFormat(format) {
  exportFormat = format;
  saveDialogTitle.textContent = "Choose a file name";
  exportOptions.hidden = true;
  saveForm.hidden = false;
  saveFilename.value = `graph.${format}`;
  saveFilename.select();
}
exportTxtButton.addEventListener("click", () => chooseExportFormat("txt"));
exportPngButton.addEventListener("click", () => chooseExportFormat("png"));
exportSvgButton.addEventListener("click", () => chooseExportFormat("svg"));
saveForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const filename = saveFilename.value.trim();
  if (!filename) return;
  try {
    if (exportFormat === "png") {
      await downloadGraphPng(graph, filename);
    } else if (exportFormat === "svg") {
      downloadGraphSvg(graph, filename);
    } else {
      downloadGraphFile(edgeEditor.value.trim(), boundaryEditor.value.trim(), groupEditor.value.trim(), filename);
    }
    saveDialog.close();
  } catch (error) {
    statusText.textContent = `Couldn't export ${exportFormat.toUpperCase()}: ${error.message}`;
  }
});
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
templateDialogClose.addEventListener("click", () => templateDialog.close());
templateList.addEventListener("click", (event) => {
  const option = event.target.closest("[data-template]");
  if (option) {
    templateDialog.close();
    loadTemplate(option.dataset.template);
  }
});
templateDialog.addEventListener("click", (event) => {
  if (event.target === templateDialog) templateDialog.close();
});
disclaimerButton.addEventListener("click", () => disclaimerDialog.showModal());
disclaimerDialogClose.addEventListener("click", () => disclaimerDialog.close());
disclaimerDialog.addEventListener("click", (event) => {
  if (event.target === disclaimerDialog) disclaimerDialog.close();
});
async function showLicense() {
  licenseDialog.showModal();
  try {
    const response = await fetch("LICENSE");
    if (!response.ok) throw new Error("Could not load license");
    licenseContent.textContent = await response.text();
  } catch {
    licenseContent.textContent = "Could not load the license.";
  }
}
licenseButton.addEventListener("click", showLicense);
licenseDialogClose.addEventListener("click", () => licenseDialog.close());
licenseDialog.addEventListener("click", (event) => {
  if (event.target === licenseDialog) licenseDialog.close();
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
window.addEventListener("resize", () => {
  applyViewBox(); // keep the viewBox's width/height in sync with the resized canvas box
  restartSimulation(0.5);
});

fullscreenButton.addEventListener("click", () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    graphWrap.requestFullscreen?.();
  }
});
zoomInButton.addEventListener("click", () => zoomFromCenter(-30));
zoomOutButton.addEventListener("click", () => zoomFromCenter(30));
document.addEventListener("fullscreenchange", () => {
  const isFullscreen = document.fullscreenElement === graphWrap;
  fullscreenButton.textContent = isFullscreen ? "⤦" : "⛶";
  fullscreenButton.setAttribute("aria-label", isFullscreen ? "Exit fullscreen" : "Toggle fullscreen");
  applyViewBox(); // canvas box size just changed, keep the current pan/zoom in sync with it
  restartSimulation(0.4); // canvas size changed, let physics resettle
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

function setEdgeEditorMode(mode) {
  const isRaw = mode === "raw";
  edgeEditor.classList.toggle("is-raw", isRaw);
  edgeEditor.setAttribute("aria-hidden", String(!isRaw));
  edgeEditor.tabIndex = isRaw ? 0 : -1;
  edgeList.hidden = isRaw;
  addEdgeButton.hidden = isRaw;
  visualEdgeModeButton.classList.toggle("is-active", !isRaw);
  rawEdgeModeButton.classList.toggle("is-active", isRaw);
  visualEdgeModeButton.setAttribute("aria-pressed", String(!isRaw));
  rawEdgeModeButton.setAttribute("aria-pressed", String(isRaw));
  if (isRaw) edgeEditor.focus();
  else syncEdgeEditor();
}
visualEdgeModeButton.addEventListener("click", () => setEdgeEditorMode("visual"));
rawEdgeModeButton.addEventListener("click", () => setEdgeEditorMode("raw"));

function setBoundaryEditorMode(mode) {
  const isText = mode === "text";
  boundaryEditor.classList.toggle("is-text", isText);
  boundaryEditor.setAttribute("aria-hidden", String(!isText));
  boundaryEditor.tabIndex = isText ? 0 : -1;
  boundaryList.hidden = isText;
  addBoundaryButton.hidden = isText;
  boundaryVisualModeButton.classList.toggle("is-active", !isText);
  boundaryTextModeButton.classList.toggle("is-active", isText);
  boundaryVisualModeButton.setAttribute("aria-pressed", String(!isText));
  boundaryTextModeButton.setAttribute("aria-pressed", String(isText));
  if (isText) {
    updateBoundarySourceText();
    boundaryEditor.focus();
  }
  else syncBoundaryEditor();
}
boundaryVisualModeButton.addEventListener("click", () => setBoundaryEditorMode("visual"));
boundaryTextModeButton.addEventListener("click", () => setBoundaryEditorMode("text"));
function setGroupEditorMode(mode) {
  const isText = mode === "text";
  groupEditor.classList.toggle("is-text", isText);
  groupEditor.setAttribute("aria-hidden", String(!isText));
  groupEditor.tabIndex = isText ? 0 : -1;
  groupList.hidden = isText;
  addGroupButton.hidden = isText;
  groupVisualModeButton.classList.toggle("is-active", !isText);
  groupTextModeButton.classList.toggle("is-active", isText);
  groupVisualModeButton.setAttribute("aria-pressed", String(!isText));
  groupTextModeButton.setAttribute("aria-pressed", String(isText));
  if (isText) {
    updateGroupSourceText();
    groupEditor.focus();
  } else syncGroupEditor();
}
groupVisualModeButton.addEventListener("click", () => setGroupEditorMode("visual"));
groupTextModeButton.addEventListener("click", () => setGroupEditorMode("text"));
document.querySelectorAll(".panel-section-toggle").forEach((toggle) => {
  const toggleSection = () => {
    const section = toggle.closest(".panel-section");
    const collapsed = section.classList.toggle("is-collapsed");
    toggle.setAttribute("aria-expanded", String(!collapsed));
    const title = section.querySelector("h2")?.textContent ?? "section";
    toggle.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${title} section`);
  };
  toggle.addEventListener("click", toggleSection);
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

applyViewBox(); // start at the identity viewBox (no pan/zoom applied yet)

// Use restartSimulation (not a bare draw()) so any restored graph settles
// gradually via the normal alpha decay, instead of sitting at raw spawn
// positions until the first user interaction triggers a full-strength,
// all-at-once physics burst.
restartSimulation();

loadTemplateManifest().catch(() => {
  templateList.textContent = "Couldn't load templates.";
});
