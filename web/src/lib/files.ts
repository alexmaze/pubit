export const TEXT_EXTS = new Set([".html", ".htm", ".css", ".js", ".mjs", ".ts", ".tsx", ".json", ".md", ".txt", ".svg", ".xml", ".yml", ".yaml", ".toml", ".map", ".env"]);
export const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".avif"]);

export function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export function isTextPath(name: string) {
  return TEXT_EXTS.has(extOf(name));
}

export function isImagePath(name: string) {
  return IMAGE_EXTS.has(extOf(name));
}

export function isZipFile(file: File) {
  return file.name.toLowerCase().endsWith(".zip") || file.type === "application/zip";
}

export function joinPath(...parts: string[]) {
  return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}
