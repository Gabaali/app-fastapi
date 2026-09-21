import { createClient } from "@/lib/supabase/client";

const LOCAL_API_URL = (
  process.env.NEXT_PUBLIC_LOCAL_API_URL ??
  "http://localhost:8000"
).replace(/\/+$/, "");

const REMOTE_API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? ""
).replace(/\/+$/, "");

type ApiTarget = "local" | "remote";

export function getApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return REMOTE_API_URL || LOCAL_API_URL;
  }

  const forcedTarget =
    window.localStorage.getItem("tcg_api_target");

  if (forcedTarget === "remote") {
    return REMOTE_API_URL;
  }

  if (forcedTarget === "local") {
    return `http://${window.location.hostname}:8000`;
  }

  // En développement :
  // localhost:3000      -> localhost:8000
  // 192.168.1.37:3000  -> 192.168.1.37:8000
  if (
    process.env.NODE_ENV === "development"
  ) {
    return `http://${window.location.hostname}:8000`;
  }

  // En production Vercel -> Railway
  return REMOTE_API_URL;
}

export function setApiTarget(
  target: ApiTarget | "auto",
) {
  if (typeof window === "undefined") {
    return;
  }

  if (target === "auto") {
    window.localStorage.removeItem(
      "tcg_api_target",
    );
  } else {
    window.localStorage.setItem(
      "tcg_api_target",
      target,
    );
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(
    options.headers,
  );

  if (
    options.body &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  if (session?.access_token) {
    headers.set(
      "Authorization",
      `Bearer ${session.access_token}`,
    );
  }

  const baseUrl = getApiBaseUrl();

  if (!baseUrl) {
    throw new Error(
      "URL de l'API non configurée.",
    );
  }

  const cleanPath = path.startsWith("/")
    ? path
    : `/${path}`;

  const response = await fetch(
    `${baseUrl}${cleanPath}`,
    {
      ...options,
      headers,
    },
  );

  if (!response.ok) {
    let message =
      `Erreur API ${response.status}`;

    try {
      const data = await response.json();

      message =
        data.detail ??
        data.message ??
        message;
    } catch {
      // La réponse n'est pas du JSON.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}