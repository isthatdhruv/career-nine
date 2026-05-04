import React from "react";

type Block =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "p"; text: string };

const SPECIAL = /^(#{1,2}\s|[-*]\s|\d+[.)]\s)/;

function isSpecial(line: string): boolean {
  return SPECIAL.test(line.trim());
}

export function parseInstructionMarkdown(input: string): Block[] {
  const lines = (input || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (/^##\s+/.test(trimmed)) {
      blocks.push({ kind: "h3", text: trimmed.replace(/^##\s+/, "") });
      i++;
    } else if (/^#\s+/.test(trimmed)) {
      blocks.push({ kind: "h2", text: trimmed.replace(/^#\s+/, "") });
      i++;
    } else if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", items });
    } else if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ol", items });
    } else {
      const paraLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !isSpecial(lines[i])
      ) {
        paraLines.push(lines[i].trim());
        i++;
      }
      blocks.push({ kind: "p", text: paraLines.join("\n") });
    }
  }

  return blocks;
}

const INLINE = /(\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_)/g;

function renderInlineSegment(text: string, baseKey: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(INLINE.source, INLINE.flags);
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    if (m[2] !== undefined)
      parts.push(<strong key={`${baseKey}-${key++}`}>{m[2]}</strong>);
    else if (m[3] !== undefined)
      parts.push(<em key={`${baseKey}-${key++}`}>{m[3]}</em>);
    else if (m[4] !== undefined)
      parts.push(<em key={`${baseKey}-${key++}`}>{m[4]}</em>);
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function renderInline(text: string): React.ReactNode[] {
  // Preserve single newlines as <br/> so legacy multi-line text still wraps.
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  lines.forEach((line, i) => {
    out.push(...renderInlineSegment(line, `l${i}`));
    if (i < lines.length - 1) out.push(<br key={`br-${i}`} />);
  });
  return out;
}

interface MarkdownInstructionsProps {
  text: string;
  className?: string;
}

export const MarkdownInstructions: React.FC<MarkdownInstructionsProps> = ({
  text,
  className,
}) => {
  const blocks = parseInstructionMarkdown(text);
  return (
    <div className={`im-root ${className || ""}`.trim()}>
      {blocks.map((b, idx) => {
        switch (b.kind) {
          case "h2":
            return (
              <h3 key={idx} className="im-h2">
                {renderInline(b.text)}
              </h3>
            );
          case "h3":
            return (
              <h4 key={idx} className="im-h3">
                {renderInline(b.text)}
              </h4>
            );
          case "ul":
            return (
              <ul key={idx} className="im-ul">
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={idx} className="im-ol">
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </ol>
            );
          case "p":
            return (
              <p key={idx} className="im-p">
                {renderInline(b.text)}
              </p>
            );
        }
      })}
    </div>
  );
};
