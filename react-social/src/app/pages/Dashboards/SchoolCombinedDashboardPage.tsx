import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import "./SchoolCombinedDashboardPage.css";

type NavId =
  | "overview"
  | "insights"
  | "compliance"
  | "talent"
  | "clusters"
  | "learning"
  | "support";

type ProbSev = "hi" | "md" | "lo";

const KPI_DATA = [
  {
    key: "students",
    icon: "fas fa-users",
    label: "Students Assessed",
    value: "487",
    delta: "up" as const,
    deltaText: "↑ 23% vs last year",
    accent: "primary",
  },
  {
    key: "cci",
    icon: "fas fa-bullseye",
    label: "High Career Clarity (CCI)",
    value: "31%",
    delta: "up" as const,
    deltaText: "↑ 8% vs last cycle",
    accent: "info",
  },
  {
    key: "atrisk",
    icon: "fas fa-exclamation-triangle",
    label: "At-Risk Students",
    value: "63",
    delta: "down" as const,
    deltaText: "Flagged for counsellor",
    accent: "danger",
  },
  {
    key: "nep",
    icon: "fas fa-shield-alt",
    label: "NEP 2020 Compliance",
    value: "6/8",
    delta: "warn" as const,
    deltaText: "2 gaps remain",
    accent: "accent",
  },
];

const PROBLEMS: Array<{
  sev: ProbSev;
  name: string;
  area: string;
  insightTitle: string;
  insightText: string;
  metric: string;
  metricLabel: string;
  metricTone: "danger" | "amber" | "green";
}> = [
  {
    sev: "hi",
    name: "Students choose streams under parent pressure",
    area: "Stream Selection",
    insightTitle: "RIASEC vs Stream Alignment",
    insightText:
      "42% of Grade 11 students are in streams that conflict with their top RIASEC type. Science stream has the highest mismatch: 38% have Social or Artistic dominant types.",
    metric: "42%",
    metricLabel: "Stream mismatch",
    metricTone: "danger",
  },
  {
    sev: "hi",
    name: "No structured career counselling currently offered",
    area: "Career Counselling",
    insightTitle: "CCI Distribution Across Cohort",
    insightText:
      "Only 31% of students show High CCI. 43% are Low or None — they have no alignment between what they want and what they are naturally suited for.",
    metric: "43%",
    metricLabel: "Low / No CCI",
    metricTone: "danger",
  },
  {
    sev: "hi",
    name: "Difficult to identify at-risk students early",
    area: "Student Wellbeing",
    insightTitle: "Psychometric Flags (P-01 to P-10)",
    insightText:
      "63 students have active clinical flags — 18 show undifferentiated personality (P-01), 11 show all-ability-low (P-06), 34 have aspiration-suitability mismatch (P-07).",
    metric: "63",
    metricLabel: "Active flags",
    metricTone: "danger",
  },
  {
    sev: "md",
    name: "Teacher training is generic, not student-data-driven",
    area: "Teacher Development",
    insightTitle: "Class Intelligence Profiles Available",
    insightText:
      "Grade 9 dominant MI: Logical-Mathematical (62%). Grade 10: Interpersonal (54%). These require different teaching styles. Mismatch to current pedagogy is evident.",
    metric: "6",
    metricLabel: "Class profiles ready",
    metricTone: "amber",
  },
  {
    sev: "md",
    name: "School lacks distinctive identity for admissions",
    area: "School Positioning",
    insightTitle: "Your School's Natural Talent Profile",
    insightText:
      "65% of your students are Investigative-Realistic types. Your school naturally cultivates analytical, research-oriented students — a defensible USP for STEM admissions.",
    metric: "IR",
    metricLabel: "Dominant type",
    metricTone: "amber",
  },
  {
    sev: "lo",
    name: "NEP 2020 compliance evidence is missing",
    area: "NEP Compliance",
    insightTitle: "6 of 8 HPC Criteria Now Documented",
    insightText:
      "Navigator 360 provides documented multi-dimensional assessment for Cognitive, Social-Emotional, and Values dimensions. 2 gaps remain: Vocational and Experiential Learning.",
    metric: "6/8",
    metricLabel: "Criteria met",
    metricTone: "green",
  },
];

