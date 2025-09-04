import clsx from "clsx";
import { useFormik } from "formik";
import { useState } from "react";
import { Modal } from "react-bootstrap-v5";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import { UpdateSectionData } from "../API/Section_APIs";

const validationSchema = Yup.object().shape({
  name: Yup.string().required(),
  id: Yup.string().required(),
});

const SectionEditModal = (props: {
  show: Boolean;
  onHide: any;
  data: any;
  setPageLoading: any;
}) => {
  const [loading, setLoading] = useState(false);

  var initialValues: any = {
    id: props.data.id,
    name: props.data.name,
    display: 1,
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema: validationSchema,
    onSubmit: (values) => {
      try {
        UpdateSectionData(values).then(() => {
          props.onHide(false);
          props.setPageLoading(["true"]);
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
          <h1>Edit Section</h1>
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
                  Section Name :
                </label>

                <input
                  placeholder="Enter Section Name"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("name")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.name && formik.errors.name,
                    },
                    {
                      "is-valid": formik.touched.name && !formik.errors.name,
                    }
                  )}
                />
                {formik.touched.name && formik.errors.name && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">Section Name is Required</span>
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
        </Modal.Footer>
      </form>
    </Modal>
  );
};

export default SectionEditModal;
