import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAssessment } from "../../StudentLogin/AssessmentContext";
import { AssessmentGameWrapper } from "./AssessmentGameWrapper";

type GameTable = {
  gameId: number;
  gameName: string;
  gameCode: number;
};

type Option = {
  optionId: number;
  optionText: string;
  optionImageBase64?: string | null;
  languageOptions?: LanguageOption[];
  isGame?: boolean;
  game?: GameTable;
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
    questionType?: string;
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

  // Game-related state
  const [isGameActive, setIsGameActive] = useState<boolean>(false);
  const [activeGameCode, setActiveGameCode] = useState<number | null>(null);

  const [answers, setAnswers] = useState<Record<string, Record<number, number[]>>>(
    {}
  );
  // For ranking questions: sectionId -> questionId -> optionId -> rank
  const [rankingAnswers, setRankingAnswers] = useState<Record<string, Record<number, Record<number, number>>>>(
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
        const isRankingQuestion = q.question.questionType === "ranking";
        let isAnswered = false;
        if (isRankingQuestion) {
          const rankings = rankingAnswers[secId]?.[qId] || {};
          isAnswered = Object.keys(rankings).length > 0;
        } else {
          isAnswered = answers[secId]?.[qId]?.length > 0;
        }

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
          const isRankingQuestion = q.question.questionType === "ranking";

          if (isRankingQuestion) {
            // Handle ranking questions
            const rankings = rankingAnswers[secId]?.[questionnaireQuestionId] || {};

            for (const [optionIdStr, rank] of Object.entries(rankings)) {
              const entry = {
                questionnaireQuestionId: questionnaireQuestionId,
                optionId: parseInt(optionIdStr),
                rankOrder: rank
              };
              answersList.push(entry);
            }
          } else {
            // Handle regular single/multiple choice questions
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
    }

    // Get user_student_id from questionnaire data
    const userStudentId = localStorage.getItem('userStudentId')
      ? parseInt(localStorage.getItem('userStudentId')!)
      : null;

    // Get assessment_id from localStorage
    const assessmentId = localStorage.getItem('assessmentId')
      ? parseInt(localStorage.getItem('assessmentId')!)
      : null;

    const submissionData = {
      userStudentId: userStudentId,
      assessmentId: assessmentId,
      status: 'completed',
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
    const currentSelectedCount = selectedOptions.length;
    const isAlreadySelected = selectedOptions.includes(optionId);
    const maxAllowed = question.question.maxOptionsAllowed;

    // Determine if this selection will trigger auto-advance
    // Auto-advance when: adding an option (not removing), and new count equals maxAllowed
    const willAutoAdvance = !isAlreadySelected &&
      maxAllowed > 0 &&
      (currentSelectedCount + 1) === maxAllowed;

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

    // Auto-advance to next question after a short delay (to let user see their selection)
    if (willAutoAdvance) {
      setTimeout(() => {
        if (currentIndex < questions.length - 1) {
          const newIndex = currentIndex + 1;
          setCurrentIndex(newIndex);
          navigate(`/studentAssessment/sections/${sectionId}/questions/${newIndex}`);
        } else {
          // Last question of section - check for next section
          const idx = questionnaire.sections.findIndex(
            (s: any) => String(s.section.sectionId) === String(sectionId)
          );
          const next = questionnaire.sections[idx + 1];
          if (next) {
            navigate(`/studentAssessment/sections/${next.section.sectionId}/questions/0`);
          }
          // If it's the last section, stay on the question (user needs to submit)
        }
      }, 400); // 400ms delay so user can see their selection
    }
  };

  // Ranking question handlers
  const handleRankChange = (optionId: number, rank: number | null) => {
    // Calculate current rank count before update to determine if we should auto-advance
    const currentRankings = rankingAnswers[sectionId!]?.[qId] || {};
    const currentRankCount = Object.keys(currentRankings).length;
    const maxAllowed = question.question.maxOptionsAllowed;

    // Will auto-advance if: setting a rank (not removing), and this will reach maxAllowed
    const isAddingRank = rank !== null && !currentRankings[optionId];
    const willAutoAdvance = isAddingRank && (currentRankCount + 1) === maxAllowed;

    setRankingAnswers((prev) => {
      const sec = prev[sectionId!] || {};
      const questionRankings = sec[qId] || {};

      if (rank === null) {
        // Remove rank
        const { [optionId]: removed, ...rest } = questionRankings;
        return {
          ...prev,
          [sectionId!]: { ...sec, [qId]: rest },
        };
      } else {
        // Set rank
        return {
          ...prev,
          [sectionId!]: {
            ...sec,
            [qId]: { ...questionRankings, [optionId]: rank },
          },
        };
      }
    });

    // Remove from skipped when answer is provided
    if (rank !== null) {
      setSkipped((prev) => {
        const s = new Set(prev[sectionId!] || []);
        s.delete(qId);
        return { ...prev, [sectionId!]: s };
      });
    }

    // Auto-advance to next question after a short delay
    if (willAutoAdvance) {
      setTimeout(() => {
        if (currentIndex < questions.length - 1) {
          const newIndex = currentIndex + 1;
          setCurrentIndex(newIndex);
          navigate(`/studentAssessment/sections/${sectionId}/questions/${newIndex}`);
        } else {
          // Last question of section - check for next section
          const idx = questionnaire.sections.findIndex(
            (s: any) => String(s.section.sectionId) === String(sectionId)
          );
          const next = questionnaire.sections[idx + 1];
          if (next) {
            navigate(`/studentAssessment/sections/${next.section.sectionId}/questions/0`);
          }
          // If it's the last section, stay on the question (user needs to submit)
        }
      }, 400); // 400ms delay so user can see their selection
    }
  };

  const getAvailableRanks = (currentOptionId: number): number[] => {
    const questionRankings = rankingAnswers[sectionId!]?.[qId] || {};
    const usedRanks = new Set(
      Object.entries(questionRankings)
        .filter(([optId]) => parseInt(optId) !== currentOptionId)
        .map(([, rank]) => rank)
    );

    const maxRanks = question.question.maxOptionsAllowed;
    const availableRanks: number[] = [];

    for (let i = 1; i <= maxRanks; i++) {
      if (!usedRanks.has(i)) {
        availableRanks.push(i);
      }
    }

    return availableRanks;
  };

  const saveForLaterFn = () => {
    setSavedForLater((prev) => {
      const s = new Set(prev[sectionId!] || []);
      s.add(qId);
      return { ...prev, [sectionId!]: s };
    });

    // Only go to next if not on the last question of last section
    // Otherwise stay on current question (user can use navigation to move)
    if (currentIndex < questions.length - 1) {
      // Not the last question of current section - go to next question
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      navigate(
        `/studentAssessment/sections/${sectionId}/questions/${newIndex}`
      );
    } else {
      // Last question of current section - check if there's a next section
      const idx = questionnaire.sections.findIndex(
        (s: any) => String(s.section.sectionId) === String(sectionId)
      );
      const next = questionnaire.sections[idx + 1];
      if (next) {
        // Go to next section
        navigate(
          `/studentAssessment/sections/${next.section.sectionId}/questions/0`
        );
      }
      // If no next section, just stay on current question (don't go to completed)
    }
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
        const response = await fetch(`${process.env.REACT_APP_API_URL}/assessment-answer/submit`, {
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

  const getQuestionColor = (secId: string, questionId: number) => {
    // Check regular answers
    if (answers[secId]?.[questionId]?.length) return "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
    // Check ranking answers
    const rankingCount = Object.keys(rankingAnswers[secId]?.[questionId] || {}).length;
    if (rankingCount > 0) return "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
    // Check saved for later
    if (savedForLater[secId]?.has(questionId)) return "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)";
    // Check skipped
    if (skipped[secId]?.has(questionId)) return "linear-gradient(135deg, #f87171 0%, #dc2626 100%)";
    return "#d1d5db";
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

  // Helper function to check if option has an image
  const hasOptionImage = (option: Option): boolean => {
    return !!(option.optionImageBase64 && option.optionImageBase64.trim() !== '');
  };

  // Helper function to get the image source (handles both data URL and raw base64)
  const getOptionImageSrc = (option: Option): string => {
    if (!option.optionImageBase64) return '';
    // If it's already a data URL, use as is; otherwise prepend the data URL prefix
    return option.optionImageBase64.startsWith('data:')
      ? option.optionImageBase64
      : `data:image/png;base64,${option.optionImageBase64}`;
  };

  // Helper function to render option content (image or text)
  const renderOptionContent = (option: Option, languageId?: number) => {
    if (hasOptionImage(option)) {
      return (
        <img
          src={getOptionImageSrc(option)}
          alt={option.optionText || 'Option image'}
          style={{
            maxWidth: '200px',
            maxHeight: '150px',
            objectFit: 'contain',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            filter: 'brightness(0.85) contrast(1.15)',
          }}
        />
      );
    }
    // Fall back to text
    return languageId !== undefined ? getOptionText(option, languageId) : option.optionText;
  };

  // Game handlers
  const handleLaunchGame = (gameCode: number) => {
    setActiveGameCode(gameCode);
    setIsGameActive(true);
  };

  const handleGameComplete = () => {
    // Auto-select the game option when game is completed
    if (activeGameCode && sectionId) {
      const gameOption = question.question.options.find(
        opt => opt.isGame && opt.game?.gameCode === activeGameCode
      );
      if (gameOption) {
        // Directly update answers to mark this question as answered (blue)
        setAnswers((prev) => {
          const sec = prev[sectionId] || {};
          const arr = sec[qId] || [];

          // Only add if not already selected
          if (!arr.includes(gameOption.optionId)) {
            const updated = [...arr, gameOption.optionId];
            console.log(`✅ Game completed! Marking question ${qId} as answered with option ${gameOption.optionId}`);
            return {
              ...prev,
              [sectionId]: { ...sec, [qId]: updated },
            };
          }
          return prev;
        });

        // Remove from skipped if it was there
        setSkipped((prev) => {
          const s = new Set(prev[sectionId] || []);
          s.delete(qId);
          return { ...prev, [sectionId]: s };
        });
      }
    }
    setIsGameActive(false);
    setActiveGameCode(null);
  };

  const handleGameExit = () => {
    // Don't auto-select if user exits without completing
    setIsGameActive(false);
    setActiveGameCode(null);
  };

  // Render game wrapper if active
  if (isGameActive && activeGameCode) {
    const userStudentId = localStorage.getItem('User Student id') || '';
    const userName = localStorage.getItem('userName') || 'Student';

    return (
      <AssessmentGameWrapper
        gameCode={activeGameCode}
        userStudentId={userStudentId}
        playerName={userName}
        onComplete={handleGameComplete}
        onExit={handleGameExit}
      />
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
      {/* LEFT SIDEBAR */}
      <div
        style={{
          width: 280,
          background: "rgba(255,255,255,0.98)",
          borderRight: "none",
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          position: "sticky",
          top: 0,
          boxShadow: "4px 0 30px rgba(0,0,0,0.1)",
          borderRadius: "0 24px 24px 0",
        }}
      >
        {/* Color Legend - Moved to Top with logo clearance */}
        <div
          style={{
            borderBottom: "2px solid #e2e8f0",
            padding: "20px 20px 20px 20px",
            background: "linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)",
          }}
        >
          <h6 style={{
            fontSize: "0.95rem",
            fontWeight: 700,
            color: "#2d3748",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <span style={{
              width: "6px",
              height: "20px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: "3px"
            }} />
            Legend
          </h6>
          <div className="d-flex flex-column gap-2">
            <div className="d-flex align-items-center gap-2">
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", flexShrink: 0, boxShadow: "0 2px 6px rgba(102, 126, 234, 0.4)" }} />
              <span style={{ fontSize: "0.85rem", color: "#4a5568", fontWeight: 500 }}>Answered</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)", flexShrink: 0, boxShadow: "0 2px 6px rgba(251, 191, 36, 0.4)" }} />
              <span style={{ fontSize: "0.85rem", color: "#4a5568", fontWeight: 500 }}>Saved for Later</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "linear-gradient(135deg, #f87171 0%, #dc2626 100%)", flexShrink: 0, boxShadow: "0 2px 6px rgba(248, 113, 113, 0.4)" }} />
              <span style={{ fontSize: "0.85rem", color: "#4a5568", fontWeight: 500 }}>Skipped</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#d1d5db", flexShrink: 0, border: "2px solid #9ca3af" }} />
              <span style={{ fontSize: "0.85rem", color: "#4a5568", fontWeight: 500 }}>Not Visited</span>
            </div>
          </div>
        </div>

        {/* Question Navigation - Scrollable area */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <h6 style={{
            fontSize: "0.95rem",
            fontWeight: 700,
            color: "#2d3748",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <span style={{
              width: "6px",
              height: "20px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: "3px"
            }} />
            Question Status
          </h6>
          {questionnaire.sections.map((sec: any) => (
            <div key={sec.section.sectionId} className="mb-4">
              <div style={{
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "#4a5568",
                marginBottom: "10px",
                padding: "6px 12px",
                background: "rgba(102, 126, 234, 0.08)",
                borderRadius: "8px",
                borderLeft: "3px solid #667eea"
              }}>
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
                      width: 32,
                      height: 32,
                      borderRadius: "8px",
                      background: getQuestionColor(
                        String(sec.section.sectionId),
                        q.questionnaireQuestionId
                      ),
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
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
          alignItems: "flex-start",
          padding: "30px 30px 30px 20px",
          overflowY: "auto",
        }}
      >
        <div
          className="card"
          style={{
            width: "auto",
            minWidth: "900px",
            maxWidth: "1200px",
            minHeight: "auto",
            borderRadius: "24px",
            border: "none",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)"
          }}
        >
          <div className="card-body p-5">
            {/* Section Name Badge */}
            <div className="mb-3">
              <span
                style={{
                  background: "linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)",
                  color: "#667eea",
                  padding: "8px 20px",
                  borderRadius: "30px",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  display: "inline-block",
                  border: "1px solid rgba(102, 126, 234, 0.3)",
                }}
              >
                {currentSection?.section?.sectionName}
              </span>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-4">
              <h6 style={{ color: "#2d3748", fontWeight: 700, marginBottom: 0, fontSize: "1.1rem" }}>
                Question {currentIndex + 1} of {questions.length}
              </h6>
              <div
                style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  padding: "10px 24px",
                  borderRadius: "30px",
                  fontWeight: 700,
                  fontSize: "1rem",
                  color: "white",
                  boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
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
                        {/* {lang.language.languageName} */}
                      </h6>
                      <div
                        style={{
                          fontSize: "1.2rem",
                          lineHeight: "1.7",
                          whiteSpace: "pre-line",
                          color: "#1a202c",
                          fontWeight: 500,
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
              <h4 className="mb-4" style={{ fontSize: "1.2rem", color: "#1a202c", fontWeight: 500 }}>{question.question.questionText}</h4>
            )}

            {/* Display maxOptionsAllowed */}
            <div className="text-muted mb-3">
              <small style={{ fontSize: "1.1rem", color: "#4a5568", fontWeight: 500 }}>
                {question.question.questionType === "ranking" ? (
                  <>
                    Please rank <strong>{question.question.maxOptionsAllowed}</strong> option(s) in order of preference (1 = most important).
                  </>
                ) : (
                  <>
                    You can select up to <strong>{question.question.maxOptionsAllowed}</strong> option(s).
                  </>
                )}
              </small>
            </div>

            <div className="mt-4">
              {(() => {
                const options = question.question.options;
                const isRankingQuestion = question.question.questionType === "ranking";

                // Helper function to render a single option (for both layouts)
                const renderOption = (opt: Option, optIndex: number) => {
                  // Check if this is a game-type option
                  if (opt.isGame && opt.game) {
                    return (
                      <div
                        key={opt.optionId}
                        className="border rounded p-4 mb-3 bg-gradient-to-r from-purple-50 to-pink-50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-bold text-purple-900 mb-2" style={{ fontSize: "1.1rem", color: "#2d3748" }}>
                              🎮 Game: {opt.game.gameName}
                            </div>
                            {languages.length > 0 ? (
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: languages.length > 1 ? "1fr 1px 1fr" : "1fr",
                                  gap: 15,
                                }}
                              >
                                {languages.map((lang, index) => (
                                  <React.Fragment key={lang.language.languageId}>
                                    <div style={{ fontSize: "1.2rem", lineHeight: "1.6", color: "#2d3748" }}>
                                      {getOptionText(opt, lang.language.languageId)}
                                    </div>
                                    {index === 0 && languages.length > 1 && (
                                      <div style={{ width: 1, backgroundColor: "#dee2e6" }} />
                                    )}
                                  </React.Fragment>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: "1.2rem", color: "#2d3748" }}>{opt.optionText}</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleLaunchGame(opt.game!.gameCode)}
                            style={{
                              marginLeft: '16px',
                              background: selectedOptions.includes(opt.optionId)
                                ? 'linear-gradient(to right, #22c55e, #16a34a)'
                                : 'linear-gradient(to right, #8b5cf6, #d946ef)',
                              color: 'white',
                              padding: '12px 24px',
                              borderRadius: '9999px',
                              fontWeight: 700,
                              fontSize: '14px',
                              border: 'none',
                              cursor: selectedOptions.includes(opt.optionId) ? 'default' : 'pointer',
                              boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
                              transition: 'all 0.2s ease',
                              opacity: selectedOptions.includes(opt.optionId) ? 0.8 : 1,
                            }}
                            disabled={selectedOptions.includes(opt.optionId)}
                          >
                            {selectedOptions.includes(opt.optionId) ? '✓ Completed' : '🎮 Launch Game'}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (isRankingQuestion) {
                    // Ranking question UI with dropdown
                    const currentRank = rankingAnswers[sectionId!]?.[qId]?.[opt.optionId];
                    const availableRanks = getAvailableRanks(opt.optionId);

                    return (
                      <div
                        key={opt.optionId}
                        className={`border rounded p-3 d-block mb-2 ${currentRank ? "bg-light" : ""}`}
                        style={{ display: "flex", alignItems: "center", gap: "15px" }}
                      >
                        <div style={{ minWidth: "120px" }}>
                          <select
                            className="form-select form-select-sm"
                            value={currentRank || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              handleRankChange(opt.optionId, value ? parseInt(value) : null);
                            }}
                            style={{ width: "110px", fontSize: "1rem", fontWeight: 600, color: "#2d3748" }}
                          >
                            <option value="">Rank</option>
                            {currentRank && !availableRanks.includes(currentRank) ? (
                              <option value={currentRank}>{currentRank}</option>
                            ) : null}
                            {availableRanks.map((rank) => (
                              <option key={rank} value={rank}>
                                {rank}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          {hasOptionImage(opt) ? (
                            renderOptionContent(opt)
                          ) : languages.length > 0 ? (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: languages.length > 1 ? "1fr 1px 1fr" : "1fr",
                                gap: 15,
                              }}
                            >
                              {languages.map((lang, index) => (
                                <React.Fragment key={lang.language.languageId}>
                                  <div style={{ fontSize: "1.2rem", lineHeight: "1.6", color: "#2d3748" }}>
                                    {getOptionText(opt, lang.language.languageId)}
                                  </div>
                                  {index === 0 && languages.length > 1 && (
                                    <div style={{ width: 1, backgroundColor: "#dee2e6" }} />
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: "1.2rem", color: "#2d3748" }}>{opt.optionText}</span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Regular checkbox UI for single/multiple choice
                  return (
                    <label
                      key={opt.optionId}
                      className={`border rounded p-3 d-block mb-2 ${selectedOptions.includes(opt.optionId) ? "bg-light" : ""
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
                        {hasOptionImage(opt) ? (
                          <div style={{ flex: 1 }}>
                            {renderOptionContent(opt)}
                          </div>
                        ) : languages.length > 0 ? (
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
                                <div style={{ fontSize: "1.2rem", lineHeight: "1.6", color: "#2d3748" }}>
                                  {getOptionText(opt, lang.language.languageId)}
                                </div>
                                {index === 0 && languages.length > 1 && (
                                  <div style={{ width: 1, backgroundColor: "#dee2e6" }} />
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: "1.2rem", color: "#2d3748" }}>{opt.optionText}</span>
                        )}
                      </div>
                    </label>
                  );
                };

                // If more than 5 options, use 2-column layout
                if (options.length > 5) {
                  const midpoint = Math.ceil(options.length / 2);
                  const leftColumn = options.slice(0, midpoint);
                  const rightColumn = options.slice(midpoint);

                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                      {/* Left Column */}
                      <div>
                        {leftColumn.map((opt, idx) => renderOption(opt, idx))}
                      </div>
                      {/* Right Column */}
                      <div>
                        {rightColumn.map((opt, idx) => renderOption(opt, midpoint + idx))}
                      </div>
                    </div>
                  );
                }

                // 5 or fewer options - single column layout
                return options.map((opt, idx) => renderOption(opt, idx));
              })()}
            </div>

            <div className="d-flex justify-content-between mt-5 pt-3" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button
                disabled={currentIndex === 0}
                onClick={goBack}
                style={{
                  background: currentIndex === 0 ? "#e2e8f0" : "white",
                  color: currentIndex === 0 ? "#9ca3af" : "#4a5568",
                  border: "2px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "12px 28px",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  cursor: currentIndex === 0 ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                ← Back
              </button>
              <div className="d-flex gap-3">
                {selectedOptions.length === 0 && (
                  <button
                    onClick={saveForLaterFn}
                    style={{
                      background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
                      color: "#78350f",
                      border: "none",
                      borderRadius: "12px",
                      padding: "12px 24px",
                      fontWeight: 600,
                      fontSize: "0.95rem",
                      cursor: "pointer",
                      boxShadow: "0 4px 15px rgba(251, 191, 36, 0.4)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    Save for Later
                  </button>
                )}
                {isLastQuestionOfLastSection() ? (
                  <button
                    onClick={handleSubmitAssessment}
                    style={{
                      background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      padding: "12px 32px",
                      fontWeight: 700,
                      fontSize: "1rem",
                      cursor: "pointer",
                      boxShadow: "0 4px 15px rgba(34, 197, 94, 0.4)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    ✓ SUBMIT ASSESSMENT
                  </button>
                ) : (
                  <button
                    onClick={goNext}
                    style={{
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      color: "white",
                      border: "none",
                      borderRadius: "12px",
                      padding: "12px 32px",
                      fontWeight: 600,
                      fontSize: "0.95rem",
                      cursor: "pointer",
                      boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {currentIndex === questions.length - 1
                      ? "NEXT SECTION →"
                      : "NEXT →"}
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