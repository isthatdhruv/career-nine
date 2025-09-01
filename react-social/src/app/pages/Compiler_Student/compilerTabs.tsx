import Alert from "@mui/material/Alert";
import clsx from "clsx";
import { useFormik } from "formik";
import { useState } from "react";
import { Button, Form } from "react-bootstrap-v5";
import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css";
import { RiCodeSSlashLine } from "react-icons/ri";
import UseAnimations from "react-useanimations";
import infinity from "react-useanimations/lib/infinity";
import * as Yup from "yup";
import { RunCode, SubmitCode, SubmitTestcase } from "./compiler_APIs";

const testCaseSchema = Yup.object().shape({
  input: Yup.string().required("Standard Input is required"),
  output: Yup.string().required("Expected Output is required"),
});

const CompilerTabs = (props: {
  language_id: any;
  code: any;
  testCaseCounter: any;
  setTestCaseCounter: any;
  testCase: any;
  data: any;
  id: any;
  codingQuestionId: any;
  codingQuestionSubmitted: any;
}) => {
  const [compilerloading, setCompilerLoading] = useState(false);
  const [submitButtonloading, setSubmitButtonLoading] = useState(false);
  const [computedOutput, setComputedOutput] = useState(false);
  const [output, setOutput] = useState("");
  const [correct_solution, setCorrect_solution] = useState(false);
  const [incorrect_solution, setIncorrect_solution] = useState(false);
  const [compilation_error, setCompilation_error] = useState(false);
  const [savecode, setSavecode] = useState(false);
  const [language_id, setLanguage_id] = useState(props.language_id);
  const [source_code, setSource_code] = useState(props.code);

  var initialValues: any = {
    input: "",
    output: "",
    locked: true,
    codingQuestionId: {
      id: props.codingQuestionId,
    },
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema: testCaseSchema,
    onSubmit: (values) => {
      // console.log(values);

      setLanguage_id(props.language_id);
      setSource_code(props.code);

      function CodeRun(data: any) {
        const token = data;
        try {
          SubmitCode(data).then((data) => {

            if (data.data.status.description === "Accepted") {
              setCompilerLoading(false);
              setCorrect_solution(true);
              setOutput(data.data.stdout);
              setComputedOutput(true);

              // props.setTestCaseCounter(props.testCaseCounter + 1);
              // props.testCase.push(props.testCaseCounter);
            } else if (data.data.status.description === "Wrong Answer") {
              setCompilerLoading(false);
              setIncorrect_solution(true);
              setOutput(data.data.stdout);
              setComputedOutput(true);
            } else if (data.data.status.description === "Compilation Error") {
              setCompilerLoading(false);
              setCompilation_error(true);
            } else {
              setTimeout(() => {
                CodeRun(token);
              }, 1000);
            }
          });
        } catch (error) {
          console.error(error);
          window.location.replace("/error");
        }
      }

      // RunCode(values.language_id, values.source_code, values.stdin, values.expected_output).then((data) => {

      //     setCompilerLoading(true)
      //     setTimeout(() => { CodeRun(data.data) }, 1000);

      // });

      if (!savecode) {
        var stdin = values.input;
        var expected_output = values.output;
        try {
          RunCode(language_id, source_code, stdin, expected_output).then(
            (data) => {
              setCompilerLoading(true);
              setTimeout(() => {
                CodeRun(data.data);
              }, 1000);
            }
          );
        } catch (error) {
          console.error(error);
          window.location.replace("/error");
        }
      } else {
        setSubmitButtonLoading(true);
        try {
          SubmitTestcase(values).then(() => {
            props.setTestCaseCounter(props.testCaseCounter + 1);
            props.testCase.push(props.testCaseCounter);
            formik.resetForm();
            setSubmitButtonLoading(false);
          });
        } catch (error) {
          console.error(error);
          window.location.replace("/error");
        }
      }
    },
  });

  return (
    <>
      <Form
        className="form-horizontal pb-5 pt-3"
        onSubmit={formik.handleSubmit}
        // key={props.id}
      >
        <div className="form-group px-3 py-3 text-center d-flex">
          <label className="control-label col-md-4">Show Test Case :</label>

          <div className="col-md-7">
            <div className="form-check form-check-custom form-check-solid mx-3 ">
              <input
                className="form-check-input"
                type="checkbox"
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "4px",
                  marginLeft: "-8px",
                }}
                defaultChecked={formik.values.locked}
                onChange={(data) => {
                  formik.setFieldValue("locked", data.target.checked);
                }}
              />
            </div>
          </div>
        </div>

        <div className="form-group px-3 py-3 text-center d-flex">
          <label className="control-label col-md-4">Standard Input :</label>

          <div className="col-md-7">
            <textarea
              style={{ border: "1px dotted black", borderRadius: "5px" }}
              {...formik.getFieldProps("input")}
              placeholder="Enter Standard Input"
              className={clsx(
                "form-control form-control-lg form-control-solid mt-3",
                {
                  "is-invalid text-danger":
                    formik.touched.input && formik.errors.input,
                },
                {
                  "is-valid": formik.touched.input && !formik.errors.input,
                }
              )}
              // autoComplete="off"
            />
            {formik.touched.input && formik.errors.input && (
              <>{formik.errors.input}</>
            )}
          </div>
        </div>

        <div className="form-group px-3 py-3 text-center d-flex">
          <label className="control-label col-md-4">Expected Output :</label>

          <div className="col-md-7">
            <textarea
              style={{ border: "1px dotted black", borderRadius: "5px" }}
              {...formik.getFieldProps("output")}
              placeholder="Enter Expected Output"
              className={clsx(
                "form-control form-control-lg form-control-solid mt-3",
                {
                  "is-invalid text-danger":
                    formik.touched.output && formik.errors.output,
                },
                {
                  "is-valid": formik.touched.output && !formik.errors.output,
                }
              )}
              // autoComplete="off"
            />
            {formik.touched.output && formik.errors.output && (
              <>{formik.errors.output}</>
            )}
          </div>
        </div>

        {computedOutput && (
          <div className="form-group px-3 py-3 text-center d-flex">
            <label className="control-label col-md-4">Actual Output :</label>

            <div className="col-md-7">
              <textarea
                defaultValue={output}
                placeholder="Enter Expected Output"
                className="form-control form-control-lg form-control-solid"
                autoComplete="off"
              />
            </div>
          </div>
        )}

        {correct_solution && (
          <div className="correct_solution m-5">
            <Alert
              severity="success"
              style={{ fontSize: "16px" }}
              onClose={() => setCorrect_solution(false)}
            >
              Correct Answer !
            </Alert>
          </div>
        )}

        {incorrect_solution && (
          <div className="incorrect_solution m-5">
            <Alert
              severity="error"
              style={{ fontSize: "16px" }}
              onClose={() => setIncorrect_solution(false)}
            >
              Wrong Answer !
            </Alert>
          </div>
        )}

        {compilation_error && (
          <div className="correct_solution m-5">
            <Alert
              severity="warning"
              style={{ fontSize: "16px" }}
              onClose={() => setCompilation_error(false)}
            >
              Compilation Error !
            </Alert>
          </div>
        )}

        <div className="text-center my-3">
          <Button
            type="btn"
            onClick={() => setSavecode(false)}
            // disabled={
            //     formik.isSubmitting || !formik.isValid
            // }
            className="btn btn-sm me-3"
          >
            {!compilerloading && <span>Run Test Case</span>}

            {compilerloading && (
              <UseAnimations
                animation={infinity}
                strokeColor={"white"}
                autoplay={true}
                loop={true}
              />
            )}
          </Button>

          {props.codingQuestionSubmitted && (
            <Button
              type="submit"
              onClick={() => setSavecode(true)}
              // disabled={formik.isSubmitting || !formik.isValid}
              className="btn btn-sm"
            >
              {" "}
              {!submitButtonloading && (
                <span>
                  Submit Code &nbsp; <RiCodeSSlashLine />
                </span>
              )}
              {submitButtonloading && (
                <span
                  className="indicator-progress"
                  style={{ display: "block" }}
                >
                  Please wait...{" "}
                  <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
                </span>
              )}
            </Button>
          )}
        </div>
      </Form>
    </>
  );
};

export { CompilerTabs };
