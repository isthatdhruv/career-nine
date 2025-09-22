import clsx from "clsx";
import { Field, Form, Formik } from "formik";
import { useState, useEffect } from "react";
import { Modal, Button, Dropdown } from "react-bootstrap";
import * as Yup from "yup";
import { createLanguageQuestionAndOptionData, readLanguageData } from "../API/Language_APIs";
import { ReadQuestionByIdData } from "../../AssesmentQuestions/API/Question_APIs";

const validationSchema = Yup.object().shape({
  translatedQuestion: Yup.string().required("Translated question is required"),
  translatedOptions: Yup.array().of(
    Yup.object().shape({
      translatedText: Yup.string().required("Translated option is required"),
    })
  ),
});

interface QuestionLanguageModalProps {
  show: boolean;
  onHide: () => void;
  setPageLoading?: (loading: boolean) => void;
  questionId: number | null;
}

const QuestionLanguageModal = ({
  show,
  onHide,
  setPageLoading,
  questionId,
}: QuestionLanguageModalProps) => {
  const [loading, setLoading] = useState(false);
  const [languages, setLanguages] = useState<any[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<any>(null);
  const [questionData, setQuestionData] = useState<any>({
    questionText: "",
    options: [],
  });

  useEffect(() => {
    const fetchQuestion = async () => {
      if (questionId && show) {
        try {
          setLoading(true);
          const response = await ReadQuestionByIdData(questionId);
          const data = response.data;
          setQuestionData({
            questionText: data.questionText || "",
            options: data.options?.map((opt: any) => ({
              optionId: opt.optionId || opt.id,
              optionText: opt.optionText || "",
              translatedText: "",
            })) || [],
          });
        } catch (error) {
          console.error("Error fetching question:", error);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchQuestion();
  }, [questionId, show]);

  const handleOptionTranslate = async (index: number) => {
    if (!selectedLanguage) {
      alert("Please select a language first!");
      return;
    }
    const optionText = questionData.options[index]?.optionText;
    if (!optionText) {
      alert("Option text is empty!");
      return;
    }
    setLoading(true);
    try{
      
    }catch(error){
      console.error("Error translating option:", error);
      alert("Failed to translate option");
    }finally{
      setLoading(false);
    }

  }
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await readLanguageData();
        setLanguages(response.data || []);
      } catch (error) {
        console.error("Error fetching languages:", error);
      }
    };
    if (show) fetchLanguages();
  }, [show]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" role="status"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Translate Question</Modal.Title>
        <Dropdown className="ms-auto">
          <Dropdown.Toggle variant="secondary" id="dropdown-languages" size="sm">
            {selectedLanguage
              ? selectedLanguage.languageName
              : "Select Language"}
          </Dropdown.Toggle>
          <Dropdown.Menu>
            {languages.length > 0 ? (
              languages.map((lang: any) => (
                <Dropdown.Item
                  key={lang.languageId}
                  onClick={() => setSelectedLanguage(lang)}
                >
                  {lang.languageName}
                </Dropdown.Item>
              ))
            ) : (
              <Dropdown.Item disabled>No languages found</Dropdown.Item>
            )}
          </Dropdown.Menu>
        </Dropdown>
      </Modal.Header>

      <Formik
        enableReinitialize
        initialValues={{
          translatedQuestion: "",
          translatedOptions: questionData.options,
        }}
        validationSchema={validationSchema}
        onSubmit={async (values, { resetForm }) => {
          if (!selectedLanguage) {
            alert("Please select a language!");
            return;
          }

          setLoading(true);
          setPageLoading?.(true);
          try {
            // Prepare payload in the required structure
            const payload = {
              language: {
                languageId: selectedLanguage.languageId
              },
              questionText: values.translatedQuestion,
              assessmentQuestion: {
                questionId: questionId
              },
              options: values.translatedOptions.map((option: any) => ({
                optionText: option.translatedText,
                assessmentOption: {
                  optionId: option.optionId
                }
              }))
            };

            // Send the payload to backend
            await createLanguageQuestionAndOptionData(payload);

            resetForm();
            setSelectedLanguage(null);
            onHide();
          } catch (error) {
            console.error(error);
            alert("Failed to save translations");
          } finally {
            setLoading(false);
            setPageLoading?.(false);
          }
        }}
      >
        {({ values, errors, touched, handleChange }) => (
          <Form>
            <Modal.Body>
              {/* Question Text */}
              <div className="fv-row mb-3">
                <label className="required fs-6 fw-bold mb-2">
                  Question Text:
                </label>
                <Field
                  type="text"
                  value={questionData.questionText}
                  disabled
                  className="form-control"
                />
              </div>

              <div className="fv-row mb-3">
                <label className="required fs-6 fw-bold mb-2">
                  Question in{" "}
                  {selectedLanguage ? selectedLanguage.languageName : "Selected Language"}:
                </label>
                <Field
                  type="text"
                  name="translatedQuestion"
                  placeholder={`Enter question in ${
                    selectedLanguage
                      ? selectedLanguage.languageName
                      : "selected language"
                  }`}
                  className={clsx(
                    "form-control",
                    {
                      "is-invalid": touched.translatedQuestion && errors.translatedQuestion,
                    },
                    {
                      "is-valid": touched.translatedQuestion && !errors.translatedQuestion,
                    }
                  )}
                />
                {touched.translatedQuestion && errors.translatedQuestion && (
                  <div className="text-danger mt-1">{errors.translatedQuestion}</div>
                )}
              </div>

              {/* Options Translation */}
              <div className="fv-row mb-3">
                <label className="fs-6 fw-bold mb-2">Options:</label>
                {values.translatedOptions.map((option: any, index: number) => (
                  <div key={index} className="d-flex align-items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={option.optionText}
                      disabled
                      className="form-control w-50"
                    />
                    <input
                      type="text"
                      name={`translatedOptions[${index}].translatedText`}
                      value={option.translatedText}
                      onChange={handleChange}
                      placeholder={`Enter option ${index + 1} in ${
                        selectedLanguage
                          ? selectedLanguage.languageName
                          : "selected language"
                      }`}
                      className={clsx(
                        "form-control w-50",
                        touched.translatedOptions?.[index]?.translatedText &&
                        errors.translatedOptions?.[index]?.translatedText
                          ? "is-invalid"
                          : "",
                        touched.translatedOptions?.[index]?.translatedText &&
                        !errors.translatedOptions?.[index]?.translatedText
                          ? "is-valid"
                          : ""
                      )}
                    />
                    <Button onClick={() => handleOptionTranslate(index)}>Translate</Button>
                    {touched.translatedOptions?.[index]?.translatedText &&
                      errors.translatedOptions?.[index]?.translatedText && (
                        <div className="text-danger mt-1">
                          {errors.translatedOptions[index].translatedText}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </Modal.Body>

            <Modal.Footer>
              <Button variant="light" onClick={onHide}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={loading}>
                {!loading && "Submit"}
                {loading && (
                  <>
                    Please wait...
                    <span className="spinner-border spinner-border-sm ms-2"></span>
                  </>
                )}
              </Button>
            </Modal.Footer>
          </Form>
        )}
      </Formik>
    </Modal>
  );
};

export default QuestionLanguageModal ;
