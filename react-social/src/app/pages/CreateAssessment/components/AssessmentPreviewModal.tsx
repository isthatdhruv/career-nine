import React from 'react';
import { Modal, Button } from 'react-bootstrap';

interface AssessmentPreviewModalProps {
  show: boolean;
  onHide: () => void;
  sections: any[];
  questions: any[];
  values: {
    sectionIds: string[];
    sectionQuestions: { [key: string]: string[] };
  };
}

const AssessmentPreviewModal: React.FC<AssessmentPreviewModalProps> = ({
  show,
  onHide,
  sections,
  questions,
  values,
}) => {
  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Assessment Preview</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {values.sectionIds && values.sectionIds.length > 0 ? (
          values.sectionIds.map((sectionId) => {
            const section = sections.find((s) => String(s.sectionId) === String(sectionId));
            const questionIds = values.sectionQuestions[sectionId] || [];
            return (
              <div key={sectionId} className="mb-4">
                <h4 className="text-primary border-bottom pb-2 mb-3">{section ? section.sectionName : `Section ${sectionId}`}</h4>
                {questionIds.length > 0 ? (
                  <ul className="list-group list-group-flush">
                    {questionIds.map((questionId, index) => {
                      const question = questions.find((q) => String(q.questionId) === String(questionId));
                      return (
                        <li key={questionId} className="list-group-item px-0">
                          <p className="fw-bold mb-2">{index + 1}. {question ? question.questionText : `Question not found`}</p>
                          {question && question.options && question.options.length > 0 ? (
                            <ul className="list-unstyled ps-4">
                              {question.options.map((opt: any, optIndex: number) => (
                                <li key={opt.optionId || optIndex} className="mb-1">
                                  {String.fromCharCode(65 + optIndex)}. {opt.optionText}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-muted fst-italic ps-4">No options available for this question.</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-muted">No questions have been added to this section yet.</p>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-center text-muted">Select sections and add questions to see a preview.</p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AssessmentPreviewModal;