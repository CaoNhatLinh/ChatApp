const AUTH_ROUTES = new Set(['/login', '/register']);

const decodePath = (path: string): string => {
  let decoded = path;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decodeURIComponent(decoded);
    if (next === decoded) return decoded;
    decoded = next;
  }
  return decoded;
};

export const safeReturnPath = (requestedPath: string | null, fallback = '/friends'): string => {
  if (!requestedPath || !requestedPath.startsWith('/') || requestedPath.startsWith('//')) return fallback;
  if (requestedPath.includes('\\') || requestedPath.includes('\0')) return fallback;

  try {
    const parsed = new URL(requestedPath, 'https://noi.local');
    const decodedPath = decodePath(parsed.pathname);
    const normalizedPath = decodedPath.length > 1 ? decodedPath.replace(/\/+$/, '') : decodedPath;
    if (parsed.origin !== 'https://noi.local'
      || decodedPath.startsWith('//')
      || decodedPath.includes('\\')
      || decodedPath.includes('\0')
      || AUTH_ROUTES.has(normalizedPath)) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
};
