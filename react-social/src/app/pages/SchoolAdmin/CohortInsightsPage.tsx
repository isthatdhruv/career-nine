import { FC, useCallback, useEffect, useState } from "react";
import { useAuth } from "../../modules/auth";
import {
  CohortInsightView,
  generateCohortInsight,
  getCohortInsight,
} from "./CohortInsights_APIs";

// Scaffold: the assessments to render as cards. Replace with the institute's
// real assessment list (fetch by institute) in a follow-up.
const ASSESSMENT_CARDS: { assessmentId: number; name: string }[] = [
  { assessmentId: 1, name: "Assessment 1" },
];

const statusLabel = (v: CohortInsightView | undefined): string => {
  if (!v || v.status === null) return "Not generated";
  switch (v.status) {
    case "PENDING":
    case "GENERATING":
      return "Generating…";
    case "GENERATED":
      return "Ready";
    case "FAILED":
      return "Generation failed";
    default:
      return "Unknown";
  }
};

const CohortInsightCard: FC<{
  instituteCode: number;
  assessmentId: number;
  name: string;
  canGenerate: boolean;
}> = ({ instituteCode, assessmentId, name, canGenerate }) => {
  const [view, setView] = useState<CohortInsightView | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getCohortInsight(instituteCode, assessmentId)
      .then((r) => setView(r.data))
      .catch(() => setView(undefined))
      .finally(() => setLoading(false));
  }, [instituteCode, assessmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const onGenerate = () => {
    generateCohortInsight(instituteCode, assessmentId).then(() => {
      // Re-poll after enqueue so the card moves to Generating → Ready.
      setTimeout(load, 1500);
    });
  };

  return (
    <div style={{ border: "1px solid #e2e2e2", borderRadius: 8, padding: 16, minWidth: 280 }}>
      <div style={{ fontWeight: 600 }}>{name}</div>
      <div style={{ color: "#666", margin: "4px 0" }}>
        {loading ? "Loading…" : statusLabel(view)}
      </div>

      {view && view.status === "GENERATED" && (
        <>
          <div style={{ fontSize: 12, color: "#888" }}>
            Generated{view.computedAt ? ` ${new Date(view.computedAt).toLocaleString()}` : ""} from{" "}
            {view.includedCount ?? 0} of {view.completedCount ?? 0} completed
            {view.newSinceGeneration > 0 ? ` · ${view.newSinceGeneration} new completions since` : ""}
          </div>
          {view.logicStale && (
            <div style={{ fontSize: 12, color: "#b8860b" }}>
              Computed with an older logic version — regenerate recommended.
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <strong>Students:</strong> {view.payload?.studentCount ?? 0}
            <ul style={{ marginTop: 4 }}>
              {(view.payload?.riasecAverage ?? []).map((d) => (
                <li key={d.name}>
                  {d.name}: {d.avgNormPct.toFixed(1)}
                </li>
              ))}
            </ul>
            {view.payload?.note && (
              <div style={{ fontSize: 11, color: "#999" }}>{view.payload.note}</div>
            )}
          </div>
        </>
      )}

      {canGenerate && (
        <button
          type="button"
          onClick={onGenerate}
          disabled={view?.status === "PENDING" || view?.status === "GENERATING"}
          style={{ marginTop: 12 }}
        >
          {view && view.status ? "Regenerate" : "Generate"}
        </button>
      )}
    </div>
  );
};

const CohortInsightsPage: FC = () => {
  const { currentUser } = useAuth();
  const isSuperAdmin = currentUser?.superAdmin === true;
  // ABAC institute dimension lives in scopes[].i (see auth core _models.ts Scope type).
  const instituteCode: number | undefined = currentUser?.scopes?.[0]?.i;

  if (!instituteCode) {
    return <div style={{ padding: 24 }}>No institute is associated with your account.</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>School Cohort Insights</h2>
      <p style={{ color: "#666" }}>
        Cohort-level Navigator 360 insights for your school. Insights are generated on demand
        {isSuperAdmin ? " — use Generate/Regenerate below." : " by an administrator."}
      </p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16 }}>
        {ASSESSMENT_CARDS.map((c) => (
          <CohortInsightCard
            key={c.assessmentId}
            instituteCode={instituteCode}
            assessmentId={c.assessmentId}
            name={c.name}
            canGenerate={isSuperAdmin}
          />
        ))}
      </div>
    </div>
  );
};

export default CohortInsightsPage;
