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

export function safeAuthReturnTo(
  value: string | null | undefined,
  options: { reserved?: string[]; baseOrigin?: string } = {},
) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  const { reserved = ["/api/v1/auth/", "/login"], baseOrigin = "https://boardrun.local" } = options;
  try {
    const url = new URL(value, baseOrigin);
    if (url.origin !== baseOrigin) return "/";
    if (reserved.some((path) => path === url.pathname || url.pathname.startsWith(path))) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
