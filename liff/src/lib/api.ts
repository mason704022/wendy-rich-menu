export const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      ...options?.headers,
    },
    ...options,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      res.status === 413
        ? "圖片太大，請選較小的照片或重新拍攝"
        : typeof body.message === "string"
          ? body.message
          : typeof body.error === "string"
            ? body.error === "API_NOT_FOUND"
              ? "後端 API 不存在，請確認 server 已重啟且 ngrok 指向正確"
              : body.error === "IMAGE_TOO_LARGE"
                ? "圖片太大，請選較小的照片"
                : body.error
            : `HTTP ${res.status}`;
    throw new Error(message);
  }

  return body as T;
}

export async function apiOptional<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_BASE}${path}`);
  if (res.status === 404) return null;
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}
