// File format helpers stay independent from the graph state and editor DOM.
export function splitGraphText(text) {
  const lines = text.split(/\r?\n/);
  const delimiterIndex = lines.findIndex((line) => line.trim() === "----------");
  return {
    edgesText: delimiterIndex === -1 ? text.trim() : lines.slice(0, delimiterIndex).join("\n").trim(),
    stationsText: delimiterIndex === -1 ? "" : lines.slice(delimiterIndex + 1).join("\n").trim(),
  };
}

export async function readGraphFile(file) {
  if (!/\.txt$/i.test(file.name)) throw new Error("Please choose a .txt file");
  return splitGraphText(await file.text());
}

export function downloadGraphFile(edgesText, stationsText, filename) {
  const content = stationsText
    ? `${edgesText}\n----------\n${stationsText}\n`
    : `${edgesText}\n`;
  const downloadUrl = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = /\.txt$/i.test(filename) ? filename : `${filename}.txt`;
  link.click();
  URL.revokeObjectURL(downloadUrl);
}
