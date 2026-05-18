import { FC } from "react";

interface RequestAccessPageProps {
  /** The permission code that was denied — surfaced to the user so they can
   *  ask their admin for the exact grant. */
  perm?: string;
  /**
   * Which gate failed: the permission predicate or the per-role URL whitelist.
   * Defaults to `"permission"` (preserving the prior single-gate behavior).
   */
  reason?: "permission" | "url";
  /** Current pathname when the gate failed; defaults to window.location at render. */
  path?: string;
}

/**
 * Shown by <RequirePermission> when the user is authenticated but lacks the
 * permission for the requested route. NOT a bare 401 page — this surfaces
 * a remediation CTA per ROADMAP Phase 17 success criterion #8.
 *
 * Copy intentionally avoids security-jargon ("RBAC", "ABAC", "scope"). The
 * audience is an institute-admin user who doesn't know the difference.
 */
export const RequestAccessPage: FC<RequestAccessPageProps> = ({ perm, reason = "permission", path }) => {
  const effectivePath =
    path ?? (typeof window !== "undefined" ? window.location.pathname : "(unknown)");
  const mailtoSubject = encodeURIComponent(
    `Access request${perm ? ` — ${perm}` : ""}`
  );
  const mailtoBody = encodeURIComponent(
    `Hi,\n\nI need access to the following section of Career-9:\n\n` +
      `URL: ${effectivePath}\n` +
      (perm ? `Permission: ${perm}\n` : "") +
      `Gate that failed: ${reason === "url" ? "URL whitelist on my role" : "permission"}\n` +
      `\nThanks.`
  );

  return (
    <div className="d-flex flex-column flex-center text-center p-10" style={{ minHeight: "60vh" }}>
      <h1 className="fw-bolder fs-2hx text-gray-900 mb-4">Request access</h1>
      <div className="fw-semibold fs-6 text-gray-500 mb-7" style={{ maxWidth: 600 }}>
        Your account is signed in, but you don&apos;t have permission to view
        this page. If you believe this is a mistake, ask your administrator
        to grant you access.
        {perm && (
          <div className="mt-3 text-gray-700">
            <strong>Permission needed:</strong>{" "}
            <code className="px-2 py-1 bg-light-warning rounded">{perm}</code>
          </div>
        )}
        {reason === "url" && (
          <div className="mt-3 text-gray-700">
            <strong>URL not whitelisted on your role:</strong>{" "}
            <code className="px-2 py-1 bg-light-info rounded">{effectivePath}</code>
            <div className="text-gray-500 fs-7 mt-1">
              You hold the permission, but none of your roles list this URL in
              their access table. Ask your administrator to add it from
              Roles &amp; Permissions → URL Access.
            </div>
          </div>
        )}
      </div>
      <a
        href={`mailto:admin@career-9.net?subject=${mailtoSubject}&body=${mailtoBody}`}
        className="btn btn-primary"
      >
        Email administrator
      </a>
    </div>
  );
};
