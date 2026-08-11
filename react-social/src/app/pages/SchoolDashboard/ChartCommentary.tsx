import React from "react";
import { ChartNotes } from "./StoredDashboard";

/**
 * What Career-9 reads out of one chart, shown directly beneath it.
 *
 * Three lists: what the chart shows, what follows from it if nothing changes, and what
 * to do. They come from the same model call as the rest of the analysis and are stored
 * with it, so the commentary can never describe a different cohort from the bars above.
 */
const ChartCommentary: React.FC<{ notes?: ChartNotes }> = ({ notes }) => {
  if (!notes) return null;
  const { insights, implications, actions } = notes;
  if (!insights.length && !implications.length && !actions.length) return null;

  return (
    <section className="sd-cc" aria-label="What this chart shows">
      {insights.length > 0 && <NoteList kind="reads" title="What this shows" items={insights} />}
      {implications.length > 0 && (
        <NoteList kind="means" title="What it means" items={implications} />
      )}
      {actions.length > 0 && <NoteList kind="do" title="What to do" items={actions} />}
    </section>
  );
};

const NoteList = ({
  kind,
  title,
  items,
}: {
  kind: string;
  title: string;
  items: string[];
}) => (
  <div className={`sd-cc-col sd-cc-col--${kind}`}>
    <div className="sd-cc-title">{title}</div>
    <ol className="sd-cc-list">
      {items.map((item, i) => (
        <li key={i}>
          <Emphasis text={item} />
        </li>
      ))}
    </ol>
  </div>
);

/**
 * Render `**bold**` without letting the model write markup.
 *
 * The model is asked to wrap the finding in double asterisks. That is parsed here into
 * React elements rather than handed to `dangerouslySetInnerHTML` — the text is
 * model-generated, and nothing model-generated should ever be able to put HTML into this
 * page. An unmatched or malformed marker degrades to plain text.
 */
export const Emphasis: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        // split() with one capture group puts captured text at every odd index.
        i % 2 === 1 ? <strong key={i}>{part}</strong> : <React.Fragment key={i}>{part}</React.Fragment>
      )}
    </>
  );
};

export default ChartCommentary;