const NEP_ITEMS: Array<{
  status: "pass" | "warn" | "fail";
  name: string;
  ref: string;
  detail: string;
}> = [
  {
    status: "pass",
    name: "Career Guidance Gr 6–12",
    ref: "§15.6",
    detail: "3-stage Navigator pipeline covers all 487 students with documented per-student records.",
  },
  {
    status: "pass",
    name: "Holistic Progress Assessment",
    ref: "§4.37",
    detail: "6-pillar framework maps directly to CBSE Holistic Progress Card parameters.",
  },
  {
    status: "pass",
    name: "Multiple Intelligences",
    ref: "§4.6",
    detail: "All 8 Gardner intelligences assessed per student with class-level teaching strategies.",
  },
  {
    status: "pass",
    name: "CBSE Career Guidance Cell",
    ref: "Circular 2023",
    detail: "Counsellor dashboard with session note tracking and cross-role messaging is live.",
  },
  {
    status: "pass",
    name: "Cognitive & Social-Emotional",
    ref: "HPC",
    detail: "RIASEC + Ability + MI scores document multi-dimensional cognitive profiling.",
  },
  {
    status: "pass",
    name: "Values & Ethics",
    ref: "HPC",
    detail: "Section B values assessment provides documented values education evidence.",
  },
  {
    status: "warn",
    name: "Vocational Integration",
    ref: "§16",
    detail: "Currently at 34% exposure — NEP target is 50% by 2025. 58 candidates identified.",
  },
  {
    status: "fail",
    name: "Experiential Field Trips",
    ref: "§7.9",
    detail: "No field trips scheduled this year. NEP mandates min 10 bagless days per year.",
  },
];

const CLUSTERS: Array<{
  type: string;
  bg: string;
  name: string;
  careers: string;
  pct: number;
}> = [
  { type: "I", bg: "#1a6b3c", name: "Investigative", careers: "Research, Medicine, Engineering, Data Science", pct: 32 },
  { type: "R", bg: "#3b82f6", name: "Realistic", careers: "Trades, Sports, Agriculture, Manufacturing", pct: 28 },
  { type: "A", bg: "#8b5cf6", name: "Artistic", careers: "Design, Media, Fine Arts, Architecture", pct: 14 },
  { type: "S", bg: "#f59e0b", name: "Social", careers: "Teaching, Counselling, Healthcare, NGO", pct: 12 },
  { type: "E", bg: "#ef4444", name: "Enterprising", careers: "Business, Sales, Law, Politics", pct: 9 },
  { type: "C", bg: "#7b3a2e", name: "Conventional", careers: "Accounting, Finance, Admin, Logistics", pct: 5 },
];

const LEARNING_STYLES: Array<{
  name: string;
  g68: number;
  g910: number;
  g1112: number;
  trend: "up" | "down" | "flat";
}> = [
  { name: "Bodily-Kinesthetic", g68: 72, g910: 58, g1112: 41, trend: "down" },
  { name: "Logical-Mathematical", g68: 65, g910: 68, g1112: 71, trend: "up" },
  { name: "Spatial-Visual", g68: 61, g910: 62, g1112: 60, trend: "flat" },
  { name: "Interpersonal", g68: 58, g910: 55, g1112: 52, trend: "down" },
  { name: "Linguistic", g68: 71, g910: 64, g1112: 58, trend: "down" },
  { name: "Naturalistic", g68: 70, g910: 51, g1112: 38, trend: "down" },
  { name: "Musical", g68: 48, g910: 42, g1112: 35, trend: "down" },
  { name: "Intrapersonal", g68: 52, g910: 60, g1112: 67, trend: "up" },
];

