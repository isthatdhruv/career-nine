import clsx from "clsx";
import { useFormik } from "formik";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { CreateQuestionSectionData } from "../API/Question_Section_APIs";

const validationSchema = Yup.object().shape({
  sectionName: Yup.string().required("Section name is required"),
  sectionDescription: Yup.string().required("Section description is required"),
  toBeLinkedWith: Yup.string(),
});

const QuestionSectionCreatePage = ({ setPageLoading }: { setPageLoading?: any }) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const initialValues = {
    sectionName: "",
    sectionDescription: "",
    toBeLinkedWith: "",
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        const payload = {
          sectionName: values.sectionName,
          sectionDescription: values.sectionDescription,
          toBeLinkedWith: values.toBeLinkedWith,
        };
        await CreateQuestionSectionData(payload);
        formik.resetForm();
        navigate("/question-sections");
      } catch (error) {
        console.error(error);
        // window.location.replace("/error");
      }
      setLoading(false);
    },
  });

  return (
    <div className="container py-5">
      <div className="card shadow-sm py-5">
        <div className="card-header">
          <h1 className="mb-0">Add Section</h1>
        </div>
        <form
          className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework"
          onSubmit={formik.handleSubmit}
        >
          <div className="card-body">
            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">
                Section Name:
              </label>
              <input
                placeholder="Enter Section Name"
                {...formik.getFieldProps("sectionName")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.sectionName &&
                      formik.errors.sectionName,
                  },
                  {
                    "is-valid":
                      formik.touched.sectionName &&
                      !formik.errors.sectionName,
                  }
                )}
              />
              {formik.touched.sectionName && formik.errors.sectionName && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{formik.errors.sectionName}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">
                Section Description :
              </label>
              <textarea
                {...formik.getFieldProps("sectionDescription")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.sectionDescription &&
                      formik.errors.sectionDescription,
                  },
                  {
                    "is-valid":
                      formik.touched.sectionDescription &&
                      !formik.errors.sectionDescription,
                  }
                )}
              >
              </textarea>

              {formik.touched.sectionDescription && formik.errors.sectionDescription && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{formik.errors.sectionDescription}</span>
                  </div>
                </div>
              )}
            </div>

            {/* To Be Linked With */}
            <div className="fv-row mb-7">
              <label className="fs-6 fw-bold mb-2">
                To Be Linked With :
              </label>
              <textarea
                placeholder="e.g. another section name, assessment, tool, or any related context"
                {...formik.getFieldProps("toBeLinkedWith")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.toBeLinkedWith &&
                      formik.errors.toBeLinkedWith,
                  },
                  {
                    "is-valid":
                      formik.touched.toBeLinkedWith &&
                      !formik.errors.toBeLinkedWith &&
                      !!formik.values.toBeLinkedWith,
                  }
                )}
              >
              </textarea>
              <div
                className="form-text"
                style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 4 }}
              >
                Optional — note any section, tool, or content this section should connect to.
              </div>
              {formik.touched.toBeLinkedWith && formik.errors.toBeLinkedWith && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{formik.errors.toBeLinkedWith}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="card-footer d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-light me-2"
              onClick={() => navigate("/question-sections")}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={formik.isSubmitting || !formik.isValid}
            >
              {!loading && <span className="indicator-label">Submit</span>}
              {loading && (
                <span className="indicator-progress" style={{ display: "block" }}>
                  Please wait...{" "}
                  <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuestionSectionCreatePage;