import Alert from "@mui/material/Alert";
import clsx from "clsx";
import { EditorState, convertToRaw } from "draft-js";
import draftToHtml from "draftjs-to-html";
import { useFormik } from "formik";
import { useEffect, useState } from "react";
import { Button, Form } from "react-bootstrap-v5";
import { Editor } from "react-draft-wysiwyg";
import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css";
import * as Yup from "yup";
import { SubmitQuestion } from "./compiler_APIs";

const questionSchema = Yup.object().shape({
  questionHeading: Yup.string().required("Question Heading is required"),
  questionUrl: Yup.string().required("Question URL is required"),
  topics: Yup.string().required("Topics is required"),
  codingProblemDifficulty: Yup.string().required("Difficulty is required"),
});

const CompilerQuestion = (props: {
  setCodingQuestionId: any;
  setCodingQuestionSubmitted: any;
}) => {
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState("");
  const [codingQuestionData, setCodingQuestionData] = useState(false);

  var initialValues: any = {
    questionHeading: "",
    codingQuestion: "",
    questionUrl: "",
    topics: "",
    codingProblemDifficulty: "",
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema: questionSchema,
    onSubmit: (values) => {
      if (!editorState.getCurrentContent().hasText()) {
        formik.resetForm();
        setCodingQuestionData(true);
      } else {
        setLoading(true);
        console.log(values)
        // try {
        //   SubmitQuestion(values).then((data) => {
        //     props.setCodingQuestionId(data.data);
        //     props.setCodingQuestionSubmitted(true);
        //     setLoading(false);
        //     // window.location.href = 'compiler/' + data.data
        //   });
        // } catch (error) {
        //   console.error(error);
        //   window.location.replace("/error");
        // }
        // formik.resetForm();
      }
    },
  });

  const [editorState, setEditorState] = useState(EditorState.createEmpty());

  const contentState = editorState.getCurrentContent();
  const html = draftToHtml(convertToRaw(contentState));

  useEffect(() => {
    formik.setFieldValue("codingQuestion", html);
  }, [editorState]);

  return (
    <>
      <Form
        className="form-horizontal pt-10 m-1"
        onSubmit={formik.handleSubmit}
      >
        <div className="form-group px-3 py-3 text-center d-flex">
          <div className="col-md">
            <h1>CREATE QUESTION</h1>
            <hr
              style={{
                marginInline: "30px",
                marginTop: "20px",
                marginBottom: "50px",
              }}
            ></hr>

            <div className="col-md fv-row fv-plugins-icon-container mt-10 mb-5">
              <label className="required fs-6 fw-bold my-2 text-center">
                <strong>Question Heading : </strong>
              </label>
              <input
                style={{ border: "1px dotted black", borderRadius: "5px" }}
                placeholder="Enter Question Heading"
                type="text"
                {...formik.getFieldProps("questionHeading")}
                className={clsx(
                  "form-control form-control-lg form-control-solid mt-3",
                  {
                    "is-invalid text-danger":
                      formik.touched.questionHeading &&
                      formik.errors.questionHeading,
                  },
                  {
                    "is-valid":
                      formik.touched.questionHeading &&
                      !formik.errors.questionHeading,
                  }
                )}
              />
              {formik.touched.questionHeading &&
                formik.errors.questionHeading && (
                  <>{formik.errors.questionHeading}</>
                )}
            </div>

            <div className="col-md fv-row fv-plugins-icon-container my-5">
              <label className="required fs-6 fw-bold my-2 text-center">
                <strong>Topics : </strong>
              </label>
              <select
                style={{ border: "1px dotted black", borderRadius: "5px" }}
                value={formik.values.topics}
                onChange={(data: any) => {
                  formik.setTouched({
                    ...formik.touched,
                    ["topics"]: true,
                  });

                  formik.setFieldValue("topics", data.target.value);
                }}
                className={clsx(
                  "form-select form-select-solid form-select-lg",
                  {
                    "is-invalid text-danger":
                      formik.touched.topics && formik.errors.topics,
                  },
                  {
                    "is-valid": formik.touched.topics && !formik.errors.topics,
                  }
                )}
              >
                <option value="" disabled>
                  Select Topics
                </option>
                {/* {topicsData.map((topics: any, index: any) => (
                        <>
                          <option key={index} value={topics.id}>
                            {topics.type}
                          </option>
                          {topics.permanent
                            ? topics.name
                            : topics.name + "(Temporary)"}
                        </>
                      ))} */}
              </select>
              {formik.touched.topics && formik.errors.topics && (
                <>{formik.errors.topics}</>
              )}
            </div>

            <div className="col-md fv-row fv-plugins-icon-container my-5">
              <label className="required fs-6 fw-bold my-2 text-center">
                <strong>Difficulty : </strong>
              </label>
              <select
                style={{ border: "1px dotted black", borderRadius: "5px" }}
                value={formik.values.codingProblemDifficulty}
                onChange={(data: any) => {
                  formik.setTouched({
                    ...formik.touched,
                    ["codingProblemDifficulty"]: true,
                  });

                  formik.setFieldValue("codingProblemDifficulty", data.target.value);
                }}
                className={clsx(
                  "form-select form-select-solid form-select-lg",
                  {
                    "is-invalid text-danger":
                      formik.touched.codingProblemDifficulty && formik.errors.codingProblemDifficulty,
                  },
                  {
                    "is-valid": formik.touched.codingProblemDifficulty && !formik.errors.codingProblemDifficulty,
                  }
                )}
              >
                <option value="" disabled>
                  Select Difficulty
                </option>
                {/* {topicsData.map((codingProblemDifficulty: any, index: any) => (
                        <>
                          <option key={index} value={codingProblemDifficulty.id}>
                            {codingProblemDifficulty.type}
                          </option>
                        </>
                      ))} */}
              </select>
              {formik.touched.codingProblemDifficulty && formik.errors.codingProblemDifficulty && (
                <>{formik.errors.codingProblemDifficulty}</>
              )}
            </div>

            <div className="col-md fv-row fv-plugins-icon-container my-5">
              <label className="required fs-6 fw-bold my-2 text-center">
                <strong>Question : </strong>
              </label>
              <div
                style={{
                  border: "1px dotted black",
                  padding: "2px",
                  minHeight: "400px",
                  borderRadius: "5px",
                }}
              >
                <Editor
                  editorState={editorState}
                  onEditorStateChange={setEditorState}
                />
              </div>
            </div>

            <div className="col-md fv-row fv-plugins-icon-container my-5">
              <label className="required fs-6 fw-bold my-2 text-center">
                <strong>Question URL : </strong>
              </label>
              <input
                style={{ border: "1px dotted black", borderRadius: "5px" }}
                placeholder="Enter Question URL"
                type="text"
                autoComplete="off"
                {...formik.getFieldProps("questionUrl")}
                className={clsx(
                  "form-control form-control-lg form-control-solid mt-3",
                  {
                    "is-invalid text-danger":
                      formik.touched.questionUrl && formik.errors.questionUrl,
                  },
                  {
                    "is-valid":
                      formik.touched.questionUrl && !formik.errors.questionUrl,
                  }
                )}
              />
              {formik.touched.questionUrl && formik.errors.questionUrl && (
                <>{formik.errors.questionUrl}</>
              )}
            </div>
          </div>
        </div>

        {codingQuestionData && (
          <div className="correct_solution m-5">
            <Alert
              severity="warning"
              style={{ fontSize: "16px" }}
              onClose={() => setCodingQuestionData(false)}
            >
              Question is required
            </Alert>
          </div>
        )}

        <div className="text-center m-8">
          <Button
            type="submit"
            disabled={formik.isSubmitting || !formik.isValid}
            className="btn btn-sm"
          >
            {!loading && <span>Submit Question</span>}

            {loading && (
              <span className="indicator-progress" style={{ display: "block" }}>
                Please wait...{" "}
                <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
              </span>
            )}
          </Button>
        </div>
      </Form>
    </>
  );
};

export { CompilerQuestion };
