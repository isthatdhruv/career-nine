import React from "react";
import SVG from "react-inlinesvg";
import { toAbsoluteUrl } from "../AssetHelpers";
type Props = {
  className?: string;
  path: string;
  svgClassName?: string;
  /**
   * Inline styles for the icon span. Chiefly for colour: the icons fill with
   * currentColor, and `.svg-icon` sets `color: var(--kt-text-muted)` on this very
   * span, so a colour inherited from a parent never reaches the glyph. Theme
   * colours have classes (`svg-icon-warning`); anything outside the palette has
   * to be set here, on the element the class rule targets.
   */
  style?: React.CSSProperties;
};

const KTSVG: React.FC<Props> = ({
  className = "",
  path,
  svgClassName = "mh-50px",
  style,
}) => {
  return (
    <span className={`svg-icon ${className}`} style={style}>
      <SVG src={toAbsoluteUrl(path)} className={svgClassName} />
    </span>
  );
};

export { KTSVG };
