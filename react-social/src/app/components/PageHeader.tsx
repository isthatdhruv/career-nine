import { FC, ReactNode } from "react";
import { ActionIcon, ActionType } from "./ActionIcon";

const ICON_CLASS_TO_ACTION: Record<string, ActionType> = {
  "bi-plus-lg": "add",
  "bi-plus": "add",
  "bi-plus-circle-fill": "add",
  "bi-plus-circle": "add",
  "bi-pencil-fill": "edit",
  "bi-pencil-square": "edit",
  "bi-pencil": "edit",
  "bi-trash-fill": "delete",
  "bi-trash3-fill": "delete",
  "bi-trash": "delete",
  "bi-eye-fill": "view",
  "bi-eye": "view",
  "bi-download": "download",
  "bi-cloud-arrow-down-fill": "download",
  "bi-file-earmark-arrow-down-fill": "download",
  "bi-file-earmark-arrow-down": "download",
  "bi-upload": "upload",
  "bi-cloud-arrow-up-fill": "upload",
  "bi-file-earmark-arrow-up-fill": "upload",
  "bi-file-earmark-arrow-up": "upload",
  "bi-arrow-clockwise": "refresh",
  "bi-arrow-repeat": "refresh",
  "bi-arrow-counterclockwise": "refresh",
  "bi-send-fill": "send",
  "bi-send": "send",
  "bi-envelope-fill": "send",
  "bi-envelope": "send",
  "bi-check-lg": "approve",
  "bi-check-circle-fill": "approve",
  "bi-check2-circle": "approve",
  "bi-check2": "approve",
  "bi-check": "approve",
  "bi-x-lg": "reject",
  "bi-x-circle-fill": "reject",
  "bi-x-circle": "reject",
  "bi-funnel-fill": "filter",
  "bi-funnel": "filter",
  "bi-gear-fill": "settings",
  "bi-gear": "settings",
  "bi-info-circle-fill": "info",
  "bi-info-circle": "info",
  "bi-exclamation-triangle-fill": "warning",
  "bi-exclamation-circle-fill": "warning",
  "bi-filetype-pdf": "pdf",
  "bi-file-earmark-pdf-fill": "pdf",
  "bi-file-earmark-pdf": "pdf",
  "bi-file-earmark-excel-fill": "excel",
  "bi-file-earmark-excel": "excel",
  "bi-filetype-xlsx": "excel",
  "bi-file-earmark-spreadsheet": "excel",
  "bi-lock-fill": "lock",
  "bi-lock": "lock",
  "bi-unlock-fill": "unlock",
  "bi-unlock": "unlock",
  "bi-files": "copy",
  "bi-copy": "copy",
  "bi-recycle": "delete",
};

function iconClassToAction(cls?: string): ActionType | null {
  if (!cls) return null;
  const normalized = cls.trim().split(/\s+/).find((t) => t.startsWith("bi-"));
  if (!normalized) return null;
  return ICON_CLASS_TO_ACTION[normalized] ?? null;
}

/**
 * Shared dark-slate page header used across admin pages.
 * Matches the admin dashboard's hero visual language:
 *  - Slate gradient with rose glow + subtle grid pattern
 *  - Rose-tinted icon tile
 *  - Bold title + subtitle
 *  - Action slot on the right
 *
 * Usage:
 *   <PageHeader
 *     icon={<i className="bi bi-clipboard-check" />}
 *     title="Assessments"
 *     subtitle={`${count} assessments · ${active} active`}
 *     actions={[
 *       { label: "Add", iconClass: "bi-plus-lg", onClick: ..., variant: "primary" },
 *       { label: "Export", iconClass: "bi-download", onClick: ..., variant: "ghost" },
 *     ]}
 *   />
 */

export type PageHeaderAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  iconClass?: string; // Bootstrap Icons class e.g. "bi-plus-lg" — auto-mapped to duotone
  actionType?: ActionType; // Explicit duotone ActionIcon type (takes precedence over iconClass)
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
};

