export const TASK_VIDEO_MAX_FILES = 3;
export const TASK_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const TASK_VIDEO_MAX_LINKS = 5;
export const TASK_VIDEO_ACCEPT = ".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm";
export const TASK_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;

export function parseTaskVideoLinks(value: unknown): string[] {
  if (value === undefined || value === null || value === "") return [];
  let entries: unknown = value;
  if (typeof value === "string") {
    entries = value.trim().startsWith("[") ? JSON.parse(value) : value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }
  if (!Array.isArray(entries) || entries.length > TASK_VIDEO_MAX_LINKS) throw new Error("Add up to 5 video links, one per line.");
  const links = entries.map((entry) => {
    if (typeof entry !== "string" || entry.length > 2048) throw new Error("Use a complete http:// or https:// video link.");
    let url: URL;
    try { url = new URL(entry.trim()); } catch { throw new Error("Use a complete http:// or https:// video link."); }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Use a complete http:// or https:// video link without a password in the URL.");
    return url.href;
  });
  return [...new Set(links)];
}
