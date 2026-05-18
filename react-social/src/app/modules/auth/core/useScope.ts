import { Scope } from "./_models";

/**
 * Hook returning the currently-active scope (for multi-institute admins
 * who picked one institute from a dropdown).
 *
 * Phase 17 stub: returns undefined. The ScopeContext + active-institute
 * picker UI lands in a later phase (deferred per docs/AUTH_REDESIGN_PLAN.md
 * §6.2 "active-institute dropdown writes to a ScopeContext"). Call sites
 * that read this hook today get undefined and fall back to "no scope filter"
 * — which means `<Can perm="x">` checks the permission alone, matching
 * backend `allowed(user, perm, null, null, null, null)`.
 *
 * Backwards-compat note: the server is the only authority. Even if the
 * client passes a scope hint via this hook, the server re-validates from
 * the JWT/cookie. This hook is a UX affordance, not a security boundary.
 */
export function useScope(): Scope | undefined {
  return undefined;
}