const PageHeader: FC<{
  icon?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  actions?: PageHeaderAction[];
  children?: ReactNode;
}> = ({ icon, title, subtitle, actions, children }) => (
  <>
    <PageHeaderStyles />
    <div className="ph-header">
      <div className="ph-grid" />
      <div className="ph-glow" />
      <div className="ph-content">
        <div className="ph-left">
          {icon && <div className="ph-icon-tile">{icon}</div>}
          <div>
            <h1 className="ph-title">{title}</h1>
            {subtitle && <div className="ph-subtitle">{subtitle}</div>}
          </div>
        </div>

        {actions && actions.length > 0 && (
          <div className="ph-actions">
            {actions.map((a, i) => {
              const variant = a.variant || "ghost";
              const className = `ph-btn ph-btn-${variant}`;
              const resolvedType = a.actionType ?? iconClassToAction(a.iconClass);
              const iconOnDark = variant === "primary" ? undefined : "#ffffff";
              const content = (
                <>
                  {resolvedType ? (
                    <ActionIcon type={resolvedType} size="sm" color={iconOnDark} />
                  ) : a.iconClass ? (
                    <i className={`bi ${a.iconClass}`} />
                  ) : null}
                  <span>{a.label}</span>
                </>
              );
              if (a.href) {
                return (
                  <a key={i} href={a.href} className={className}>
                    {content}
                  </a>
                );
              }
              return (
                <button
                  key={i}
                  type="button"
                  onClick={a.onClick}
                  disabled={a.disabled}
                  className={className}
                >
                  {content}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {children && <div className="ph-extra">{children}</div>}
    </div>
  </>
);

const PageHeaderStyles: FC = () => (
  <style>{`
    .ph-header {
      position: relative;
      border-radius: 16px;
      overflow: hidden;
      background:
        radial-gradient(900px 300px at 90% -30%, rgba(244,63,94,0.12), transparent 60%),
        linear-gradient(135deg, #0f172a 0%, #1a2238 50%, #1e293b 100%);
      color: #ffffff;
      padding: 26px 30px;
      margin-bottom: 20px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .ph-grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
      background-size: 36px 36px;
      mask-image: radial-gradient(ellipse at center, black 40%, transparent 85%);
      -webkit-mask-image: radial-gradient(ellipse at center, black 40%, transparent 85%);
      pointer-events: none;
    }
    .ph-glow {
      position: absolute;
      top: -100px; right: -60px;
      width: 280px; height: 280px;
      border-radius: 50%;
      filter: blur(60px);
      background: radial-gradient(closest-side, rgba(244,63,94,0.22), transparent);
      pointer-events: none;
    }
    .ph-content {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
    }
    .ph-left {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }
    .ph-icon-tile {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(244,63,94,0.18), rgba(244,63,94,0.05));
      border: 1px solid rgba(244,63,94,0.25);
      color: #fda4af;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 18px;
    }
    .ph-icon-tile .bi { line-height: 1; }
    .ph-title {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.025em;
      color: #ffffff;
      margin: 0;
      line-height: 1.2;
    }
    .ph-subtitle {
      font-size: 13px;
      color: rgba(255,255,255,0.7);
      margin-top: 3px;
      font-weight: 500;
    }
    .ph-subtitle strong {
      color: #ffffff;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .ph-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .ph-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 14px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: -0.005em;
      cursor: pointer;
      transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1);
      border: 1px solid transparent;
      text-decoration: none;
      white-space: nowrap;
      font-family: inherit;
      line-height: 1;
    }
    .ph-btn .bi { font-size: 14px; }
    .ph-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .ph-btn-primary {
      background: #ffffff;
      color: #0f172a;
      box-shadow: 0 2px 6px rgba(0,0,0,0.18);
    }
    .ph-btn-primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(0,0,0,0.25);
      background: #f8fafc;
      color: #0f172a;
    }
    .ph-btn-ghost {
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.9);
      border: 1px solid rgba(255,255,255,0.14);
      backdrop-filter: blur(8px);
    }
    .ph-btn-ghost:hover:not(:disabled) {
      background: rgba(255,255,255,0.12);
      border-color: rgba(255,255,255,0.24);
      color: #ffffff;
    }
    .ph-btn-danger {
      background: rgba(244,63,94,0.12);
      color: rgba(253,164,175,0.95);
      border: 1px solid rgba(244,63,94,0.25);
    }
    .ph-btn-danger:hover:not(:disabled) {
      background: rgba(244,63,94,0.2);
      border-color: rgba(244,63,94,0.4);
      color: #fecdd3;
    }
    .ph-extra {
      position: relative;
      margin-top: 18px;
    }
    @media (max-width: 720px) {
      .ph-header { padding: 20px; }
      .ph-actions { width: 100%; }
      .ph-btn { flex: 1 1 auto; justify-content: center; }
    }

    /* Page wrapper helper — apply to the page root to match dashboard look */
    .ph-page {
      background: #fafafa;
      min-height: 100vh;
      margin: -30px -40px -60px;
      padding: 28px 32px 56px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
    }
    /* Break out of Metronic's max-width container */
    body:has(.ph-page) #kt_app_content,
    body:has(.ph-page) #kt_app_content_container,
    body:has(.ph-page) .app-content,
    body:has(.ph-page) .app-content-container,
    body:has(.ph-page) .container,
    body:has(.ph-page) .container-xxl,
    body:has(.ph-page) .container-fluid {
      max-width: none !important;
    }
  `}</style>
);

export default PageHeader;
