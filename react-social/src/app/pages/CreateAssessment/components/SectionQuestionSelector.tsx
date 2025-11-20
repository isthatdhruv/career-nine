import React, { FC } from "react";

type Section = {
  sectionId?: string | number;
  sectionName?: string;
  name?: string;
  id?: string | number;
};

type Question = {
  questionId?: string | number;
  id?: string | number;
  questionText?: string;
  question?: string;
};

type FormikValues = {
  sectionQuestions?: { [sectionId: string]: string[] };
  sectionQuestionsOrder?: { [sectionId: string]: { [questionId: string]: number } };
  sectionIds?: string[];
  name?: string;
  price?: number;
  isFree?: string;
  collegeId?: string;
  toolId?: string;
};

interface SectionQuestionSelectorProps {
  sectionIds: string[];
  sections: Section[];
  selectedSection: string;
  onSelectSection: (sectionId: string) => void;
  onCreateQuestion?: () => void;
  createButtonLabel?: string;
  questions: Question[];
  values: FormikValues;
  setFieldValue: (field: string, value: any) => void;
}

const SectionQuestionSelector: FC<SectionQuestionSelectorProps> = ({
  sectionIds,
  sections,
  selectedSection,
  onSelectSection,
  onCreateQuestion,
  createButtonLabel = "Create New Question",
  questions,
  values,
  setFieldValue,
}) => {
  const getSectionName = (sectionId: string) => {
    const s = sections.find(
      (sec) => String(sec.sectionId ?? sec.id ?? "") === String(sectionId)
    );
    return s ? String(s.sectionName ?? s.name ?? `Section ${sectionId}`) : `Section ${sectionId}`;
  };

  return (
    <>
      {/* Section Selection Dropdown */}
      <div className="fv-row mb-4">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <label className="fs-6 fw-bold">Choose Section to Add Questions:</label>
          {onCreateQuestion && (
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={onCreateQuestion}
            >
              <i className="fas fa-plus me-1" />
              {createButtonLabel}
            </button>
          )}
        </div>

        <select
          className="form-select form-select-solid"
          value={selectedSection}
          onChange={(e) => onSelectSection(e.target.value)}
          name="selectedSectionForQuestions"
        >
          <option value="">-- Select a section to add questions --</option>
          {Array.isArray(sectionIds) &&
            sectionIds.map((sectionId) => {
              const count = (values.sectionQuestions?.[sectionId] || []).length;
              return (
                <option key={sectionId} value={sectionId}>
                  {getSectionName(sectionId)} {count > 0 ? `(${count} selected)` : ""}
                </option>
              );
            })}
        </select>
      </div>

      {/* Questions List for Selected Section */}
      {selectedSection && (
        <div className="card mt-4">
          <div className="card-header bg-light">
            <h5 className="card-title mb-0">
              <i className="fas fa-layer-group text-secondary me-2"></i>
              {getSectionName(selectedSection)}
            </h5>
          </div>
          <div className="card-body">
            <div className="mb-3">
              <label className="fs-6 fw-bold">Available Questions:</label>
            </div>
            
            <div 
              className="border rounded p-3" 
              style={{ maxHeight: '300px', overflowY: 'auto' }}
            >
              {questions.length > 0 ? (
                <div className="questions-list">
                  {questions.map((question, qIndex) => {
                    const questionId = String(question.questionId || question.id || qIndex);
                    const questionsField = `sectionQuestions.${selectedSection}`;
                    const orderField = `sectionQuestionsOrder.${selectedSection}`;

                    const selectedForSection: string[] = values.sectionQuestions?.[selectedSection] || [];
                    const orderMap: { [k: string]: number } = values.sectionQuestionsOrder?.[selectedSection] || {};
                    
                    const checked = selectedForSection.includes(questionId);
                    const totalAssigned = selectedForSection.length;
                    const currentOrder = orderMap[questionId];

                    const ownerSectionId = Object.keys(values.sectionQuestions || {}).find(
                      (sid) => sid !== selectedSection && (values.sectionQuestions?.[sid] || []).includes(questionId)
                    );
                    const ownerName = ownerSectionId ? getSectionName(ownerSectionId) : undefined;
                    const disabled = !!ownerSectionId;

                    const handleCheckChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                      const isChecking = e.target.checked;
                      const currentQuestions = [...selectedForSection];
                      const currentOrders = { ...orderMap };

                      if (isChecking) {
                        if (!currentQuestions.includes(questionId)) {
                          currentQuestions.push(questionId);
                          const nextOrder = Math.max(0, ...Object.values(currentOrders).map(Number)) + 1;
                          currentOrders[questionId] = nextOrder;
                        }
                      } else {
                        const index = currentQuestions.indexOf(questionId);
                        if (index > -1) {
                          currentQuestions.splice(index, 1);
                          delete currentOrders[questionId];
                          const sortedRemaining = currentQuestions.sort((a, b) => (currentOrders[a] || 0) - (currentOrders[b] || 0));
                          sortedRemaining.forEach((qid, idx) => { currentOrders[qid] = idx + 1; });
                        }
                      }
                      setFieldValue(questionsField, currentQuestions);
                      setFieldValue(orderField, currentOrders);
                    };

                    const handleOrderChange = (newOrder: number) => {
                      const currentOrders = { ...orderMap };
                      const otherQid = Object.keys(currentOrders).find(qid => currentOrders[qid] === newOrder);
                      if (otherQid && otherQid !== questionId) {
                        currentOrders[otherQid] = currentOrder;
                      }
                      currentOrders[questionId] = newOrder;
                      setFieldValue(orderField, currentOrders);
                    };

                    return (
                      <div key={questionId} className="form-check mb-2 d-flex align-items-start">
                        <input
                          type="checkbox"
                          className="form-check-input mt-1"
                          id={`question-${selectedSection}-${questionId}`}
                          checked={checked}
                          disabled={disabled}
                          onChange={handleCheckChange}
                        />
                        <div className="ms-2 w-100">
                          <div className="d-flex justify-content-between align-items-start">
                            <label
                              className="form-check-label d-block"
                              htmlFor={`question-${selectedSection}-${questionId}`}
                            >
                              {question.questionText || question.question || "Question text not available"}
                            </label>

                            {checked && (
                              <select
                                className="form-select form-select-sm w-auto ms-3"
                                value={currentOrder}
                                onChange={(e) => handleOrderChange(Number(e.target.value))}
                              >
                                {Array.from({ length: totalAssigned }).map((_, i) => (
                                  <option key={i + 1} value={i + 1}>
                                    {i + 1}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          {disabled && ownerSectionId && (
                            <div className="mt-1">
                              <small className="text-muted">(selected in: {ownerName})</small>
                              <button
                                type="button"
                                className="btn btn-sm btn-link ms-3 p-0"
                                onClick={() => {
                                  // 1. Remove from owner section
                                  const ownerQuestionsField = `sectionQuestions.${ownerSectionId}`;
                                  const ownerOrderField = `sectionQuestionsOrder.${ownerSectionId}`;
                                  const ownerSelected = (values.sectionQuestions?.[ownerSectionId] || []).filter(id => id !== questionId);
                                  const ownerOrders = { ...(values.sectionQuestionsOrder?.[ownerSectionId] || {}) };
                                  delete ownerOrders[questionId];
                                  
                                  // Re-sequence owner section
                                  const sortedOwner = ownerSelected.sort((a, b) => (ownerOrders[a] || 0) - (ownerOrders[b] || 0));
                                  sortedOwner.forEach((qid, idx) => { ownerOrders[qid] = idx + 1; });

                                  setFieldValue(ownerQuestionsField, ownerSelected);
                                  setFieldValue(ownerOrderField, ownerOrders);

                                  // 2. Add to current section
                                  const currentQuestions = [...selectedForSection];
                                  const currentOrders = { ...orderMap };
                                  if (!currentQuestions.includes(questionId)) {
                                    currentQuestions.push(questionId);
                                    const nextOrder = Math.max(0, ...Object.values(currentOrders).map(Number)) + 1;
                                    currentOrders[questionId] = nextOrder;
                                    setFieldValue(questionsField, currentQuestions);
                                    setFieldValue(orderField, currentOrders);
                                  }
                                }}
                              >
                                Reassign here
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-muted text-center py-3">
                  <i className="fas fa-question-circle fa-2x mb-2"></i>
                  <p>No questions available. Create some questions first.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SectionQuestionSelector;