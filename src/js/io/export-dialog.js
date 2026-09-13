import {
  saveButton,
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
} from "../dom.js";
import { downloadGraphFile, downloadGraphPng, downloadGraphSvg } from "./file-io.js";

export function setupExportDialog({ graph, edgeEditor, boundaryEditor, groupEditor, statusText }) {
  let exportFormat = "txt";

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

  const chooseExportFormat = (format) => {
    exportFormat = format;
    saveDialogTitle.textContent = "Choose a file name";
    exportOptions.hidden = true;
    saveForm.hidden = false;
    saveFilename.value = `graph.${format}`;
    saveFilename.select();
  };
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
}
