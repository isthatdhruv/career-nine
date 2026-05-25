import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReadQuestionSectionData } from "../QuestionSections/API/Question_Section_APIs";
import { ReadQuestionsDataList } from "./API/Question_APIs";
import { QuestionTable } from "./components";
import QuestionRecycleBinModal from "./components/QuestionRecycleBinModal";

const AssessmentQuestionsPage = () => {
  const [questionsData, setQuestionsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(["false"]);
  const [showRecycleBinModal, setShowRecycleBinModal] = useState(false);
  const navigate = useNavigate();

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const response = await ReadQuestionsDataList();
      setQuestionsData(response.data);
    } catch (error) {
      console.error("Failed to fetch questions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchSections = async () => {
      setLoading(true);
      try {
        const response = await ReadQuestionSectionData();
        setSections(response.data);
      } catch (error) {
        console.error("Error fetching sections:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSections();
  }, []);

  useEffect(() => {
    fetchQuestions();
    if (pageLoading[0] === "true") {
      setPageLoading(["false"]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageLoading[0]]);

  const fontStack =
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  return (
    <>
      <PageStyles />
      <div
        style={{
          background: "#fafafa",
          minHeight: "100vh",
          margin: "-30px -40px -60px",
          padding: "28px 32px 56px",
          fontFamily: fontStack,
          color: "#0f172a",
        }}
      >
        {/* Header card */}
        <div className="aqp-header">
          <div className="aqp-header-grid" />
          <div className="aqp-header-glow" />
          <div className="aqp-header-content">
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div className="aqp-icon-tile">
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h1 className="aqp-title">Assessment Questions</h1>
                <div className="aqp-subtitle">
                  {loading ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span className="aqp-spinner" />
                      Loading library…
                    </span>
                  ) : (
                    <>
                      <span className="aqp-stat">
                        <strong>{questionsData.length}</strong> question{questionsData.length === 1 ? "" : "s"}
                      </span>
                      <span className="aqp-stat-sep">·</span>
                      <span className="aqp-stat">
                        <strong>{sections.length}</strong> section{sections.length === 1 ? "" : "s"}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="aqp-actions">
              <button
                className="aqp-btn aqp-btn-ghost"
                onClick={() => navigate("/assessment-questions/duplicates")}
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Find duplicates
              </button>

              <button
                className="aqp-btn aqp-btn-ghost aqp-btn-danger"
                onClick={() => setShowRecycleBinModal(true)}
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
                Recycle bin
              </button>

              <button
                className="aqp-btn aqp-btn-primary"
                onClick={() => navigate("/assessment-questions/create")}
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add question
              </button>
            </div>
          </div>
        </div>

        {/* Table card */}
        <div
          style={{
            marginTop: 20,
            background: "#ffffff",
            border: "1px solid rgba(15, 23, 42, 0.06)",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
          }}
        >
          {loading ? (
            <div
              style={{
                padding: "64px 24px",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              <span
                className="aqp-spinner"
                style={{ width: 26, height: 26, borderWidth: 2.5 }}
              />
              <p
                style={{
                  marginTop: 14,
                  fontSize: 13,
                  color: "#64748b",
                  fontWeight: 500,
                }}
              >
                Loading questions…
              </p>
            </div>
          ) : (
            <div style={{ padding: 16 }}>
              <QuestionTable
                data={questionsData}
                sections={sections}
                setPageLoading={setPageLoading}
              />
            </div>
          )}
        </div>

        <QuestionRecycleBinModal
          show={showRecycleBinModal}
          onHide={() => setShowRecycleBinModal(false)}
          onRestoreComplete={() => setPageLoading(["true"])}
          sections={sections}
        />
      </div>
    </>
  );
};

const PageStyles = () => (
  <style>{`
    /* Header card with slate base + muted rose accent */
    .aqp-header {
      position: relative;
      border-radius: 16px;
      overflow: hidden;
      background:
        radial-gradient(900px 300px at 90% -30%, rgba(244,63,94,0.12), transparent 60%),
        linear-gradient(135deg, #0f172a 0%, #1a2238 50%, #1e293b 100%);
      color: #ffffff;
      padding: 28px 32px;
    }
    .aqp-header-grid {
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
    .aqp-header-glow {
      position: absolute;
      top: -100px; right: -60px;
      width: 280px; height: 280px;
      border-radius: 50%;
      filter: blur(60px);
      background: radial-gradient(closest-side, rgba(244,63,94,0.22), transparent);
      pointer-events: none;
    }
    .aqp-header-content {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
    }
    .aqp-icon-tile {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(244,63,94,0.18), rgba(244,63,94,0.05));
      border: 1px solid rgba(244,63,94,0.25);
      color: #fda4af;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .aqp-title {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.025em;
      color: #ffffff;
      margin: 0;
      line-height: 1.15;
    }
    .aqp-subtitle {
      font-size: 13px;
      color: rgba(255,255,255,0.7);
      margin-top: 4px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }
    .aqp-stat strong {
      color: #ffffff;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .aqp-stat-sep {
      color: rgba(255,255,255,0.35);
    }

    /* Actions */
    .aqp-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .aqp-btn {
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
      font-family: inherit;
      line-height: 1;
      border: 1px solid transparent;
      white-space: nowrap;
    }

    /* Primary — white fill (stands out on dark header) */
    .aqp-btn-primary {
      background: #ffffff;
      color: #0f172a;
      box-shadow: 0 2px 6px rgba(0,0,0,0.18);
    }
    .aqp-btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(0,0,0,0.25);
      background: #f8fafc;
    }
    .aqp-btn-primary:active {
      transform: translateY(0);
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }

    /* Ghost — translucent on dark header */
    .aqp-btn-ghost {
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.9);
      border: 1px solid rgba(255,255,255,0.14);
      backdrop-filter: blur(8px);
    }
    .aqp-btn-ghost:hover {
      background: rgba(255,255,255,0.12);
      border-color: rgba(255,255,255,0.24);
      color: #ffffff;
    }

    /* Danger ghost — rose tint on hover only */
    .aqp-btn-danger {
      color: rgba(253,164,175,0.9);
    }
    .aqp-btn-danger:hover {
      background: rgba(244,63,94,0.14);
      border-color: rgba(244,63,94,0.35);
      color: #fecdd3;
    }

    /* Spinner */
    .aqp-spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.2);
      border-top-color: #fecdd3;
      animation: aqp-spin 0.8s linear infinite;
      vertical-align: middle;
    }
    @keyframes aqp-spin {
      to { transform: rotate(360deg); }
    }

    /* Break out of Metronic's max-width while this page is mounted */
    body #kt_app_content,
    body #kt_app_content_container,
    body .app-content,
    body .app-content-container,
    body .container,
    body .container-xxl,
    body .container-fluid {
      max-width: none !important;
    }

    @media (max-width: 720px) {
      .aqp-header { padding: 22px 20px; }
      .aqp-header-content { align-items: flex-start; }
      .aqp-actions { width: 100%; }
      .aqp-btn { flex: 1 1 auto; justify-content: center; }
    }
  `}</style>
);

export default AssessmentQuestionsPage;
