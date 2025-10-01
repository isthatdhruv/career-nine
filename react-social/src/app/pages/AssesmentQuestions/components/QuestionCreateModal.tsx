import clsx from "clsx";
import React, { useEffect, useState } from "react";
import { Modal, Dropdown, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { ReadQuestionSectionData } from "../../QuestionSections/API/Question_Section_APIs";
import { CreateQuestionData, ReadMeasuredQualityTypes } from "../API/Question_APIs";
import { MQT } from "./MeasuredQualityTypesAsOptionComponent";

const validationSchema = Yup.object().shape({
  questionText: Yup.string().required("Question text is required"),
  questionType: Yup.string().required("Question type is required"),
  sectionId: Yup.string().required("Section is required"),
  maxOptionsAllowed: Yup.number()
});

interface QuestionCreateModalProps {
  show: boolean;
  onHide: () => void;
  setPageLoading?: any;
}

const QuestionCreateModal: React.FC<QuestionCreateModalProps> = ({ show, onHide, setPageLoading }) => {
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [mqt, setMqt] = useState<any[]>([]);
  const [optionMeasuredQualities, setOptionMeasuredQualities] = useState<any>({});
  const [useMQTAsOptions, setUseMQTAsOptions] = useState(false);
  const navigate = useNavigate();

  const initialValues = {
    questionText: "",
    questionType: "",
    maxOptionsAllowed: "",
    questionOptions: [""],
    sectionId: ""
  };

  const [formikValues, setFormikValues] = useState(initialValues);

  const handleQualityToggle = (optionIdx: number, typeId: number) => {
    setOptionMeasuredQualities((prev: any) => {
      const prevForOption = prev[optionIdx] || {};
      const current = prevForOption[typeId];
      if (current && current.checked) {
        const { [typeId]: _, ...rest } = prevForOption;
        return { ...prev, [optionIdx]: rest };
      } else {
        return {
          ...prev,
          [optionIdx]: { ...prevForOption, [typeId]: { checked: true, score: 0 } }
        };
      }
    });
  };

  const handleQualityScoreChange = (optionIdx: number, typeId: number, score: number) => {
    setOptionMeasuredQualities((prev: any) => ({
      ...prev,
      [optionIdx]: {
        ...prev[optionIdx],
        [typeId]: { checked: true, score },
      },
    }));
  };

  const addOption = () => {
    setFormikValues((prev: any) => ({ ...prev, questionOptions: [...prev.questionOptions, ""] }));
  };

  const removeOption = (index: number) => {
    setFormikValues((prev: any) => {
      const newOptions = prev.questionOptions.filter((_: any, i: number) => i !== index);
      const newMeasured = { ...optionMeasuredQualities };
      delete newMeasured[index];
      setOptionMeasuredQualities(newMeasured);
      return { ...prev, questionOptions: newOptions };
    });
  };

  const updateOption = (index: number, value: string) => {
    setFormikValues((prev: any) => {
      const newOptions = [...prev.questionOptions];
      newOptions[index] = value;
      return { ...prev, questionOptions: newOptions };
    });
  };

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const response = await ReadQuestionSectionData();
        setSections(response.data);
      } catch {
        setSections([]);
      }
    };
    fetchSections();
  }, []);

  useEffect(() => {
    const fetchMQT = async () => {
      try {
        const response = await ReadMeasuredQualityTypes();
        setMqt(response.data);
      } catch {
        setMqt([]);
      }
    };
    fetchMQT();
  }, []);

  useEffect(() => {
    if (!useMQTAsOptions) {
      setFormikValues(v => ({ ...v, questionOptions: [""] }));
      setOptionMeasuredQualities({});
    }
  }, [useMQTAsOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const options = formikValues.questionOptions.map((optionText: string, index: number) => {
        const optionScores: any[] = [];
        if (optionMeasuredQualities[index]) {
          Object.entries(optionMeasuredQualities[index]).forEach(([typeId, val]: any) => {
            if (val.checked) {
              optionScores.push({
                score: val.score,
                question_option: {},
                measuredQualityType: { measuredQualityTypeId: Number(typeId) }
              });
            }
          });
        }
        return { optionText, optionScores, correct: false };
      });

      const payload = {
        questionText: formikValues.questionText,
        questionType: formikValues.questionType,
        maxOptionsAllowed: Number(formikValues.maxOptionsAllowed) || 0,
        options,
        section: { sectionId: Number(formikValues.sectionId) }
      };

      await CreateQuestionData(payload);
      setFormikValues(initialValues);
      setOptionMeasuredQualities({});
      onHide();
      navigate("/assessment-questions");
    } catch (error) {
      console.error(error);
      window.location.replace("/error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Add Assessment Question</Modal.Title>
      </Modal.Header>
      <form onSubmit={handleSubmit}>
        <Modal.Body>
          {/* Question Text */}
          <div className="mb-3">
            <label className="form-label fw-bold">Question Text:</label>
            <textarea
              rows={4}
              className={clsx("form-control", {
                "is-invalid": !formikValues.questionText,
                "is-valid": !!formikValues.questionText,
              })}
              value={formikValues.questionText}
              onChange={e => setFormikValues(v => ({ ...v, questionText: e.target.value }))}
            />
          </div>

          {/* Question Type */}
          <div className="mb-3">
            <label className="form-label fw-bold">Question Type:</label>
            <select
              className={clsx("form-control", {
                "is-invalid": !formikValues.questionType,
                "is-valid": !!formikValues.questionType,
              })}
              value={formikValues.questionType}
              onChange={e => setFormikValues(v => ({ ...v, questionType: e.target.value }))}
            >
              <option value="">Select Question Type</option>
              <option value="multiple-choice">Multiple Choice</option>
              <option value="single-choice">Single-Choice</option>
            </select>
          </div>

          {/* Section */}
          <div className="mb-3">
            <label className="form-label fw-bold">Section:</label>
            <select
              className={clsx("form-control", {
                "is-invalid": !formikValues.sectionId,
                "is-valid": !!formikValues.sectionId,
              })}
              value={formikValues.sectionId}
              onChange={e => setFormikValues(v => ({ ...v, sectionId: e.target.value }))}
            >
              <option value="">Select Section</option>
              {sections.map(s => (
                <option key={s.sectionId} value={s.sectionId}>
                  {s.sectionName}
                  {s.sectionDescription && ` - ${s.sectionDescription}`}
                </option>
              ))}
            </select>
          </div>

          {/* Options */}
          <div className="mb-3">
            <label className="form-label fw-bold">Options:</label>
            {useMQTAsOptions ? (
              <MQT mqt={mqt} formikValues={formikValues} setFormikValues={setFormikValues} />
            ) : (
              formikValues.questionOptions.map((option, index) => (
                <div key={index} className="d-flex align-items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={option}
                    onChange={e => updateOption(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className={clsx("form-control", { "is-invalid": !option, "is-valid": !!option })}
                  />
                  <Dropdown>
                    <Dropdown.Toggle variant="secondary" size="sm">MQTs</Dropdown.Toggle>
                    <Dropdown.Menu style={{ minWidth: 250 }}>
                      <Dropdown.Header>Measured Quality Types</Dropdown.Header>
                      <div style={{ maxHeight: 250, overflowY: "auto", padding: 8 }}>
                        {mqt.map((type, i) => (
                          <div key={type.measuredQualityTypeId} className="d-flex align-items-center mb-2">
                            <input
                              type="checkbox"
                              checked={!!optionMeasuredQualities[index]?.[type.measuredQualityTypeId]?.checked}
                              onChange={() => handleQualityToggle(index, type.measuredQualityTypeId)}
                              className="form-check-input me-2"
                            />
                            <label className="me-2 mb-0">{type.measuredQualityTypeName}</label>
                            {!!optionMeasuredQualities[index]?.[type.measuredQualityTypeId]?.checked && (
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={optionMeasuredQualities[index][type.measuredQualityTypeId]?.score ?? 0}
                                onChange={e => handleQualityScoreChange(index, type.measuredQualityTypeId, Number(e.target.value))}
                                className="form-control form-control-sm ms-2"
                                style={{ width: 70 }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </Dropdown.Menu>
                  </Dropdown>
                  {formikValues.questionOptions.length > 1 && (
                    <Button variant="danger" size="sm" onClick={() => removeOption(index)}>-</Button>
                  )}
                  {index === formikValues.questionOptions.length - 1 && (
                    <Button variant="primary" size="sm" onClick={addOption}>+</Button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Max Options Allowed */}
          <div className="mb-3">
            <label className="form-label fw-bold">Max Options Allowed:</label>
            <input
              type="number"
              min={0}
              max={100}
              value={formikValues.maxOptionsAllowed}
              onChange={e => setFormikValues(v => ({ ...v, maxOptionsAllowed: e.target.value }))}
              className="form-control w-25"
            />
          </div>

          {/* Use MQT as Options */}
          <div className="mb-3 form-check">
            <input
              type="checkbox"
              checked={useMQTAsOptions}
              onChange={() => setUseMQTAsOptions(v => !v)}
              className="form-check-input"
              id="useMQTAsOptions"
            />
            <label className="form-check-label" htmlFor="useMQTAsOptions">
              Use Measured Quality Types as Options
            </label>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onHide}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? "Submitting..." : "Submit"}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
};

export default QuestionCreateModal;
