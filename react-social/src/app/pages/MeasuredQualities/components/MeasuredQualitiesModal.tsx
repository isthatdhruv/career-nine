import clsx from "clsx";
import { useFormik } from "formik";
import { useState } from "react";
import { Modal } from "react-bootstrap-v5";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";


const validationSchema = Yup.object().shape({
  instituteName: Yup.string().required(),
  instituteAddress: Yup.string().required(),
  instituteCode: Yup.string().required(),
});

const MeasuredQualityModal = (props: {
  setPageLoading: any;
  show: Boolean;
  onHide: any;
  data: any
}) => {
  const [loading, setLoading] = useState(false);
    console.log("Modal Data", props.data);
  var initialValues: any = {
   
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema: validationSchema,
    onSubmit: (values) => {
      setLoading(true);
    //   try {
    //     UpdateCollegeData(values).then(() => {
    //       props.onHide(false);
    //       props.setPageLoading(["true"]);
    //       formik.resetForm();
    //       setLoading(false);
    //     });
    //   } catch (error) {
    //     console.error(error);
    //     window.location.replace("/error");
    //   }
      setLoading(true);
    },
  });
  return (
    <Modal {...props} aria-labelledby="contained-modal-title-vcenter" centered>
      <Modal.Header>
        <Modal.Title>
          <h1>Map {props.data.measuredQualityName} to Tools</h1>
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
                  Select Tools :
                </label>

                <input
                  placeholder="Select Tools"
                  type="number"
                  autoComplete="off"
                  {...formik.getFieldProps("instituteCode")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.instituteCode &&
                        formik.errors.instituteCode,
                    },
                    {
                      "is-valid":
                        formik.touched.instituteCode &&
                        !formik.errors.instituteCode,
                    }
                  )}
                />
                {formik.touched.instituteCode && formik.errors.instituteCode && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">Institute Code is Required</span>
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

export default MeasuredQualityModal;