const PILLARS = [
  { label: "Personality", icon: "fas fa-user", bg: "#e8f5ee", color: "#1a6b3c", pct: 78 },
  { label: "Learning Styles", icon: "fas fa-brain", bg: "#f5f0ff", color: "#8b5cf6", pct: 65 },
  { label: "Ability", icon: "fas fa-bolt", bg: "#eff6ff", color: "#3b82f6", pct: 72 },
  { label: "Values", icon: "fas fa-heart", bg: "#fff3dc", color: "#f5a623", pct: 81 },
];

const NAV_ITEMS: Array<{ id: NavId; icon: string; tip: string }> = [
  { id: "overview", icon: "fas fa-home", tip: "Overview" },
  { id: "insights", icon: "fas fa-search-plus", tip: "Discovery Insights" },
  { id: "compliance", icon: "fas fa-shield-alt", tip: "NEP Compliance" },
  { id: "talent", icon: "fas fa-trophy", tip: "Talent Profile" },
  { id: "clusters", icon: "fas fa-sitemap", tip: "Career Clusters" },
  { id: "learning", icon: "fas fa-graduation-cap", tip: "Learning Styles" },
  { id: "support", icon: "fas fa-headset", tip: "Support" },
];

const SchoolCombinedDashboardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const instituteCode = (id || "").trim();

  const initials = useMemo(() => {
    const name = "Sunrise Public School";
    return name
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("");
  }, []);

  const [activeNav, setActiveNav] = useState<NavId>("overview");

  useEffect(() => {
    const original = document.title;
    document.title = `Career-9 | School Dashboard${instituteCode ? ` · ${instituteCode}` : ""}`;
    return () => {
      document.title = original;
    };
  }, [instituteCode]);

  function scrollToSection(id: NavId) {
    setActiveNav(id);
    if (id === "overview") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = document.getElementById(`scd-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="scd-root">
      <nav className="scd-sidebar">
        <div className="scd-sidebar-logo">C9</div>
        <div className="scd-sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <div
              key={item.id}
              className={`scd-nav-item ${activeNav === item.id ? "active" : ""}`}
              onClick={() => scrollToSection(item.id)}
            >
              <i className={item.icon} />
              <span className="scd-tooltip">{item.tip}</span>
            </div>
          ))}
        </div>
        <div className="scd-sidebar-bottom">
          <div className="scd-nav-item">
            <i className="fas fa-cog" />
            <span className="scd-tooltip">Settings</span>
          </div>
          <div className="scd-sidebar-avatar">{initials}</div>
        </div>
      </nav>

      <main className="scd-main">
        <div className="scd-top-bar">
          <div className="scd-breadcrumb">
            <i className="fas fa-home" style={{ fontSize: 12 }} />
            Dashboard <i className="fas fa-chevron-right" style={{ fontSize: 9 }} />{" "}
            <span>School Intelligence</span>
          </div>
          <div className="scd-top-actions">
            <button type="button" className="scd-pill-action">
              <i className="fas fa-download" /> Export Report
            </button>
            <button type="button" className="scd-pill-action">
              <i className="fas fa-share-alt" /> Share
            </button>
          </div>
        </div>

        {/* HERO */}
        <section className="scd-hero" id="scd-overview">
          <div>
            <div className="scd-hero-badge">
              <i className="fas fa-school" /> Navigator 360 · School Intelligence
            </div>
            <p className="scd-hero-greeting">Welcome back!</p>
            <h1 className="scd-hero-title">
              <span className="scd-highlight">Sunrise Public School</span>,<br />
              your school's career story
            </h1>
            <div className="scd-hero-meta">
              {instituteCode && (
                <span className="scd-hero-meta-item">
                  <i className="fas fa-id-card" />
                  Code: {instituteCode}
                </span>
              )}
              <span className="scd-hero-meta-item">
                <i className="fas fa-calendar" />
                AY 2024–25
              </span>
              <span className="scd-hero-meta-item">
                <i className="fas fa-users" />
                487 students
              </span>
              <span className="scd-hero-meta-item">
                <i className="fas fa-graduation-cap" />
                Grades 6–12
              </span>
              <span className="scd-hero-meta-item">
                <i className="fas fa-map-marker-alt" />
                CBSE Affiliated
              </span>
            </div>
            <p className="scd-hero-subtitle">
              A combined view of your school's career-readiness signals — psychometric depth, NEP
              compliance, and admissions positioning — all in one place.
            </p>
            <div className="scd-hero-next">
              <div className="scd-hero-next-label">
                <i className="fas fa-bolt" /> Top priority this term
              </div>
              <div className="scd-hero-next-text">
                63 students need counsellor attention and 2 NEP compliance gaps must close before
                the next CBSE audit. Start with the Discovery Insights below.
              </div>
            </div>
          </div>

          <div>
            <div className="scd-snapshot-card">
              <div className="scd-snapshot-head">
                <div className="scd-snapshot-icon">
                  <i className="fas fa-clipboard-list" />
                </div>
                <div>
                  <div className="scd-snapshot-title">School Snapshot</div>
                  <div className="scd-snapshot-sub">6-pillar Navigator 360 average</div>
                </div>
                <div className="scd-snapshot-badge">Live</div>
              </div>
              <div className="scd-snapshot-cci">
                <div className="scd-snapshot-cci-head">
                  <span>Career Clarity Index</span>
                  <span className="scd-snapshot-cci-pct">31%</span>
                </div>
                <div className="scd-snapshot-bar">
                  <div className="scd-snapshot-bar-fill" />
                </div>
              </div>
              <div className="scd-snapshot-pillars">
                {PILLARS.map((p) => (
                  <div className="scd-snapshot-pillar" key={p.label}>
                    <div className="scd-pillar-ico" style={{ background: p.bg, color: p.color }}>
                      <i className={p.icon} />
                    </div>
                    <div className="scd-pillar-info">
                      <div className="scd-pillar-label">{p.label}</div>
                      <div className="scd-pillar-bar">
                        <div style={{ width: `${p.pct}%`, background: p.color }} />
                      </div>
                    </div>
                    <div className="scd-pillar-score">{p.pct}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* COMPLIANCE TRACKER */}
        <div className="scd-tracker">
          <div className="scd-tracker-label">School Readiness Journey</div>
          <div className="scd-tracker-steps">
            {[
              { state: "done", icon: "fas fa-check", label: "Assessments Live" },
              { state: "done", icon: "fas fa-check", label: "Data Captured" },
              { state: "done", icon: "fas fa-check", label: "Insights Mapped" },
              { state: "warn", icon: "fas fa-exclamation", label: "Counselling" },
              { state: "fail", icon: "fas fa-times", label: "Field Trips" },
            ].map((s, i) => (
              <div key={i} className={`scd-tracker-step ${s.state}`}>
                <div className="scd-tracker-dot">
                  <i className={s.icon} />
                </div>
                <div className="scd-tracker-step-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* TRUST STRIP */}
        <div className="scd-trust-strip">
          <div className="scd-trust-badge">
            <i className="fas fa-users" /> 487 students assessed
          </div>
          <div className="scd-trust-badge">
            <i className="fas fa-shield-alt" /> NEP 2020 audit-ready
          </div>
          <div className="scd-trust-badge">
            <i className="fas fa-award" /> 6-pillar Navigator 360
          </div>
          <div className="scd-trust-badge">
            <i className="fas fa-chart-line" /> Cycle 3 of 4
          </div>
        </div>

        {/* KPI GRID */}
        <section className="scd-section">
          <div className="scd-section-header">
            <div>
              <h2 className="scd-section-title">Key Indicators</h2>
              <p className="scd-section-subtitle">Headline numbers across your cohort</p>
            </div>
          </div>
          <div className="scd-kpi-grid">
            {KPI_DATA.map((k) => (
              <div key={k.key} className={`scd-kpi-card ${k.accent}`}>
                <div className="scd-kpi-icon">
                  <i className={k.icon} />
                </div>
                <div className="scd-kpi-label">{k.label}</div>
                <div className="scd-kpi-value">{k.value}</div>
                <div className={`scd-kpi-delta ${k.delta}`}>{k.deltaText}</div>
              </div>
            ))}
          </div>
        </section>

        {/* DISCOVERY INSIGHTS */}
        <section className="scd-section" id="scd-insights">
          <div className="scd-section-header">
            <div>
              <h2 className="scd-section-title">Discovery Insights</h2>
              <p className="scd-section-subtitle">
                Your survey said this is a problem — here is what the assessment data confirms
              </p>
            </div>
          </div>
          <div className="scd-problem-grid">
            {PROBLEMS.map((p, i) => (
              <div className="scd-prob-row" key={i}>
                <div className={`scd-prob-sev ${p.sev}`} />
                <div className="scd-prob-label">
                  <div className="scd-prob-name">{p.name}</div>
                  <div className="scd-prob-area">{p.area}</div>
                </div>
                <div className="scd-prob-insight">
                  <div className="scd-prob-insight-title">{p.insightTitle}</div>
                  <div className="scd-prob-insight-text">{p.insightText}</div>
                </div>
                <div className="scd-prob-metric">
                  <div
                    className={`scd-prob-n ${
                      p.metricTone === "amber" ? "amber" : p.metricTone === "green" ? "green" : ""
                    }`}
                  >
                    {p.metric}
                  </div>
                  <div className="scd-prob-nl">{p.metricLabel}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* NEP COMPLIANCE */}
        <section className="scd-section" id="scd-compliance">
          <div className="scd-section-header">
            <div>
              <h2 className="scd-section-title">NEP 2020 &amp; CBSE Compliance</h2>
              <p className="scd-section-subtitle">
                6 of 8 criteria documented · 2 gaps to close before next audit
              </p>
            </div>
            <span className="scd-section-action">
              <i className="fas fa-file-alt" /> View full audit
            </span>
          </div>
          <div className="scd-nep-grid">
            {NEP_ITEMS.map((n, i) => (
              <div key={i} className={`scd-nep-card ${n.status}`}>
                <div className="scd-nep-card-head">
                  <div className="scd-nep-ico">
                    <i
                      className={
                        n.status === "pass"
                          ? "fas fa-check"
                          : n.status === "warn"
                          ? "fas fa-exclamation"
                          : "fas fa-times"
                      }
                    />
                  </div>
                  <div className="scd-nep-name">{n.name}</div>
                  <div className="scd-nep-ref">{n.ref}</div>
                </div>
                <div className="scd-nep-detail">{n.detail}</div>
              </div>
            ))}
          </div>
        </section>

        {/* TALENT PROFILE / USP */}
        <section className="scd-section" id="scd-talent">
          <div className="scd-section-header">
            <div>
              <h2 className="scd-section-title">Your Admissions USP</h2>
              <p className="scd-section-subtitle">
                Based on cohort personality, intelligence, and ability profile
              </p>
            </div>
          </div>
          <div className="scd-usp-card">
            <div className="scd-usp-eyebrow">School Intelligence · Navigator 360</div>
            <div className="scd-usp-title">
              "A school where analytical, research-oriented students discover their direction"
            </div>
            <div className="scd-usp-body">
              65% of your students show Investigative-Realistic personality — the profile that
              leads naturally into engineering, science, technology, and research. Your school is
              not just CBSE-aligned; it is cognitively profiled for STEM excellence. This is your
              admissions story.
            </div>
            <div className="scd-usp-tags">
              <span className="scd-usp-tag">I-R Dominant Cohort</span>
              <span className="scd-usp-tag">STEM Pipeline</span>
              <span className="scd-usp-tag">NEP Compliant</span>
              <span className="scd-usp-tag">Psychometrically Validated</span>
              <span className="scd-usp-tag">Data-backed Counselling</span>
            </div>
          </div>
        </section>

        {/* CAREER CLUSTER DISTRIBUTION */}
        <section className="scd-section" id="scd-clusters">
          <div className="scd-section-header">
            <div>
              <h2 className="scd-section-title">Career Cluster Distribution</h2>
              <p className="scd-section-subtitle">
                What your 487 students are naturally suited for (RIASEC dominant type)
              </p>
            </div>
          </div>
          <div className="scd-card">
            {CLUSTERS.map((c) => (
              <div className="scd-cluster-row" key={c.type}>
                <div className="scd-cluster-type" style={{ background: c.bg }}>
                  {c.type}
                </div>
                <div className="scd-cluster-info">
                  <div className="scd-cluster-name">{c.name}</div>
                  <div className="scd-cluster-careers">{c.careers}</div>
                </div>
                <div className="scd-cluster-bar-w">
                  <div className="scd-cluster-bg">
                    <div
                      className="scd-cluster-fill"
                      style={{ width: `${c.pct}%`, background: c.bg }}
                    />
                  </div>
                </div>
                <div className="scd-cluster-pct">{c.pct}%</div>
              </div>
            ))}
          </div>
        </section>

        {/* LEARNING STYLES */}
        <section className="scd-section" id="scd-learning">
          <div className="scd-section-header">
            <div>
              <h2 className="scd-section-title">Learning Styles — Gardner Model</h2>
              <p className="scd-section-subtitle">
                Cohort intelligence profile across grade bands
              </p>
            </div>
          </div>
          <div className="scd-card">
            <table className="scd-ls-table">
              <thead>
                <tr>
                  <th>Learning Style</th>
                  <th>Gr 6–8</th>
                  <th>Gr 9–10</th>
                  <th>Gr 11–12</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {LEARNING_STYLES.map((ls) => (
                  <tr key={ls.name}>
                    <td style={{ fontWeight: 600, color: "var(--text-dark)" }}>{ls.name}</td>
                    <td>
                      <span className={`scd-ls-pill ${ls.g68 >= 60 ? "hi" : ls.g68 >= 45 ? "md" : "lo"}`}>
                        {ls.g68}%
                      </span>
                    </td>
                    <td>
                      <span
                        className={`scd-ls-pill ${ls.g910 >= 60 ? "hi" : ls.g910 >= 45 ? "md" : "lo"}`}
                      >
                        {ls.g910}%
                      </span>
                    </td>
                    <td>
                      <span
                        className={`scd-ls-pill ${
                          ls.g1112 >= 60 ? "hi" : ls.g1112 >= 45 ? "md" : "lo"
                        }`}
                      >
                        {ls.g1112}%
                      </span>
                    </td>
                    <td>
                      <span className={`scd-ls-trend ${ls.trend}`}>
                        {ls.trend === "up" ? "↑" : ls.trend === "down" ? "↓" : "→"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* HELP */}
        <section className="scd-help-card" id="scd-support">
          <div className="scd-help-head">
            <i className="fas fa-headset" />
            <h3>Need a deeper review?</h3>
          </div>
          <p>
            Our Navigator 360 specialists can walk your team through the data, build an action
            plan, and prepare your NEP audit dossier.
          </p>
          <div className="scd-help-actions">
            <button type="button" className="scd-help-btn">
              <i className="fas fa-calendar-alt" /> Schedule Review Call
            </button>
            <button type="button" className="scd-help-btn">
              <i className="fas fa-file-download" /> Download Full Report
            </button>
            <button type="button" className="scd-help-btn">
              <i className="fas fa-envelope" /> Email Counsellor Team
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default SchoolCombinedDashboardPage;
