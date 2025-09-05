import clsx from "clsx";
import { useFormik } from "formik";
import { useState } from "react";
import { Modal } from "react-bootstrap-v5";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import { resetpassword } from "./Forgotpassword_API";

const validationSchema = Yup.object().shape({
  personalEmailAddress: Yup.string().required(),
  rollNo: Yup.string().required(),
});

const ForgotpasswordCreateModal = (props: {
  data: any;
  show: Boolean;
  onHide: any;
}) => {
  const [loading, setLoading] = useState(false);

  var initialValues: any = {
    personalEmailAddress: "",
    officialEmailAddress: props.data,
    rollNo: "",
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema: validationSchema,
    onSubmit: (values) => {
      try {
        resetpassword(values).then(() => {
          window.location.reload();
        });
      } catch (error) {
        console.error(error);
        window.location.replace("/error");
      }
      setLoading(true);
    },
  });
  return (
    <Modal {...props} aria-labelledby="contained-modal-title-vcenter" centered>
      <Modal.Header>
        <Modal.Title>
          <h1>Reset Password</h1>
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
                  Personal Email :
                </label>

                <input
                  placeholder="Enter Personal Email"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("personalEmailAddress")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.personalEmailAddress &&
                        formik.errors.personalEmailAddress,
                    },
                    {
                      "is-valid":
                        formik.touched.personalEmailAddress &&
                        !formik.errors.personalEmailAddress,
                    }
                  )}
                />
                {formik.touched.personalEmailAddress &&
                  formik.errors.personalEmailAddress && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">Personal Email is Required</span>
                      </div>
                    </div>
                  )}
              </div>
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">Roll No. :</label>

                <input
                  placeholder="Enter Roll No."
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("rollNo")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.rollNo && formik.errors.rollNo,
                    },
                    {
                      "is-valid":
                        formik.touched.rollNo && !formik.errors.rollNo,
                    }
                  )}
                />
                {formik.touched.rollNo && formik.errors.rollNo && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">Roll No. is Required</span>
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

export default ForgotpasswordCreateModal;
