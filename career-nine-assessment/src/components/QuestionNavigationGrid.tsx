import React from 'react';

type QuestionNavItem = {
  questionnaireQuestionId: number;
  index: number;
};

type QuestionNavigationGridProps = {
  questions: QuestionNavItem[];
  sectionId: string;
  currentIndex: number;
  getQuestionColor: (secId: string, questionId: number) => string;
  onQuestionClick: (index: number) => void;
};

const QuestionNavigationGrid: React.FC<QuestionNavigationGridProps> = React.memo(({
  questions,
  sectionId,
  currentIndex,
  getQuestionColor,
  onQuestionClick,
}) => {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))",
      gap: "6px",
    }}>
      {questions.map((q, idx) => (
        <button
          type="button"
          key={q.questionnaireQuestionId}
          onClick={() => onQuestionClick(idx)}
          title={`Question ${idx + 1}`}
          style={{
            padding: 0,
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: "0.75rem",
            fontWeight: currentIndex === idx ? "bold" : "normal",
            background: getQuestionColor(sectionId, q.questionnaireQuestionId),
            color: "white",
            border: currentIndex === idx ? "3px solid #1e293b" : "2px solid transparent",
            transition: "all 0.2s ease",
          }}
        >
          {idx + 1}
        </button>
      ))}
    </div>
  );
});

QuestionNavigationGrid.displayName = 'QuestionNavigationGrid';

export default QuestionNavigationGrid;
