// Auto-derivation of a role's URL whitelist from its permission set.
//
// Every admin page is wrapped in <RequirePermission perm="...">, and the
// build-time manifest (permissions-manifest.json, regenerated on every
// start/build by scripts/extract-perm-routes.js) records perm → [routes].
// A role that holds a permission should therefore be able to REACH the pages
// that permission gates — keeping the role_url whitelist hand-curated next to
// the permission list is what produced the "menu item missing / route blocked"
// drift this module eliminates.
//
// The whitelist still exists server-side (role_url) and still supports manual
// extras: any stored path that is NOT a manifest route is treated as a custom
// path (wildcards like /students/*, one-off deep links) and survives every
// re-derivation untouched.

export type CodeToRoutes = Record<string, string[]>;

/** Routes unlocked by the given permission codes, deduped and sorted. */
export function deriveUrlsForPerms(perms: string[], manifest: CodeToRoutes): string[] {
  const out = new Set<string>();
  for (const perm of perms) {
    for (const route of manifest[perm] || []) {
      out.add(route);
    }
  }
  return Array.from(out).sort();
}

/**
 * Split a role's stored URL list into { derived, custom }: a path is custom
 * iff it appears in NO manifest entry — those are the admin's hand-added
 * wildcards/deep-links and must survive re-derivation.
 */
export function splitCustomPaths(
  storedUrls: string[],
  manifest: CodeToRoutes
): { derived: string[]; custom: string[] } {
  const allManifestRoutes = new Set<string>();
  for (const routes of Object.values(manifest)) {
    for (const r of routes) allManifestRoutes.add(r);
  }
  const derived: string[] = [];
  const custom: string[] = [];
  for (const u of storedUrls) {
    (allManifestRoutes.has(u) ? derived : custom).push(u);
  }
  return { derived, custom };
}

/**
 * The URL list to persist for a role after its permissions change:
 * routes derived from the new permission set ∪ the custom paths already
 * stored on the role.
 */
export function nextUrlsAfterPermissionChange(
  newPerms: string[],
  storedUrls: string[],
  manifest: CodeToRoutes
): string[] {
  const { custom } = splitCustomPaths(storedUrls, manifest);
  const derived = deriveUrlsForPerms(newPerms, manifest);
  return Array.from(new Set([...derived, ...custom])).sort();
}
