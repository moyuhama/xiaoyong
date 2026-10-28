import { categories, tools } from "./tools";
import type { Tool } from "./tools";

// Stable shortcuts, independent of release order. The full directory remains below.
export const commonTools = [
  "datetime",
  "json",
  "image-compress",
  "id-photo",
  "image-ocr",
  "qrcode",
  "pdf-merge",
  "images-pdf",
  "text-clean",
  "text-diff",
  "encoding",
  "unit-converter",
].map((id) => tools.find((tool) => tool.id === id)!);

export function prioritizeTools(source: Tool[]) {
  const rank = (tool: Tool) => {
    const index = commonTools.findIndex((item) => item.id === tool.id);
    return index < 0 ? commonTools.length : index;
  };
  return [...source].sort((a, b) => rank(a) - rank(b));
}

export const toolGroups = categories
  .filter((category) => category.id !== "all")
  .map((category) => ({
    ...category,
    tools: prioritizeTools(
      tools.filter((tool) => tool.category === category.id),
    ),
  }));
