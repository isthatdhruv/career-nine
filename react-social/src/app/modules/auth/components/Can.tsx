import { FC, ReactNode } from "react";
import { useAuth } from "../core/Auth";
import { Scope } from "../core/_models";

interface CanProps {
  perm: string;
  scope?: Scope;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Declarative permission gate.
 *
 *   <Can perm="report.export" scope={{ i: instituteId }}>
 *     <ExportButton />
 *   </Can>
 *
 * Renders children iff useAuth().can(perm, scope) returns true.
 * If a `fallback` is provided it is rendered on DENY; otherwise nothing
 * is rendered.
 *
 * Server is the source of truth — this only hides UI. Backend enforces
 * the same check (see AuthorizationService.allows in §3.4 of the auth
 * redesign plan).
 */
export const Can: FC<CanProps> = ({ perm, scope, fallback = null, children }) => {
  const { can } = useAuth();
  return <>{can(perm, scope) ? children : fallback}</>;
};
