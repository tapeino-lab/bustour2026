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

const RELOADED_KEY = 'bustour2026.reloadedTo';

/**
 * Reloads into `version`, keeping the other URL options (e.g. ?admin=1); the v= parameter makes
 * caches fetch the new index.html. Returns false (and does nothing) if we already reloaded for this
 * version in this tab, so a stale cache can never cause a reload loop.
 */
export function reloadToVersion(version: string): boolean {
  try {
    if (sessionStorage.getItem(RELOADED_KEY) === version) return false;
    sessionStorage.setItem(RELOADED_KEY, version);
  } catch {
    // Without session storage we still reload; the version check below stops a second attempt.
  }
  const url = new URL(location.href);
  if (url.searchParams.get('v') === version) return false;
  url.searchParams.set('v', version);
  location.replace(url.toString());
  return true;
}
