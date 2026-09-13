export function wireDialog({ dialog, openButton, closeButton, onOpen }) {
  openButton.addEventListener("click", () => {
    dialog.showModal();
    onOpen?.();
  });
  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}
