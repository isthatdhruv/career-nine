import clsx from "clsx";
import { Field, Form, Formik } from "formik";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { CreateReportType } from "../API/Report_Types_APIs";
import { showErrorToast } from "../../../utils/toast";

const schema = Yup.object().shape({
  code: Yup.string()
    .matches(/^[a-z0-9_]+$/, "lowercase letters, digits, underscores only")
    .required("Code is required"),
  displayName: Yup.string().required("Display name is required"),
});

const ReportTypesCreatePage = () => {
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="container py-5">
      <div className="card shadow-sm py-5">
        <div className="card-header">
          <h1 className="mb-0">Add Report Type</h1>
        </div>

        <Formik
          enableReinitialize
          initialValues={{ code: "", displayName: "" }}
          validationSchema={schema}
          onSubmit={async (values) => {
            setSubmitting(true);
            try {
              await CreateReportType(values);
              navigate("/admin/report-types");
            } catch (e: any) {
              const msg = e?.response?.data ?? e?.message ?? "Create failed";
              showErrorToast(typeof msg === "string" ? msg : "Create failed");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ errors, touched }) => (
            <Form className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework">
              <div className="card-body">
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">Code</label>
                  <Field
                    as="input"
                    name="code"
                    placeholder="e.g. bet, pager, legacy, custom_xyz"
                    className={clsx("form-control form-control-lg form-control-solid", {
                      "is-invalid text-danger": touched.code && errors.code,
                    })}
                  />
                  {touched.code && errors.code && (
                    <div className="text-danger small mt-1">{errors.code}</div>
                  )}
                  <div className="form-text">
                    Stable string used in JWT-scoped permissions and report dispatch (e.g. <code>generated_report.create</code>).
                  </div>
                </div>

                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">Display Name</label>
                  <Field
                    as="input"
                    name="displayName"
                    placeholder="e.g. Navigator 4-Pager"
                    className={clsx("form-control form-control-lg form-control-solid", {
                      "is-invalid text-danger": touched.displayName && errors.displayName,
                    })}
                  />
                  {touched.displayName && errors.displayName && (
                    <div className="text-danger small mt-1">{errors.displayName}</div>
                  )}
                </div>
              </div>

              <div className="card-footer">
                <button
                  type="button"
                  className="btn btn-light me-3"
                  onClick={() => navigate("/admin/report-types")}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Saving…" : "Save"}
                </button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default ReportTypesCreatePage;
