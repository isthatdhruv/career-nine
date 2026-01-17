import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAssessment } from "../../StudentLogin/AssessmentContext";

type Option = {
  optionId: number;
  optionText: string;
  languageOptions?: LanguageOption[];
};

type LanguageOption = {
  language: Language;
  optionText: string;
  languageOptionId: number;
};

type Language = {
  languageId: number;
  languageName: string;
};

type LanguageQuestion = {
  language: Language;
  questionText: string;
  languageQuestionId: number;
};

type Question = {
  questionnaireQuestionId: number;
  question: {
    questionText: string;
    options: Option[];
    languageQuestions?: LanguageQuestion[];
    maxOptionsAllowed: number;
  };
};

type QuestionnaireLanguage = {
  id: number;
  language: Language;
};

const SectionQuestionPage: React.FC = () => {
  const { sectionId, questionIndex } = useParams();
  const navigate = useNavigate();
  const { assessmentData } = useAssessment();

  const [questionnaire, setQuestionnaire] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [languages, setLanguages] = useState<QuestionnaireLanguage[]>([]);
  const [currentSection, setCurrentSection] = useState<any>(null);
  const [showWarning, setShowWarning] = useState<boolean>(false);

  const [answers, setAnswers] = useState<Record<string, Record<number, number[]>>>(
    {}
  );
  const [savedForLater, setSavedForLater] = useState<Record<string, Set<number>>>(
    {}
  );
  const [skipped, setSkipped] = useState<Record<string, Set<number>>>({});
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  useEffect(() => {
    if (assessmentData && assessmentData[0]) {
      const questionnaireData = assessmentData[0];
      setQuestionnaire(questionnaireData);

      const section = questionnaireData.sections.find(
        (sec: any) => String(sec.section.sectionId) === String(sectionId)
      );
      if (!section) return;

      setCurrentSection(section);
      setQuestions(section.questions || []);
      setCurrentIndex(Number(questionIndex) || 0);
      
      setLanguages(questionnaireData.languages || []);
    }
  }, [sectionId, questionIndex, assessmentData]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!questionnaire || !questions.length) {
    return <div className="text-center mt-5">No questions found</div>;
  }

  const question = questions[currentIndex];
  const qId = question.questionnaireQuestionId;

  const selectedOptions = answers[sectionId!]?.[qId] || [];

  // Check if this is the last question of the last section
  const isLastSection = () => {
    if (!questionnaire) return false;
    const currentSectionIndex = questionnaire.sections.findIndex(
      (s: any) => String(s.section.sectionId) === String(sectionId)
    );
    return currentSectionIndex === questionnaire.sections.length - 1;
  };

  const isLastQuestionOfLastSection = () => {
    return isLastSection() && currentIndex === questions.length - 1;
  };

  // Check if all questions are answered
  const areAllQuestionsAnswered = (): boolean => {
    if (!questionnaire) return false;
    
    for (const section of questionnaire.sections) {
      const secId = String(section.section.sectionId);
      for (const q of section.questions) {
        const qId = q.questionnaireQuestionId;
        
        // Check if question is answered
        const isAnswered = answers[secId]?.[qId]?.length > 0;
        
        if (!isAnswered) {
          return false;
        }
      }
    }
    return true;
  };

  const generateSubmissionJSON = () => {
    const answersList: any[] = [];

    // Iterate through all sections and questions
    if (questionnaire && questionnaire.sections) {
      for (const section of questionnaire.sections) {
        const secId = String(section.section.sectionId);
        
        for (const q of section.questions) {
          const questionnaireQuestionId = q.questionnaireQuestionId;
          const selectedOptionIds = answers[secId]?.[questionnaireQuestionId] || [];

          // For each selected option, create a separate entry
          if (selectedOptionIds.length > 0) {
            for (const optionId of selectedOptionIds) {
              const entry = {
                questionnaireQuestionId: questionnaireQuestionId,
                optionId: optionId
              };

              answersList.push(entry);
            }
          }
        }
      }
    }

    // Get user_student_id from questionnaire data
    const userStudentId = questionnaire?.userStudent?.userStudentId || null;
    
    // Get assessment_id from localStorage
    const assessmentId = localStorage.getItem('assessmentId') 
      ? parseInt(localStorage.getItem('assessmentId')!) 
      : null;

    const submissionData = {
      userStudentId: userStudentId,
      assessmentId: assessmentId,
      answers: answersList
    };

    return submissionData;
  };

  const markSkipped = () => {
    setSkipped((prev) => {
      const s = new Set(prev[sectionId!] || []);
      s.add(qId);
      return { ...prev, [sectionId!]: s };
    });
  };

  const toggleOption = (optionId: number) => {
    setAnswers((prev) => {
      const sec = prev[sectionId!] || {};
      const arr = sec[qId] || [];

      // Check if the maximum number of options is already selected
      if (arr.includes(optionId)) {
        // If the option is already selected, remove it
        const updated = arr.filter((x) => x !== optionId);
        return {
          ...prev,
          [sectionId!]: { ...sec, [qId]: updated },
        };
      } else if (
        question.question.maxOptionsAllowed === 0 || // Allow unlimited selection if maxOptionsAllowed is 0
        arr.length < question.question.maxOptionsAllowed
      ) {
        // If the maximum number of options is not reached, add the option
        const updated = [...arr, optionId];
        return {
          ...prev,
          [sectionId!]: { ...sec, [qId]: updated },
        };
      }

      // If the maximum number of options is reached, return the current state
      return prev;
    });

    setSkipped((prev) => {
      const s = new Set(prev[sectionId!] || []);
      s.delete(qId);
      return { ...prev, [sectionId!]: s };
    });
  };

  const saveForLaterFn = () => {
    setSavedForLater((prev) => {
      const s = new Set(prev[sectionId!] || []);
      s.add(qId);
      return { ...prev, [sectionId!]: s };
    });
    goNext();
  };

  const goNext = () => {
    if (selectedOptions.length === 0) markSkipped();

    if (currentIndex < questions.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      navigate(
        `/studentAssessment/sections/${sectionId}/questions/${newIndex}`
      );
    } else {
      goToNextSection();
    }
  };

  const goBack = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      navigate(
        `/studentAssessment/sections/${sectionId}/questions/${newIndex}`
      );
    }
  };

  const goToNextSection = () => {
    const idx = questionnaire.sections.findIndex(
      (s: any) => String(s.section.sectionId) === String(sectionId)
    );
    const next = questionnaire.sections[idx + 1];
    if (next) {
      navigate(
        `/studentAssessment/sections/${next.section.sectionId}/questions/0`
      );
    } else {
      navigate("/studentAssessment/completed");
    }
  };

  const handleSubmitAssessment = async () => {
    if (areAllQuestionsAnswered()) {
      try {
        // Generate the submission JSON
        const submissionJSON = generateSubmissionJSON();
        console.log("=== ASSESSMENT SUBMISSION DATA ===");
        console.log(JSON.stringify(submissionJSON, null, 2));
        console.log("=== END OF SUBMISSION DATA ===");

        // Send POST request to backend
        const response = await fetch("http://localhost:8080/assessment-answer/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(submissionJSON)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to submit assessment: ${errorText}`);
        }

        const result = await response.json();
        console.log("=== SUBMISSION SUCCESSFUL ===");
        console.log("Saved answers:", result);
        
        // Navigate to completion page
        navigate("/studentAssessment/completed");
      } catch (error) {
        console.error("Error submitting assessment:", error);
        alert("Failed to submit assessment. Please try again.");
      }
    } else {
      // Show warning message
      setShowWarning(true);
      // Hide warning after 5 seconds
      setTimeout(() => {
        setShowWarning(false);
      }, 5000);
    }
  };

  const getQuestionColor = (secId: string, qId: number) => {
    if (answers[secId]?.[qId]?.length) return "#0d6efd";
    if (savedForLater[secId]?.has(qId)) return "#6f42c1";
    if (skipped[secId]?.has(qId)) return "#dc3545";
    return "#adb5bd";
  };

  const getQuestionText = (languageId: number): string => {
    if (languageId === 100) return question.question.questionText;
    const langQuestion = question.question.languageQuestions?.find(
      (lq) => lq.language.languageId === languageId
    );
    return langQuestion ? langQuestion.questionText : question.question.questionText;
  };

  const getOptionText = (option: Option, languageId: number): string => {
    if (languageId === 100) return option.optionText;
    const langOption = option.languageOptions?.find(
      (lo) => lo.language.languageId === languageId
    );
    return langOption ? langOption.optionText : option.optionText;
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8f9fa" }}>
      {/* LEFT SIDEBAR */}
      <div
        style={{
          width: 260,
          background: "#fff",
          borderRight: "1px solid #ddd",
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          position: "sticky",
          top: 0,
        }}
      >
        {/* Color Legend - Moved to Top with logo clearance */}
        <div
          style={{
            borderBottom: "2px solid #e0e0e0",
            padding: "10px 15px 15px 15px",
            background: "#fff",
          }}
        >
          <h6 className="fw-bold mb-3" style={{ fontSize: "0.975rem" }}>
            Legend
          </h6>
          <div className="d-flex flex-column gap-2">
            <div className="d-flex align-items-center gap-2">
              <div style={{ width: 15, height: 15, borderRadius: "50%", background: "#0d6efd", flexShrink: 0 }} />
              <span style={{ fontSize: "0.8rem" }}>Answered</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div style={{ width: 15, height: 15, borderRadius: "50%", background: "#6f42c1", flexShrink: 0 }} />
              <span style={{ fontSize: "0.8rem" }}>Saved for Later</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div style={{ width: 15, height: 15, borderRadius: "50%", background: "#dc3545", flexShrink: 0 }} />
              <span style={{ fontSize: "0.8rem" }}>Skipped</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div style={{ width: 15, height: 15, borderRadius: "50%", background: "#adb5bd", flexShrink: 0 }} />
              <span style={{ fontSize: "0.8rem" }}>Not Visited</span>
            </div>
          </div>
        </div>

        {/* Question Navigation - Scrollable area */}
        <div style={{ flex: 1, overflowY: "auto", padding: 15 }}>
          <h6 className="fw-bold mb-3" style={{ fontSize: "0.975rem", color: "black" }}>
             Question Status
          </h6>
          {questionnaire.sections.map((sec: any) => (
            <div key={sec.section.sectionId} className="mb-4">
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#333", marginBottom: "8px" }}>
                {sec.section.sectionName}
              </div>
              <div className="d-flex flex-wrap gap-2">
                {sec.questions.map((q: any, i: number) => (
                  <div
                    key={q.questionnaireQuestionId}
                    onClick={() =>
                      navigate(
                        `/studentAssessment/sections/${sec.section.sectionId}/questions/${i}`
                      )
                    }
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: getQuestionColor(
                        String(sec.section.sectionId),
                        q.questionnaireQuestionId
                      ),
                      color: "#fff",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "opacity 0.2s"
                    }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QUESTION AREA */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <div className="card shadow-sm" style={{ width: 1000, maxWidth: "96%", minHeight: "650px" }}>
          <div className="card-body p-5">
            {/* Section Name Badge */}
            <div className="mb-3">
              <span
                style={{
                  background: "#e7f3ff",
                  color: "#0d6efd",
                  padding: "6px 16px",
                  borderRadius: "20px",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  display: "inline-block",
                }}
              >
                {currentSection?.section?.sectionName}
              </span>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-4">
              <h6 className="text-muted mb-0">
                Question {currentIndex + 1} of {questions.length}
              </h6>
              <div
                style={{
                  background: "#f0f0f0",
                  padding: "8px 20px",
                  borderRadius: "20px",
                  fontWeight: "bold",
                  fontSize: "1rem",
                  color: "#333",
                }}
              >
                ⏱️ {formatTime(elapsedTime)}
              </div>
            </div>

            {/* Warning Message */}
            {showWarning && (
              <div
                className="alert alert-warning alert-dismissible fade show"
                role="alert"
                style={{ marginBottom: "20px" }}
              >
                <strong>⚠️ Warning!</strong> Please answer all questions before submitting the assessment. Some questions are still Saved for Later, Skipped, or Not Visited.
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowWarning(false)}
                  aria-label="Close"
                ></button>
              </div>
            )}

            {languages.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: languages.length > 1 ? "1fr 1px 1fr" : "1fr",
                  gap: 20,
                  marginBottom: 30,
                }}
              >
                {languages.map((lang, index) => (
                  <React.Fragment key={lang.language.languageId}>
                    <div>
                      <h6 className="fw-bold mb-3">
                        {lang.language.languageName}
                      </h6>
                      <div
                        style={{
                          fontSize: "1.1rem",
                          lineHeight: "1.6",
                          whiteSpace: "pre-line",
                        }}
                      >
                        {getQuestionText(lang.language.languageId)}
                      </div>
                    </div>
                    {index === 0 && languages.length > 1 && (
                      <div style={{ width: 1, backgroundColor: "#dee2e6" }} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <h4 className="mb-4">{question.question.questionText}</h4>
            )}

            {/* Display maxOptionsAllowed */}
            <div className="text-muted mb-3">
              <small>
                You can select up to <strong>{question.question.maxOptionsAllowed}</strong> option(s).
              </small>
            </div>

            <div className="mt-4">
              {question.question.options.map((opt) => (
                <label
                  key={opt.optionId}
                  className={`border rounded p-3 d-block mb-3 ${
                    selectedOptions.includes(opt.optionId) ? "bg-light" : ""
                  }`}
                  style={{ cursor: "pointer" }}
                >
                  <div className="d-flex align-items-start">
                    <input
                      type="checkbox"
                      className="me-3 mt-1"
                      checked={selectedOptions.includes(opt.optionId)}
                      onChange={() => toggleOption(opt.optionId)}
                      disabled={
                        question.question.maxOptionsAllowed > 0 &&
                        !selectedOptions.includes(opt.optionId) &&
                        selectedOptions.length >= question.question.maxOptionsAllowed
                      }
                    />
                    {languages.length > 0 ? (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: languages.length > 1 ? "1fr 1px 1fr" : "1fr",
                          gap: 15,
                          flex: 1,
                        }}
                      >
                        {languages.map((lang, index) => (
                          <React.Fragment key={lang.language.languageId}>
                            <div style={{ fontSize: "0.95rem", lineHeight: "1.5" }}>
                              {getOptionText(opt, lang.language.languageId)}
                            </div>
                            {index === 0 && languages.length > 1 && (
                              <div style={{ width: 1, backgroundColor: "#dee2e6" }} />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    ) : (
                      <span>{opt.optionText}</span>
                    )}
                  </div>
                </label>
              ))}
            </div>

            <div className="d-flex justify-content-between mt-4">
              <button
                className="btn btn-outline-secondary"
                disabled={currentIndex === 0}
                onClick={goBack}
              >
                Back
              </button>
              <div className="d-flex gap-2">
                {selectedOptions.length === 0 && (
                  <button
                    className="btn btn-outline-warning"
                    onClick={saveForLaterFn}
                  >
                    Save for Later
                  </button>
                )}
                {isLastQuestionOfLastSection() ? (
                  <button className="btn btn-success" onClick={handleSubmitAssessment}>
                    SUBMIT ASSESSMENT
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={goNext}>
                    {currentIndex === questions.length - 1
                      ? "NEXT SECTION"
                      : "NEXT"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SectionQuestionPage;