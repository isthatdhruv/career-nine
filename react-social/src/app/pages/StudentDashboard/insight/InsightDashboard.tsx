import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getInsightDashboard, getMyInsightDashboard } from "./insightApi";
import { InsightDashboardDTO } from "./insightTypes";
import { SectionRenderer } from "./InsightWidgets";
import "./InsightDashboard.css";

interface InsightDashboardProps {
  /** Self-service mode: load the logged-in student's own dashboard via /me. */
  self?: boolean;
}

type LoadState =
  | { phase: "loading" }
  | { phase: "ready"; data: InsightDashboardDTO }
  | { phase: "error"; kind: string; message: string };

const ENGINE_LABEL: Record<string, string> = {
  pager: "Navigator 360",
  bet: "BET",
  navigator: "Navigator (Legacy)",
};

const InsightDashboard: React.FC<InsightDashboardProps> = ({ self = false }) => {
  const [params] = useSearchParams();
  const studentId = (params.get("studentId") || "").trim();
  const assessmentId = (params.get("assessmentId") || "").trim();
  const nameFromUrl = (params.get("name") || "").trim();
  const audience = (params.get("audience") || "admin").trim() === "student" ? "student" : "admin";

  const [state, setState] = useState<LoadState>({ phase: "loading" });

  useEffect(() => {
    if (!self && !studentId) {
      setState({ phase: "error", kind: "no_student", message: "No student specified." });
      return;
    }
    let cancelled = false;
    setState({ phase: "loading" });
    const request = self
      ? getMyInsightDashboard(assessmentId || undefined)
      : getInsightDashboard(studentId, assessmentId || undefined, audience);
    request
      .then((res) => {
        if (!cancelled) setState({ phase: "ready", data: res.data });
      })
      .catch((err) => {
        if (cancelled) return;
        const body = err?.response?.data || {};
        setState({
          phase: "error",
          kind: body.status || "failed",
          message: body.error || "Could not load this dashboard.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [self, studentId, assessmentId, audience]);

  const heroName = useMemo(() => {
    if (state.phase === "ready" && state.data.student?.name) return state.data.student.name;
    return nameFromUrl || "Student";
  }, [state, nameFromUrl]);

  useEffect(() => {
    const original = document.title;
    document.title = `Career-9 | ${heroName} — Insight Dashboard`;
    return () => {
      document.title = original;
    };
  }, [heroName]);

  return (
    <div className="idb-root">
      {state.phase === "loading" && (
        <div className="idb-center">
          <div className="idb-spinner" />
          <p>Preparing the dashboard…</p>
        </div>
      )}

      {state.phase === "error" && (
        <div className="idb-center">
          <div className="idb-empty-icon">
            <i className="bi bi-clipboard-x" />
          </div>
          <h2>
            {state.kind === "not_ready"
              ? "Results are still being prepared"
              : state.kind === "no_report"
              ? "No report yet"
              : state.kind === "unsupported"
              ? "Dashboard not available for this assessment"
              : "Something went wrong"}
          </h2>
          <p className="idb-empty-msg">{state.message}</p>
          {state.kind === "not_ready" && (
            <button className="idb-retry" onClick={() => window.location.reload()}>
              Try again
            </button>
          )}
        </div>
      )}

      {state.phase === "ready" && (
        <>
          <header className="idb-hero">
            <div className="idb-hero-inner">
              <div className="idb-hero-badge">
                {ENGINE_LABEL[state.data.engine] || state.data.engine} · Insight Dashboard
                {!state.data.access?.unlocked && (
                  <span className="idb-lock-pill">
                    <i className="bi bi-lock-fill" /> Locked
                  </span>
                )}
              </div>
              <h1 className="idb-hero-name">{heroName}</h1>
              <div className="idb-hero-meta">
                {state.data.student?.studentClass && (
                  <span>
                    <i className="bi bi-mortarboard" /> Class {state.data.student.studentClass}
                  </span>
                )}
                {state.data.student?.gradeGroup && (
                  <span>
                    <i className="bi bi-collection" /> Group {state.data.student.gradeGroup}
                  </span>
                )}
                {state.data.student?.schoolName && (
                  <span>
                    <i className="bi bi-building" /> {state.data.student.schoolName}
                    {state.data.student.schoolCity ? `, ${state.data.student.schoolCity}` : ""}
                  </span>
                )}
              </div>
            </div>
          </header>

          <main className="idb-main">
            {state.data.access?.preview && (
              <div className="idb-paywall">
                <div className="idb-paywall-icon">
                  <i className="bi bi-stars" />
                </div>
                <div className="idb-paywall-body">
                  <h3>{state.data.access.cta?.headline || "Unlock your full results"}</h3>
                  <p>
                    {state.data.access.cta?.message ||
                      "Unlock your dashboard to see your full career insights and recommendations."}
                  </p>
                </div>
                <button
                  className="idb-paywall-btn"
                  onClick={() => {
                    // Route to the storefront/pricing Home where the plans + checkout live.
                    if (self) {
                      // Student portal storefront home.
                      window.location.href = `/student/dashboard`;
                      return;
                    }
                    const p = new URLSearchParams();
                    if (studentId) p.set("studentId", studentId);
                    if (nameFromUrl) p.set("name", nameFromUrl);
                    window.location.href = `/student/dashboard-preview?${p.toString()}`;
                  }}
                >
                  Unlock now
                </button>
              </div>
            )}
            {state.data.sections.length === 0 ? (
              <div className="idb-center">
                <p className="idb-empty-msg">No insights available for this assessment.</p>
              </div>
            ) : (
              state.data.sections.map((s, i) => <SectionRenderer key={i} section={s} />)
            )}
          </main>
        </>
      )}
    </div>
  );
};

export default InsightDashboard;
