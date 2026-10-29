export type Site = {
  slug: string;
  name: string;
  description: string;
  author: string;
  short_code: string;
  http_enabled: boolean;
  has_password: boolean;
  spa_fallback: boolean;
  created_at: string;
  updated_at: string;
  url: string;
  short_url?: string;
  dav_url: string;
  file_count: number;
  byte_size: number;
};

export type FileEntry = {
  name: string;
  path: string;
  dir: boolean;
  size: number;
  children?: FileEntry[];
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, { ...init, headers, credentials: "include" });
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const data = await res.json();
    if (!res.ok) throw new ApiError(res.status, data.error || res.statusText);
    return data as T;
  }
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return undefined as T;
}

export const api = {
  health: () => req<{ ok: boolean }>("/api/health"),
  me: () => req<{ user: string; base_url: string }>("/api/me"),
  login: (username: string, password: string) =>
    req<{ user: string }>("/api/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => req<{ ok: boolean }>("/api/logout", { method: "POST" }),
  sites: () => req<{ sites: Site[] }>("/api/sites"),
  getSite: (slug: string) => req<Site>(`/api/sites/${slug}`),
  createSite: (body: {
    slug: string;
    name?: string;
    description?: string;
    author?: string;
    short_code?: string;
    http_enabled?: boolean;
    password?: string;
    spa_fallback?: boolean;
  }) => req<Site>("/api/sites", { method: "POST", body: JSON.stringify(body) }),
  updateSite: (
    slug: string,
    body: {
      name?: string;
      description?: string;
      author?: string;
      short_code?: string;
      http_enabled?: boolean;
      password?: string;
      clear_password?: boolean;
      spa_fallback?: boolean;
    },
  ) => req<Site>(`/api/sites/${slug}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteSite: (slug: string) => req<{ ok: boolean }>(`/api/sites/${slug}`, { method: "DELETE" }),
  files: (slug: string, path = "") =>
    req<{ path: string; entries: FileEntry[] }>(`/api/sites/${slug}/files?path=${encodeURIComponent(path)}`),
  tree: (slug: string) =>
    req<{ entries: FileEntry[]; file_count: number; byte_size: number }>(`/api/sites/${slug}/tree`),
  mkdir: (slug: string, path: string) =>
    req<{ ok: boolean }>(`/api/sites/${slug}/files`, { method: "PUT", body: JSON.stringify({ path, dir: true }) }),
  writeFile: (slug: string, path: string, content: string) =>
    req<{ ok: boolean }>(`/api/sites/${slug}/files`, { method: "PUT", body: JSON.stringify({ path, content }) }),
  upload: (slug: string, file: File, dest = "") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("path", dest);
    return req<{ ok: boolean; path: string }>(`/api/sites/${slug}/files`, { method: "POST", body: fd });
  },
  deleteFile: (slug: string, path: string) =>
    req<{ ok: boolean }>(`/api/sites/${slug}/files?path=${encodeURIComponent(path)}`, { method: "DELETE" }),
  content: (slug: string, path: string) =>
    req<{ path: string; content: string }>(`/api/sites/${slug}/content?path=${encodeURIComponent(path)}`),
  importZip: (slug: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return req<{ ok: boolean }>(`/api/sites/${slug}/import`, { method: "POST", body: fd });
  },
  exportZip: async (slug: string) => {
    const res = await fetch(`/api/sites/${slug}/export`, { credentials: "include" });
    if (!res.ok) throw new ApiError(res.status, "export failed");
    return res.blob();
  },
};

export function adminPreviewUrl(slug: string, path = "") {
  const rel = path.replace(/^\/+/, "");
  return `/api/sites/${slug}/preview/${rel}`;
}

export function publicPreviewUrl(site: Site, path = "") {
  if (site.http_enabled && !site.has_password) {
    return site.url + path.replace(/^\/+/, "");
  }
  return adminPreviewUrl(site.slug, path);
}
