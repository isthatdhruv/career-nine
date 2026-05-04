import React, { useRef } from "react";
import { MarkdownInstructions } from "../utils/instructionMarkdown";
import "./MarkdownInstructionEditor.css";

interface Props {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
  /** When true, hides the toolbar (used inside compact rows). */
  compact?: boolean;
}

type WrapKind = "bold" | "italic";
type LinePrefix = "h1" | "h2" | "ul" | "ol";

export const MarkdownInstructionEditor: React.FC<Props> = ({
  name,
  value,
  onChange,
  onBlur,
  rows = 5,
  placeholder,
  className = "",
  compact = false,
}) => {
  const taRef = useRef<HTMLTextAreaElement>(null);

  const wrap = (kind: WrapKind) => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const selected = value.slice(start, end) || (kind === "bold" ? "bold text" : "italic text");
    const after = value.slice(end);
    const marker = kind === "bold" ? "**" : "*";
    const next = `${before}${marker}${selected}${marker}${after}`;
    onChange(next);
    setTimeout(() => {
      ta.focus();
      const cursor = before.length + marker.length;
      ta.setSelectionRange(cursor, cursor + selected.length);
    }, 0);
  };

  const prefixLine = (kind: LinePrefix) => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", start);
    const end = lineEnd === -1 ? value.length : lineEnd;
    const line = value.slice(lineStart, end);
    const prefix =
      kind === "h1" ? "# " : kind === "h2" ? "## " : kind === "ul" ? "- " : "1. ";
    // Remove existing leading prefix of the same family
    const stripped = line.replace(/^(#{1,2}\s|[-*]\s|\d+[.)]\s)/, "");
    const next =
      value.slice(0, lineStart) + prefix + stripped + value.slice(end);
    onChange(next);
    setTimeout(() => {
      ta.focus();
      const newCursor = lineStart + prefix.length + stripped.length;
      ta.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  return (
    <div className={`mie-root ${className}`}>
      {!compact && (
        <div className="mie-toolbar">
          <button
            type="button"
            className="mie-btn"
            onClick={() => prefixLine("h1")}
            title="Heading"
          >
            <span style={{ fontWeight: 700, fontSize: "1rem" }}>H1</span>
          </button>
          <button
            type="button"
            className="mie-btn"
            onClick={() => prefixLine("h2")}
            title="Subheading"
          >
            <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>H2</span>
          </button>
          <span className="mie-sep" />
          <button
            type="button"
            className="mie-btn"
            onClick={() => wrap("bold")}
            title="Bold (**text**)"
          >
            <span style={{ fontWeight: 800 }}>B</span>
          </button>
          <button
            type="button"
            className="mie-btn"
            onClick={() => wrap("italic")}
            title="Italic (*text*)"
          >
            <span style={{ fontStyle: "italic", fontWeight: 600 }}>I</span>
          </button>
          <span className="mie-sep" />
          <button
            type="button"
            className="mie-btn"
            onClick={() => prefixLine("ul")}
            title="Bullet list (- item)"
          >
            <span>• List</span>
          </button>
          <button
            type="button"
            className="mie-btn"
            onClick={() => prefixLine("ol")}
            title="Numbered list (1. item)"
          >
            <span>1. List</span>
          </button>
          <span className="mie-hint">Use **bold**, *italic*, # heading, ## subheading, - bullet, 1. numbered</span>
        </div>
      )}
      <div className="mie-grid">
        <div className="mie-pane">
          <div className="mie-pane-label">Editor</div>
          <textarea
            ref={taRef}
            name={name}
            value={value || ""}
            rows={rows}
            placeholder={placeholder}
            className="form-control form-control-solid mie-textarea"
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          />
        </div>
        <div className="mie-pane">
          <div className="mie-pane-label">Preview</div>
          <div className="mie-preview">
            {value && value.trim() ? (
              <MarkdownInstructions text={value} />
            ) : (
              <span className="mie-preview-empty">
                Start typing — preview will appear here.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkdownInstructionEditor;
