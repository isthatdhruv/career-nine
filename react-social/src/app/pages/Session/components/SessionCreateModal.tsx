import clsx from "clsx";
import { useFormik } from "formik";
import { useState } from "react";
import { Modal } from "react-bootstrap-v5";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import { UpdateSessionData } from "../API/Session_APIs";

const validationSchema = Yup.object().shape({
  sessionStartDate: Yup.string().required(),
  sessionEndDate: Yup.string().required(),
  sessionDuration: Yup.string().required(),
  sessionDurationType: Yup.string().required(),
});

const SessionCreateModal = (props: {
  batchId: any;
  setPageLoading: any;
  show: Boolean;
  onHide: any;
}) => {
  const [loading, setLoading] = useState(false);

  var initialValues: any = {
    sessionStartDate: "",
    sessionEndDate: "",
    sessionDuration: "",
    sessionDurationType: "",
    sessionId: null,
    batchId: props.batchId,
    display: 1,
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema: validationSchema,
    onSubmit: (values) => {
      setLoading(true);
      try {
        UpdateSessionData(values).then(() => {
          props.onHide(false);
          props.setPageLoading(["true"]);
          formik.resetForm();
          setLoading(false);
        });
      } catch (error) {
        console.error(error);
        window.location.replace("/error");
      }
    },
  });
  return (
    <Modal {...props} aria-labelledby="contained-modal-title-vcenter" centered>
      <Modal.Header>
        <Modal.Title>
          <h1>Add Session</h1>
        </Modal.Title>
        <div
          className="btn btn-sm btn-icon btn-active-color-primary"
          onClick={props.onHide}
        >
          <UseAnimations
            animation={menu2}
            size={28}
            strokeColor={"#181C32"}
            reverse={true}
          />
        </div>
      </Modal.Header>
      <form
        className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework"
        onSubmit={formik.handleSubmit}
      >
        <Modal.Body>
          <div className="modal-body">
            <div
              className="scroll-y me-n7 pe-7"
              id="kt_modal_add_scroll"
              data-kt-scroll="true"
              data-kt-scroll-activate="{default: false, lg: true}"
              data-kt-scroll-max-height="auto"
              data-kt-scroll-dependencies="#kt_modal_add_header"
              data-kt-scroll-wrappers="#kt_modal_add_scroll"
              data-kt-scroll-offset="300px"
            >
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">
                  Session Start Date :
                </label>

                <input
                  placeholder="Enter Session Start Date"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("sessionStartDate")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.sessionStartDate &&
                        formik.errors.sessionStartDate,
                    },
                    {
                      "is-valid":
                        formik.touched.sessionStartDate &&
                        !formik.errors.sessionStartDate,
                    }
                  )}
                />
                {formik.touched.sessionStartDate &&
                  formik.errors.sessionStartDate && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">Session Start Date is Required</span>
                      </div>
                    </div>
                  )}
              </div>
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">
                  Session End Date :
                </label>

                <input
                  placeholder="Enter Session End Date"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("sessionEndDate")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.sessionEndDate &&
                        formik.errors.sessionEndDate,
                    },
                    {
                      "is-valid":
                        formik.touched.sessionEndDate &&
                        !formik.errors.sessionEndDate,
                    }
                  )}
                />
                {formik.touched.sessionEndDate && formik.errors.sessionEndDate && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">Session End Date is Required</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">
                  Session Duration :
                </label>

                <input
                  placeholder="Enter Session Duration"
                  type="number"
                  autoComplete="off"
                  {...formik.getFieldProps("sessionDuration")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.sessionDuration &&
                        formik.errors.sessionDuration,
                    },
                    {
                      "is-valid":
                        formik.touched.sessionDuration &&
                        !formik.errors.sessionDuration,
                    }
                  )}
                />
                {formik.touched.sessionDuration &&
                  formik.errors.sessionDuration && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">Session Duration is Required</span>
                      </div>
                    </div>
                  )}
              </div>
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">
                  Session Duration Type :
                </label>

                <input
                  placeholder="Enter Session Duration Type"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("sessionDurationType")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.sessionDurationType &&
                        formik.errors.sessionDurationType,
                    },
                    {
                      "is-valid":
                        formik.touched.sessionDurationType &&
                        !formik.errors.sessionDurationType,
                    }
                  )}
                />
                {formik.touched.sessionDurationType &&
                  formik.errors.sessionDurationType && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">
                          Session Duration Type is Required
                        </span>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            className="btn btn-sm btn-light btn-active-light-secoundary"
            onClick={props.onHide}
          >
            Close
          </button>
          <button
            type="submit"
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
        </Modal.Footer>
      </form>
    </Modal>
  );
};

export default SessionCreateModal;
