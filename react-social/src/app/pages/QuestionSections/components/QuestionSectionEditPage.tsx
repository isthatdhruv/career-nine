import clsx from "clsx";
import { useFormik } from "formik";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import { UpdateQuestionSectionData } from "../API/Question_Section_APIs";

const validationSchema = Yup.object().shape({
  sectionName: Yup.string().required("Section name is required"),
  sectionDescription: Yup.string().required("Section description is required"),
});

const QuestionSectionEditPage = (props?: {
  setPageLoading?: any;
}) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
 
  const questionSectionData = (location.state as any)?.data || {
    sectionName: "",
    sectionDescription: "",
    id: "",
  };

  const initialValues: any = {
    id: questionSectionData.id,
    sectionName: questionSectionData.sectionName,
    sectionDescription: questionSectionData.sectionDescription,
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema: validationSchema,
    onSubmit: (values) => {
      try {
        UpdateQuestionSectionData(values).then(() => {
          navigate(-1);
          if (props?.setPageLoading) {
            props.setPageLoading(["true"]);
          }
        });
      } catch (error) {
        console.error(error);
        window.location.replace("/error");
      }
      setLoading(true);
    },
  });

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Edit Question's Section</h1>
        <button
          className="btn btn-sm btn-icon btn-active-color-primary"
          onClick={() => navigate(-1)}
          aria-label="Close"
        >
          <UseAnimations
            animation={menu2}
            size={28}
            strokeColor={"#181C32"}
            reverse={true}
          />
        </button>
      </div>
      <form
        className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework"
        onSubmit={formik.handleSubmit}
      >
        <div className="mb-7">
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
                <span role="alert">{String(formik.errors.sectionName)}</span>
              </div>
            </div>
          )}
        </div>
        <div className="mb-7">
          <label className="required fs-6 fw-bold mb-2">
            Section Description:
          </label>
          <textarea
            placeholder="Enter Section Description"
            rows={4}
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
                <span role="alert">{String(formik.errors.sectionDescription)}</span>
              </div>
            </div>
          )}
        </div>
        <div className="d-flex justify-content-end gap-2">
          <button
            className="btn btn-sm btn-light btn-active-light-secoundary"
            type="button"
            onClick={() => navigate(-1)}
          >
            Close
          </button>
          <button
            type="submit"
            id="kt_sign_up_submit"
            className="btn btn-sm btn-primary btn-active-light-secoundary"
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
  );
};

export default QuestionSectionEditPage;