import clsx from "clsx";
import React, { useEffect, useState } from "react";
import { Modal, Button, Dropdown } from "react-bootstrap";
import * as XLSX from "xlsx";
import { CreateQuestionData, ReadMeasuredQualityTypes } from "../API/Question_APIs";

// Type definitions
interface ParsedQuestion {
  questionText: string;
  questionType: string;
  sectionId: string;
  maxOptionsAllowed: number;
  options: ParsedOption[];
}

interface ParsedOption {
  optionText: string;
  optionDescription: string;
  correct: boolean;
  isGame: boolean;
  gameId?: number;
  mqtScores: { mqtId: number; score: number }[];
}

interface QuestionBulkUploadModalProps {
  show: boolean;
  onHide: () => void;
  onUploadComplete: () => void;
  sections: any[];
}

const QuestionBulkUploadModal: React.FC<QuestionBulkUploadModalProps> = ({
  show,
  onHide,
  onUploadComplete,
  sections,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [uploadResults, setUploadResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [mqt, setMqt] = useState<any[]>([]);

  // State for managing measured qualities per option
  const [optionMeasuredQualities, setOptionMeasuredQualities] = useState<
    Record<number, Record<number, { checked: boolean; score: number }>>
  >({});

  // Fetch measured quality types on mount
  useEffect(() => {
    const fetchMQT = async () => {
      try {
        const response = await ReadMeasuredQualityTypes();
        setMqt(response.data);
      } catch (error) {
        console.error("Error fetching MQT:", error);
        setMqt([]);
      }
    };
    if (show) {
      fetchMQT();
    }
  }, [show]);

  // Reset state when modal closes
  useEffect(() => {
    if (!show) {
      setFile(null);
      setQuestions([]);
      setCurrentIndex(0);
      setUploadResults(null);
      setOptionMeasuredQualities({});
    }
  }, [show]);

  // Parse MQT scores from string format "MQTName:Score,MQTName:Score"
  const parseMqtScoresFromString = (
    mqtString: string | undefined,
    mqtList: any[]
  ): { mqtId: number; score: number }[] => {
    const scores: { mqtId: number; score: number }[] = [];

    if (!mqtString || !mqtString.trim()) {
      return scores;
    }

    // Format: "Analytical:10,Creativity:5,Leadership:8"
    const pairs = mqtString.split(",");

    pairs.forEach((pair) => {
      const [mqtName, scoreStr] = pair.split(":").map((s) => s.trim());

      if (mqtName && scoreStr) {
        const mqtObj = mqtList.find(
          (m) =>
            m.measuredQualityTypeName.toLowerCase() === mqtName.toLowerCase()
        );

        if (mqtObj) {
          scores.push({
            mqtId: mqtObj.measuredQualityTypeId,
            score: Number(scoreStr),
          });
        }
      }
    });

    return scores;
  };

  // Parse Excel file
  const parseExcelFile = async (file: File): Promise<ParsedQuestion[]> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    // Validate required columns exist
    if (rows.length === 0) {
      throw new Error("Excel file is empty");
    }

    const firstRow = rows[0];
    const requiredColumns = ["Question Text", "Question Type", "Section ID"];
    const missingColumns = requiredColumns.filter((col) => !(col in firstRow));

    if (missingColumns.length > 0) {
      throw new Error(
        `Missing required columns: ${missingColumns.join(", ")}`
      );
    }

    // Each row is one question
    const questions: ParsedQuestion[] = [];

    rows.forEach((row: any) => {
      const questionText = row["Question Text"]?.trim();
      if (!questionText) return; // Skip empty rows

      // Extract options from Option 1 Text, Option 2 Text, etc. columns
      const options: ParsedOption[] = [];

      // Check for up to 6 options
      for (let i = 1; i <= 6; i++) {
        const optionTextCol = `Option ${i} Text`;
        const optionDescCol = `Option ${i} Description`;
        const optionCorrectCol = `Option ${i} Is Correct`;
        const optionMqtCol = `Option ${i} MQTs`;

        const optionText = row[optionTextCol]?.trim();

        // Stop if no more options
        if (!optionText) break;

        // Parse MQT scores from string format
        const mqtScores = parseMqtScoresFromString(row[optionMqtCol], mqt);

        options.push({
          optionText,
          optionDescription: row[optionDescCol]?.trim() || "",
          correct:
            String(row[optionCorrectCol]).toLowerCase() === "yes" ||
            row[optionCorrectCol] === true,
          isGame: false,
          gameId: undefined,
          mqtScores,
        });
      }

      // Create question object
      const question: ParsedQuestion = {
        questionText,
        questionType: row["Question Type"]?.trim() || "",
        sectionId: String(row["Section ID"] || ""),
        maxOptionsAllowed: Number(row["Max Options Allowed"]) || 0,
        options,
      };

      questions.push(question);
    });

    return questions;
  };

  // Handle file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (
      !selectedFile.name.endsWith(".xlsx") &&
      !selectedFile.name.endsWith(".xls")
    ) {
      alert("Please select a valid Excel file (.xlsx or .xls)");
      return;
    }

    // Validate file size (warn if > 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      const proceed = window.confirm(
        "File size is over 5MB. This may take longer to process. Continue?"
      );
      if (!proceed) return;
    }

    setFile(selectedFile);
    setParsing(true);

    try {
      const parsedQuestions = await parseExcelFile(selectedFile);

      if (parsedQuestions.length === 0) {
        alert("No valid questions found in Excel file");
        setFile(null);
        return;
      }

      setQuestions(parsedQuestions);
      setCurrentIndex(0);

      // Initialize option measured qualities from parsed data
      const initialMQ: Record<number, Record<number, { checked: boolean; score: number }>> = {};
      parsedQuestions[0].options.forEach((option, idx) => {
        initialMQ[idx] = {};
        option.mqtScores.forEach((mqtScore) => {
          initialMQ[idx][mqtScore.mqtId] = {
            checked: true,
            score: mqtScore.score,
          };
        });
      });
      setOptionMeasuredQualities(initialMQ);

      alert(`Successfully parsed ${parsedQuestions.length} questions from Excel file`);
    } catch (error: any) {
      console.error("Error parsing Excel:", error);
      alert(`Failed to parse Excel file: ${error.message}`);
      setFile(null);
    } finally {
      setParsing(false);
    }
  };

  // Update current question in state
  const updateCurrentQuestion = (updated: ParsedQuestion) => {
    const newQuestions = [...questions];
    newQuestions[currentIndex] = updated;
    setQuestions(newQuestions);
  };

  // Handle navigation to next question
  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      // Save current question's MQT data to options
      saveCurrentMQTToQuestion();

      setCurrentIndex(currentIndex + 1);

      // Load next question's MQT data
      loadMQTFromQuestion(currentIndex + 1);
    }
  };

  // Handle navigation to previous question
  const handlePrevious = () => {
    if (currentIndex > 0) {
      // Save current question's MQT data
      saveCurrentMQTToQuestion();

      setCurrentIndex(currentIndex - 1);

      // Load previous question's MQT data
      loadMQTFromQuestion(currentIndex - 1);
    }
  };

  // Save current MQT state to question options
  const saveCurrentMQTToQuestion = () => {
    const updatedQuestion = { ...questions[currentIndex] };
    updatedQuestion.options = updatedQuestion.options.map((option, idx) => {
      const mqtScores: { mqtId: number; score: number }[] = [];
      const optionMQ = optionMeasuredQualities[idx] || {};

      Object.entries(optionMQ).forEach(([typeId, val]) => {
        if (val.checked) {
          mqtScores.push({
            mqtId: Number(typeId),
            score: val.score,
          });
        }
      });

      return { ...option, mqtScores };
    });

    const newQuestions = [...questions];
    newQuestions[currentIndex] = updatedQuestion;
    setQuestions(newQuestions);
  };

  // Load MQT data from question to state
  const loadMQTFromQuestion = (questionIndex: number) => {
    const question = questions[questionIndex];
    const newMQ: Record<number, Record<number, { checked: boolean; score: number }>> = {};

    question.options.forEach((option, idx) => {
      newMQ[idx] = {};
      option.mqtScores.forEach((mqtScore) => {
        newMQ[idx][mqtScore.mqtId] = {
          checked: true,
          score: mqtScore.score,
        };
      });
    });

    setOptionMeasuredQualities(newMQ);
  };

  // Helper: toggle measured quality type for an option
  const handleQualityToggle = (optionIdx: number, typeId: number) => {
    setOptionMeasuredQualities((prev) => {
      const prevForOption = prev[optionIdx] || {};
      const current = prevForOption[typeId];
      if (current && current.checked) {
        // Uncheck
        const { [typeId]: _, ...rest } = prevForOption;
        return { ...prev, [optionIdx]: rest };
      } else {
        // Check with default score 0
        return {
          ...prev,
          [optionIdx]: {
            ...prevForOption,
            [typeId]: { checked: true, score: 0 },
          },
        };
      }
    });
  };

  // Helper: change score for a measured quality type for an option
  const handleQualityScoreChange = (
    optionIdx: number,
    typeId: number,
    score: number
  ) => {
    setOptionMeasuredQualities((prev) => ({
      ...prev,
      [optionIdx]: {
        ...prev[optionIdx],
        [typeId]: { checked: true, score },
      },
    }));
  };

  // Add option
  const addOption = () => {
    const currentQuestion = questions[currentIndex];
    const newOption: ParsedOption = {
      optionText: "",
      optionDescription: "",
      correct: false,
      isGame: false,
      gameId: undefined,
      mqtScores: [],
    };

    const updatedQuestion = {
      ...currentQuestion,
      options: [...currentQuestion.options, newOption],
    };

    updateCurrentQuestion(updatedQuestion);

    // Initialize MQT state for new option
    setOptionMeasuredQualities((prev) => ({
      ...prev,
      [currentQuestion.options.length]: {},
    }));
  };

  // Remove option
  const removeOption = (index: number) => {
    const currentQuestion = questions[currentIndex];
    if (currentQuestion.options.length <= 1) {
      alert("At least one option is required");
      return;
    }

    const updatedQuestion = {
      ...currentQuestion,
      options: currentQuestion.options.filter((_, i) => i !== index),
    };

    updateCurrentQuestion(updatedQuestion);

    // Shift MQT keys
    setOptionMeasuredQualities((prev) => {
      const newMQ: any = {};
      Object.keys(prev).forEach((key) => {
        const k = Number(key);
        if (k < index) newMQ[k] = prev[k];
        else if (k > index) newMQ[k - 1] = prev[k];
      });
      return newMQ;
    });
  };

  // Update option text
  const updateOptionText = (index: number, value: string) => {
    const currentQuestion = questions[currentIndex];
    const updatedOptions = [...currentQuestion.options];
    updatedOptions[index] = { ...updatedOptions[index], optionText: value };

    updateCurrentQuestion({ ...currentQuestion, options: updatedOptions });
  };

  // Update option description
  const updateOptionDescription = (index: number, value: string) => {
    const currentQuestion = questions[currentIndex];
    const updatedOptions = [...currentQuestion.options];
    updatedOptions[index] = {
      ...updatedOptions[index],
      optionDescription: value,
    };

    updateCurrentQuestion({ ...currentQuestion, options: updatedOptions });
  };

  // Convert to backend payload format
  const convertToBackendPayload = (question: ParsedQuestion) => {
    return {
      questionText: question.questionText,
      questionType: question.questionType,
      maxOptionsAllowed: question.maxOptionsAllowed,
      section: { sectionId: Number(question.sectionId) },
      flag: 0,
      options: question.options.map((opt) => ({
        optionText: opt.optionText,
        optionImageBase64: null,
        optionDescription: opt.optionDescription || null,
        correct: opt.correct,
        isGame: opt.isGame,
        game: opt.gameId ? { gameId: opt.gameId } : null,
        optionScores: opt.mqtScores.map((mqt) => ({
          score: mqt.score,
          question_option: {},
          measuredQualityType: { measuredQualityTypeId: mqt.mqtId },
        })),
      })),
    };
  };

  // Handle bulk submit
  const handleBulkSubmit = async () => {
    // Save current question's MQT data before submitting
    saveCurrentMQTToQuestion();

    setUploading(true);
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Loop through all questions
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];

      try {
        // Validate question
        if (!question.questionText?.trim()) {
          throw new Error("Question text is required");
        }
        if (!question.questionType?.trim()) {
          throw new Error("Question type is required");
        }
        if (!question.sectionId) {
          throw new Error("Section ID is required");
        }
        if (question.options.length === 0) {
          throw new Error("At least one option is required");
        }

        // Convert to backend payload format
        const payload = convertToBackendPayload(question);

        // POST to /assessment-questions/create
        await CreateQuestionData(payload);

        successCount++;
      } catch (error: any) {
        failedCount++;
        const errorMsg = `Question "${question.questionText.substring(0, 50)}...": ${
          error.response?.data?.message || error.message
        }`;
        errors.push(errorMsg);
        console.error(`Failed to upload question ${i + 1}:`, error);
      }
    }

    setUploadResults({ success: successCount, failed: failedCount, errors });
    setUploading(false);

    // Refresh parent table if any succeeded
    if (successCount > 0) {
      onUploadComplete();
    }
  };

  const currentQuestion = questions[currentIndex];

  return (
    <Modal show={show} onHide={onHide} size="xl" centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Bulk Upload Questions from Excel</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {/* File Upload Section */}
        {!file && (
          <div className="mb-4">
            <label className="form-label fw-bold">Select Excel File:</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="form-control"
              disabled={parsing}
            />
            {parsing && (
              <div className="mt-2 text-primary">
                <span className="spinner-border spinner-border-sm me-2"></span>
                Parsing Excel file...
              </div>
            )}
          </div>
        )}

        {/* Results Summary */}
        {uploadResults && (
          <div className="alert alert-info">
            <h5>Upload Results:</h5>
            <p>
              ✅ Success: {uploadResults.success} <br />
              {uploadResults.failed > 0 && (
                <>
                  ❌ Failed: {uploadResults.failed}
                  <br />
                  <strong>Errors:</strong>
                  <ul>
                    {uploadResults.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </>
              )}
            </p>
            <Button variant="primary" onClick={onHide}>
              Close
            </Button>
          </div>
        )}

        {/* Question Preview/Edit Form */}
        {file && currentQuestion && !uploadResults && (
          <>
            {/* Question Counter */}
            <div className="mb-3">
              <h4 className="text-primary">
                Question {currentIndex + 1} of {questions.length}
              </h4>
            </div>

            {/* Question Text */}
            <div className="fv-row mb-4">
              <label className="required fs-6 fw-bold mb-2">
                Question Text:
              </label>
              <textarea
                rows={4}
                className={clsx("form-control form-control-lg form-control-solid", {
                  "is-invalid text-danger": !currentQuestion.questionText,
                  "is-valid": !!currentQuestion.questionText,
                })}
                value={currentQuestion.questionText}
                onChange={(e) =>
                  updateCurrentQuestion({
                    ...currentQuestion,
                    questionText: e.target.value,
                  })
                }
                placeholder="Enter question text"
              />
            </div>

            {/* Question Type */}
            <div className="fv-row mb-4">
              <label className="required fs-6 fw-bold mb-2">
                Question Type:
              </label>
              <select
                className={clsx("form-control form-control-lg form-control-solid", {
                  "is-invalid text-danger": !currentQuestion.questionType,
                  "is-valid": !!currentQuestion.questionType,
                })}
                value={currentQuestion.questionType}
                onChange={(e) =>
                  updateCurrentQuestion({
                    ...currentQuestion,
                    questionType: e.target.value,
                  })
                }
              >
                <option value="">Select Question Type</option>
                <option value="multiple-choice">Multiple Choice</option>
                <option value="single-choice">Single Choice</option>
                <option value="ranking">Ranking</option>
              </select>
            </div>

            {/* Section */}
            <div className="fv-row mb-4">
              <label className="required fs-6 fw-bold mb-2">Section:</label>
              <select
                className={clsx("form-control form-control-lg form-control-solid", {
                  "is-invalid text-danger": !currentQuestion.sectionId,
                  "is-valid": !!currentQuestion.sectionId,
                })}
                value={currentQuestion.sectionId}
                onChange={(e) =>
                  updateCurrentQuestion({
                    ...currentQuestion,
                    sectionId: e.target.value,
                  })
                }
              >
                <option value="">Select Section</option>
                {sections.map((section) => (
                  <option key={section.sectionId} value={section.sectionId}>
                    {section.sectionName}
                  </option>
                ))}
              </select>
            </div>

            {/* Max Options Allowed */}
            <div className="fv-row mb-4">
              <label className="fs-6 fw-bold mb-2">Max Options Allowed:</label>
              <input
                type="number"
                min={0}
                max={100}
                className="form-control form-control-lg form-control-solid w-25"
                value={currentQuestion.maxOptionsAllowed}
                onChange={(e) =>
                  updateCurrentQuestion({
                    ...currentQuestion,
                    maxOptionsAllowed: Number(e.target.value),
                  })
                }
              />
            </div>

            {/* Options */}
            <div className="fv-row mb-4">
              <label className="required fs-6 fw-bold mb-2">Options:</label>
              {currentQuestion.options.map((option, index) => (
                <div key={index} className="mb-3 p-3 border rounded bg-light">
                  <div className="d-flex align-items-center mb-2">
                    <span className="me-2 fw-bold">Option {index + 1}:</span>
                  </div>

                  <div className="d-flex align-items-start gap-2">
                    <input
                      type="text"
                      placeholder={`Enter option ${index + 1}`}
                      value={option.optionText}
                      onChange={(e) => updateOptionText(index, e.target.value)}
                      className={clsx(
                        "form-control form-control-lg form-control-solid flex-grow-1",
                        {
                          "is-invalid text-danger": !option.optionText,
                          "is-valid": !!option.optionText,
                        }
                      )}
                    />

                    <Dropdown>
                      <Dropdown.Toggle
                        variant="secondary"
                        id={`dropdown-option-${index}`}
                        size="sm"
                      >
                        MQT
                      </Dropdown.Toggle>
                      <Dropdown.Menu style={{ minWidth: 250 }}>
                        <Dropdown.Header>Measured Quality Types</Dropdown.Header>
                        <div
                          style={{ maxHeight: 250, overflowY: "auto", padding: 8 }}
                        >
                          {mqt.map((type: any, i: number) => (
                            <div key={type.measuredQualityTypeId}>
                              <div className="d-flex align-items-center mb-2">
                                <input
                                  type="checkbox"
                                  checked={
                                    !!optionMeasuredQualities[index]?.[
                                      type.measuredQualityTypeId
                                    ]?.checked
                                  }
                                  onChange={() =>
                                    handleQualityToggle(
                                      index,
                                      type.measuredQualityTypeId
                                    )
                                  }
                                  className="form-check-input me-2"
                                  id={`option-${index}-type-${type.measuredQualityTypeId}`}
                                />
                                <label
                                  htmlFor={`option-${index}-type-${type.measuredQualityTypeId}`}
                                  className="me-2 mb-0"
                                >
                                  {type.measuredQualityTypeName}
                                </label>
                                {!!optionMeasuredQualities[index]?.[
                                  type.measuredQualityTypeId
                                ]?.checked && (
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={
                                      optionMeasuredQualities[index][
                                        type.measuredQualityTypeId
                                      ]?.score ?? 0
                                    }
                                    onChange={(e) =>
                                      handleQualityScoreChange(
                                        index,
                                        type.measuredQualityTypeId,
                                        Number(e.target.value)
                                      )
                                    }
                                    placeholder="Score"
                                    className="form-control form-control-sm ms-2"
                                    style={{ width: 70 }}
                                  />
                                )}
                              </div>
                              {i < mqt.length - 1 && (
                                <hr style={{ margin: "4px 0" }} />
                              )}
                            </div>
                          ))}
                        </div>
                      </Dropdown.Menu>
                    </Dropdown>

                    {currentQuestion.options.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => removeOption(index)}
                      >
                        -
                      </button>
                    )}
                    {index === currentQuestion.options.length - 1 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={addOption}
                      >
                        +
                      </button>
                    )}
                  </div>

                  {/* Option Description */}
                  <div className="mt-2">
                    <label className="fs-7 fw-semibold mb-1 text-muted">
                      Option Description:
                    </label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={2}
                      placeholder="Enter description for this option (optional)"
                      value={option.optionDescription || ""}
                      onChange={(e) =>
                        updateOptionDescription(index, e.target.value)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Progress Indicator */}
        {uploading && (
          <div className="text-center my-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Uploading...</span>
            </div>
            <p className="mt-2">Uploading questions to server...</p>
            <div className="progress" style={{ height: 25 }}>
              <div
                className="progress-bar progress-bar-striped progress-bar-animated"
                role="progressbar"
                style={{ width: "100%" }}
              >
                Processing...
              </div>
            </div>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        {file && currentQuestion && !uploadResults && !uploading && (
          <>
            <Button
              variant="secondary"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
            >
              ← Previous
            </Button>
            <Button
              variant="secondary"
              onClick={handleNext}
              disabled={currentIndex === questions.length - 1}
            >
              Next →
            </Button>
            <Button variant="primary" onClick={handleBulkSubmit}>
              Submit All ({questions.length} questions)
            </Button>
          </>
        )}
        {!file && !uploadResults && (
          <Button variant="secondary" onClick={onHide}>
            Cancel
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default QuestionBulkUploadModal;
