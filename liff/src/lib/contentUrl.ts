const apiBase = import.meta.env.VITE_API_BASE ?? "/api";

function pageOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

function assetBaseFromApi(): string {
  if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
    return apiBase.replace(/\/api\/?$/, "");
  }
  return pageOrigin();
}

export function contentUrl(path: string): string {
  if (!path) return "";

  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      const url = new URL(path);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        const origin = assetBaseFromApi();
        if (origin) return `${origin}${url.pathname}`;
      }
    } catch {
      /* ignore invalid URL */
    }
    return path;
  }

  const base = assetBaseFromApi();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function needsNgrokFetch(url: string): boolean {
  return url.includes("ngrok-free.app") || url.includes("ngrok-free.dev") || url.includes("ngrok.io");
}

export function ngrokFetchHeaders(): HeadersInit {
  return { "ngrok-skip-browser-warning": "true" };
}
