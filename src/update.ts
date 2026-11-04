/** Asks the server which version is published now (bypassing caches). null if unknown. */
export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: unknown };
    return typeof data.version === 'string' ? data.version : null;
  } catch {
    return null;
  }
}

/** Reloads the page; the query string makes caches fetch the new index.html. */
export function reloadToVersion(version: string): void {
  location.replace(`${location.pathname}?v=${encodeURIComponent(version)}`);
}
