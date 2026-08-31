export function validAuthOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export function normalizeTeacherEmail(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

export function validTeacherEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export function safeAuthReturnTo(value: string | null | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://classloop.local");
    if (url.origin !== "https://classloop.local") return "/";
    if (url.pathname.startsWith("/api/v1/auth/") || url.pathname === "/login") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
