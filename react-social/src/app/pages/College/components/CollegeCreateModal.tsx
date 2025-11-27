import clsx from "clsx";
import { useFormik } from "formik";
import { useState } from "react";
import { Modal } from "react-bootstrap-v5";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import { UpdateCollegeData } from "../API/College_APIs";

const validationSchema = Yup.object().shape({
  instituteName: Yup.string().required("College Name is required"),
  instituteAddress: Yup.string().required("Institute Address is required"),
  instituteCode: Yup.string().required("Institute Code is required"),
  maxStudents: Yup.string().required("Maximum Students is required"),
  maxContactPersons: Yup.string().required("Maximum Contact Persons is required"),
});

type Props = {
  setPageLoading: (val: any) => void;
  show: boolean;
  onHide: () => void;
};

const CollegeCreateModal = ({ setPageLoading, show, onHide }: Props) => {
  const [loading, setLoading] = useState(false);

  const initialValues = {
    instituteName: "",
    instituteAddress: "",
    instituteCode: "",
    maxStudents: "",
    maxContactPersons: "",
    display: 1,
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema,
    onSubmit: async (values, { resetForm }) => {
      setLoading(true);
      try {
        // await the promise so we can catch failures
        await UpdateCollegeData(values);

        // call parent handlers consistently
        onHide();
        setPageLoading(["true"]); // if parent expects this format, fine — otherwise adjust
        resetForm();
      } catch (error) {
        console.error("Failed to update college:", error);
        // show user-friendly notification here if you have one
        // for now we'll redirect as you did previously (optional)
        // window.location.replace("/error");
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <Modal show={show} onHide={onHide} aria-labelledby="contained-modal-title-vcenter" centered>
      <Modal.Header>
        <Modal.Title>
          <h1>Add College</h1>
        </Modal.Title>

        <div className="btn btn-sm btn-icon btn-active-color-primary" onClick={onHide}>
          <UseAnimations animation={menu2} size={28} strokeColor={"#181C32"} reverse={true} />
        </div>
      </Modal.Header>

      <form className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework" onSubmit={formik.handleSubmit}>
        <Modal.Body>
          <div className="modal-body">
            <div
              className="scroll-y me-n7 pe-7"
              id="kt_modal_add_scroll"
              data-kt-scroll="true"
              data-kt-scroll-activate='{default: false, lg: true}'
              data-kt-scroll-max-height="auto"
              data-kt-scroll-dependencies="#kt_modal_add_header"
              data-kt-scroll-wrappers="#kt_modal_add_scroll"
              data-kt-scroll-offset="300px"
            >
              {/* College Name */}
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">College Name :</label>
                <input
                  placeholder="Enter College Name"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("instituteName")}
                  className={clsx("form-control form-control-lg form-control-solid", {
                    "is-invalid text-danger": formik.touched.instituteName && !!formik.errors.instituteName,
                    "is-valid": formik.touched.instituteName && !formik.errors.instituteName,
                  })}
                />
                {formik.touched.instituteName && formik.errors.instituteName && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">{formik.errors.instituteName}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Institute Code (text to match Yup.string) */}
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">Institute Code :</label>
                <input
                  placeholder="Enter Institute Code"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("instituteCode")}
                  className={clsx("form-control form-control-lg form-control-solid", {
                    "is-invalid text-danger": formik.touched.instituteCode && !!formik.errors.instituteCode,
                    "is-valid": formik.touched.instituteCode && !formik.errors.instituteCode,
                  })}
                />
                {formik.touched.instituteCode && formik.errors.instituteCode && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">{formik.errors.instituteCode}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Address */}
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">Institute Address :</label>
                <input
                  placeholder="Enter Institute Address"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("instituteAddress")}
                  className={clsx("form-control form-control-lg form-control-solid", {
                    "is-invalid text-danger": formik.touched.instituteAddress && !!formik.errors.instituteAddress,
                    "is-valid": formik.touched.instituteAddress && !formik.errors.instituteAddress,
                  })}
                />
                {formik.touched.instituteAddress && formik.errors.instituteAddress && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">{formik.errors.instituteAddress}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Max Students */}
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">Maximum Students :</label>
                <input
                  placeholder="Enter Maximum Students"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("maxStudents")}
                  className={clsx("form-control form-control-lg form-control-solid", {
                    "is-invalid text-danger": formik.touched.maxStudents && !!formik.errors.maxStudents,
                    "is-valid": formik.touched.maxStudents && !formik.errors.maxStudents,
                  })}
                />
                {formik.touched.maxStudents && formik.errors.maxStudents && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">{formik.errors.maxStudents}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Max Contact Persons */}
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">Maximum Contact Persons :</label>
                <input
                  placeholder="Enter Maximum Contact Persons"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("maxContactPersons")}
                  className={clsx("form-control form-control-lg form-control-solid", {
                    "is-invalid text-danger": formik.touched.maxContactPersons && !!formik.errors.maxContactPersons,
                    "is-valid": formik.touched.maxContactPersons && !formik.errors.maxContactPersons,
                  })}
                />
                {formik.touched.maxContactPersons && formik.errors.maxContactPersons && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">{formik.errors.maxContactPersons}</span>
                    </div>
                  </div>
                )}
              </div>
              
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <button className="btn btn-sm btn-light btn-active-light-secondary" type="button" onClick={onHide}>
            Close
          </button>

          <button
            type="submit"
            className="btn btn-sm btn-primary btn-active-light-secondary"
            disabled={loading || formik.isSubmitting || !formik.isValid}
          >
            {!loading && <span className="indicator-label">Submit</span>}
            {loading && (
              <span className="indicator-progress" style={{ display: "block" }}>
                Please wait...{" "}
                <span className="spinner-border spinner-border-sm align-middle ms-2" />
              </span>
            )}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  );
};

export default CollegeCreateModal;
