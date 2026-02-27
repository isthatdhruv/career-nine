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
      gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))",
      gap: "6px",
    }}>
      {questions.map((q, idx) => (
        <div
          key={q.questionnaireQuestionId}
          onClick={() => onQuestionClick(idx)}
          title={`Question ${idx + 1}`}
          style={{
            width: "36px",
            height: "36px",
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
        </div>
      ))}
    </div>
  );
});

QuestionNavigationGrid.displayName = 'QuestionNavigationGrid';

export default QuestionNavigationGrid;
