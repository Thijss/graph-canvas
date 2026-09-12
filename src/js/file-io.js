// File format helpers stay independent from the graph state and editor DOM.
export function splitGraphText(text) {
  const lines = text.split(/\r?\n/);
  const delimiters = lines
    .map((line, index) => {
      const marker = line.trim();
      if (marker === "-----STATIONS-----") return { index, type: "stations" };
      if (marker === "-----ROUTES-----") return { index, type: "routes" };
      return null;
    })
    .filter(Boolean);
  const stationsDelimiter = delimiters.find((delimiter) => delimiter.type === "stations");
  const routesDelimiter = delimiters.find((delimiter) => delimiter.type === "routes");
  return {
    edgesText: stationsDelimiter === undefined ? text.trim() : lines.slice(0, stationsDelimiter.index).join("\n").trim(),
    stationsText: stationsDelimiter === undefined
      ? ""
      : lines.slice(stationsDelimiter.index + 1, routesDelimiter?.index ?? lines.length).join("\n").trim(),
    routesText: routesDelimiter === undefined ? "" : lines.slice(routesDelimiter.index + 1).join("\n").trim(),
  };
}

export async function readGraphFile(file) {
  if (!/\.txt$/i.test(file.name)) throw new Error("Please choose a .txt file");
  return splitGraphText(await file.text());
}

export function downloadGraphFile(edgesText, stationsText, routesText, filename) {
  let content = edgesText ? `${edgesText}\n` : "";
  if (stationsText) content += `-----STATIONS-----\n${stationsText}\n`;
  if (routesText) content += `-----ROUTES-----\n${routesText}\n`;
  const downloadUrl = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = /\.txt$/i.test(filename) ? filename : `${filename}.txt`;
  link.click();
  URL.revokeObjectURL(downloadUrl);
}

function createExportSvg(svg) {
  const bounds = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  const contentBounds = svg.getBBox();
  const pixelsPerUnitX = bounds.width / viewBox.width;
  const pixelsPerUnitY = bounds.height / viewBox.height;
  const paddingX = 32 / pixelsPerUnitX;
  const paddingY = 32 / pixelsPerUnitY;
  const cropX = contentBounds.width ? contentBounds.x - paddingX : viewBox.x;
  const cropY = contentBounds.height ? contentBounds.y - paddingY : viewBox.y;
  const cropWidth = contentBounds.width ? contentBounds.width + paddingX * 2 : viewBox.width;
  const cropHeight = contentBounds.height ? contentBounds.height + paddingY * 2 : viewBox.height;
  const width = Math.max(1, Math.round(cropWidth * pixelsPerUnitX));
  const height = Math.max(1, Math.round(cropHeight * pixelsPerUnitY));
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("viewBox", `${cropX} ${cropY} ${cropWidth} ${cropHeight}`);
  clone.setAttribute("width", width);
  clone.setAttribute("height", height);
  clone.setAttribute("style", "background: white");

  const styles = document.createElementNS("http://www.w3.org/2000/svg", "style");
  styles.textContent = [...document.styleSheets]
    .flatMap((sheet) => [...sheet.cssRules])
    .map((rule) => rule.cssText)
    .join("\n");
  clone.prepend(styles);

  return {
    text: new XMLSerializer().serializeToString(clone),
    width,
    height,
  };
}

export function downloadGraphSvg(svg, filename = "graph.svg") {
  const { text } = createExportSvg(svg);
  const downloadUrl = URL.createObjectURL(new Blob([text], {
    type: "image/svg+xml",
  }));
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = /\.svg$/i.test(filename) ? filename : `${filename}.svg`;
  link.click();
  URL.revokeObjectURL(downloadUrl);
}

export function downloadGraphPng(svg, filename = "graph.png") {
  const { text, width, height } = createExportSvg(svg);
  const svgUrl = URL.createObjectURL(new Blob([text], {
    type: "image/svg+xml",
  }));
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(image, 0, 0, width, height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(svgUrl);
        if (!blob) {
          reject(new Error("Could not create PNG"));
          return;
        }
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = /\.png$/i.test(filename) ? filename : `${filename}.png`;
        link.click();
        URL.revokeObjectURL(downloadUrl);
        resolve();
      }, "image/png");
    };
    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      reject(new Error("Could not render graph as PNG"));
    };
    image.src = svgUrl;
  });
}
