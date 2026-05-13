import { useAuth } from "./Auth";
import { Scope } from "./_models";

/**
 * Convenience hook for permission checks inside components.
 *
 *   const can = useCan();
 *   {can('report.export', { i: instituteId }) && <ExportButton />}
 *
 * Equivalent to `const { can } = useAuth()` — exported separately so call sites
 * that only need permissions don't pull the full auth context shape.
 */
export function useCan(): (perm: string, scope?: Scope) => boolean {
  const { can } = useAuth();
  return can;
}
