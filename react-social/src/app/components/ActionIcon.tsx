import React from "react";
import { KTSVG } from "../../_metronic/helpers";

export type ActionType =
  | "edit"
  | "delete"
  | "view"
  | "add"
  | "approve"
  | "reject"
  | "refresh"
  | "download"
  | "upload"
  | "send"
  | "copy"
  | "lock"
  | "unlock"
  | "settings"
  | "search"
  | "info"
  | "warning"
  | "filter"
  | "pdf"
  | "excel";

type IconSpec = {
  path: string;
  color: string;
  label: string;
};

const ICON_MAP: Record<ActionType, IconSpec> = {
  edit:     { path: "/media/icons/duotune/art/art003.svg",       color: "#2563eb", label: "Edit" },
  delete:   { path: "/media/icons/duotune/general/gen027.svg",   color: "#dc2626", label: "Delete" },
  view:     { path: "/media/icons/duotune/general/gen004.svg",   color: "#475569", label: "View" },
  add:      { path: "/media/icons/duotune/general/gen035.svg",   color: "#059669", label: "Add" },
  approve:  { path: "/media/icons/duotune/general/gen037.svg",   color: "#059669", label: "Approve" },
  reject:   { path: "/media/icons/duotune/general/gen034.svg",   color: "#dc2626", label: "Reject" },
  refresh:  { path: "/media/icons/duotune/arrows/arr029.svg",    color: "#0891b2", label: "Refresh" },
  download: { path: "/media/icons/duotune/arrows/arr044.svg",    color: "#0891b2", label: "Download" },
  upload:   { path: "/media/icons/duotune/arrows/arr078.svg",    color: "#0891b2", label: "Upload" },
  send:     { path: "/media/icons/duotune/communication/com002.svg", color: "#2563eb", label: "Send" },
  copy:     { path: "/media/icons/duotune/general/gen028.svg",   color: "#475569", label: "Copy" },
  lock:     { path: "/media/icons/duotune/general/gen047.svg",   color: "#d97706", label: "Lock" },
  unlock:   { path: "/media/icons/duotune/general/gen047.svg",   color: "#059669", label: "Unlock" },
  settings: { path: "/media/icons/duotune/coding/cod009.svg",    color: "#475569", label: "Settings" },
  search:   { path: "/media/icons/duotune/general/gen021.svg",   color: "#475569", label: "Search" },
  info:     { path: "/media/icons/duotune/general/gen045.svg",   color: "#0891b2", label: "Info" },
  warning:  { path: "/media/icons/duotune/general/gen044.svg",   color: "#d97706", label: "Warning" },
  filter:   { path: "/media/icons/duotune/general/gen031.svg",   color: "#475569", label: "Filter" },
  pdf:      { path: "/media/icons/duotune/files/fil003.svg",     color: "#dc2626", label: "Download PDF" },
  excel:    { path: "/media/icons/duotune/files/fil009.svg",     color: "#059669", label: "Download Excel" },
};

const SIZE_MAP = {
  sm: "svg-icon-2",
  md: "svg-icon-1",
  lg: "svg-icon-1hx",
};

const ActionIconStyles: React.FC = () => (
  <style>{`
    .action-icon { display: inline-flex; align-items: center; justify-content: center; line-height: 0; }
    .action-icon svg path { opacity: 1 !important; fill: currentColor !important; }
  `}</style>
);

type Props = {
  type: ActionType;
  size?: "sm" | "md" | "lg";
  color?: string;
  className?: string;
  title?: string;
};

export const ActionIcon: React.FC<Props> = ({
  type,
  size = "md",
  color,
  className = "",
  title,
}) => {
  const spec = ICON_MAP[type];
  const finalColor = color ?? spec.color;
  return (
    <>
      <ActionIconStyles />
      <span
        title={title ?? spec.label}
        className={`action-icon svg-icon ${SIZE_MAP[size]} ${className}`}
        style={{ color: finalColor }}
      >
        <KTSVG path={spec.path} />
      </span>
    </>
  );
};

type BtnProps = Props & {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  loading?: boolean;
  btnClassName?: string;
};

export const ActionIconButton: React.FC<BtnProps> = ({
  type,
  size = "md",
  color,
  className = "",
  title,
  onClick,
  disabled,
  loading,
  btnClassName = "",
}) => {
  const spec = ICON_MAP[type];
  const finalColor = color ?? spec.color;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={title ?? spec.label}
      className={`btn btn-icon btn-sm btn-light-${mapToBootstrapVariant(type)} ${btnClassName}`}
      style={{ color: finalColor }}
    >
      {loading ? (
        <span className="spinner-border spinner-border-sm" style={{ width: 14, height: 14 }} />
      ) : (
        <ActionIcon type={type} size={size} color={finalColor} className={className} />
      )}
    </button>
  );
};

function mapToBootstrapVariant(type: ActionType): string {
  switch (type) {
    case "edit":
    case "send":
      return "primary";
    case "delete":
    case "reject":
    case "pdf":
      return "danger";
    case "add":
    case "approve":
    case "unlock":
    case "excel":
      return "success";
    case "lock":
    case "warning":
      return "warning";
    case "refresh":
    case "download":
    case "upload":
    case "info":
      return "info";
    case "view":
    case "copy":
    case "settings":
    case "search":
    case "filter":
    default:
      return "secondary";
  }
}

export default ActionIcon;
