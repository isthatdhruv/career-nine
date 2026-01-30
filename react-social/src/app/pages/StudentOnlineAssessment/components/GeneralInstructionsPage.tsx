import React from "react";
import { useNavigate } from "react-router-dom";

const GeneralInstructionsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
      }}
    >
      <div
        className="card shadow-lg"
        style={{
          width: "800px",
          maxWidth: "98%",
          borderRadius: "24px",
          border: "none",
        }}
      >
        <div className="card-body p-5">
          {/* Header Icon */}
          <div
            style={{
              width: "100px",
              height: "100px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 2rem",
              boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
            }}
          >
            <span style={{ fontSize: "3.5rem" }}>🚀</span>
          </div>

          {/* Welcome Message */}
          <h2
            className="text-center mb-2"
            style={{
              fontSize: "2.5rem",
              fontWeight: "700",
              color: "#2d3748",
              lineHeight: "1.2",
            }}
          >
            Hi there! Welcome to your discovery journey.
          </h2>

          <p
            className="text-center mb-5"
            style={{
              color: "#718096",
              fontSize: "1.1rem",
              marginTop: "1rem",
            }}
          >
            Before we start, here are three things to know:
          </p>

          {/* Instruction Cards */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
              marginBottom: "3rem",
            }}
          >
            {/* Instruction 1 */}
            <div
              style={{
                background: "linear-gradient(135deg, #667eea10 0%, #764ba210 100%)",
                border: "2px solid #667eea30",
                borderRadius: "16px",
                padding: "1.5rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "1.25rem",
              }}
            >
              <div
                style={{
                  width: "50px",
                  height: "50px",
                  minWidth: "50px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.75rem",
                  boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
                }}
              >
                📝
              </div>
              <div style={{ flex: 1, paddingTop: "0.25rem" }}>
                <p
                  style={{
                    margin: 0,
                    color: "#2d3748",
                    fontSize: "1.50rem",
                    lineHeight: "1.7",
                    fontWeight: "500",
                  }}
                >
                  This is <strong style={{ color: "#667eea" }}>NOT a school exam</strong>. You won't get a "grade" like A or B.
                </p>
              </div>
            </div>

            {/* Instruction 2 */}
            <div
              style={{
                background: "linear-gradient(135deg, #667eea10 0%, #764ba210 100%)",
                border: "2px solid #667eea30",
                borderRadius: "16px",
                padding: "1.5rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "1.25rem",
              }}
            >
              <div
                style={{
                  width: "50px",
                  height: "50px",
                  minWidth: "50px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.75rem",
                  boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
                }}
              >
                💭
              </div>
              <div style={{ flex: 1, paddingTop: "0.25rem" }}>
                <p
                  style={{
                    margin: 0,
                    color: "#2d3748",
                    fontSize: "1.5rem",
                    lineHeight: "1.7",
                    fontWeight: "500",
                  }}
                >
                  There are <strong style={{ color: "#667eea" }}>no wrong answers</strong>. We just want to see how you think and how you feel.
                </p>
              </div>
            </div>

            {/* Instruction 3 */}
            <div
              style={{
                background: "linear-gradient(135deg, #667eea10 0%, #764ba210 100%)",
                border: "2px solid #667eea30",
                borderRadius: "16px",
                padding: "1.5rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "1.25rem",
              }}
            >
              <div
                style={{
                  width: "50px",
                  height: "50px",
                  minWidth: "50px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.75rem",
                  boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
                }}
              >
                ✨
              </div>
              <div style={{ flex: 1, paddingTop: "0.25rem" }}>
                <p
                  style={{
                    margin: 0,
                    color: "#2d3748",
                    fontSize: "1.5rem",
                    lineHeight: "1.7",
                    fontWeight: "500",
                  }}
                >
                  Just <strong style={{ color: "#667eea" }}>be yourself</strong>! Some parts are games and some parts are questions. Take your time and have fun!
                </p>
              </div>
            </div>
          </div>

          {/* Encouragement Box */}
          <div
            style={{
              background: "linear-gradient(135deg, #10b98110 0%, #059669 10 100%)",
              border: "2px solid #10b98130",
              borderRadius: "16px",
              padding: "1.5rem",
              marginBottom: "3rem",
              textAlign: "center",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#2d3748",
                fontSize: "1.05rem",
                fontWeight: "500",
              }}
            >
              <span style={{ fontSize: "1.5rem", marginRight: "0.5rem" }}>🎉</span>
              You're all set! Let's begin this exciting journey together.
            </p>
          </div>

          {/* Start Button */}
          <div className="text-center">
            <button
              className="btn"
              onClick={() => navigate("/studentAssessment")}
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                padding: "1.15rem 4rem",
                borderRadius: "14px",
                fontSize: "1.2rem",
                fontWeight: "600",
                border: "none",
                boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
                transition: "all 0.3s ease",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 15px rgba(102, 126, 234, 0.4)";
              }}
            >
              <span>I'm Ready to Start!</span>
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>

          {/* Footer Note */}
          <p
            className="text-center mt-4"
            style={{
              color: "#9ca3af",
              fontSize: "0.9rem",
              margin: "1.5rem 0 0 0",
            }}
          >
            Click the button above when you're ready to begin your journey
          </p>
        </div>
      </div>
    </div>
  );
};

export default GeneralInstructionsPage;