import clsx from "clsx";
import { useFormik } from "formik";
import { useState } from "react";
import { Modal } from "react-bootstrap-v5";
import { useSearchParams } from "react-router-dom";
import Select from "react-select";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import { UpdateBatchData } from "../API/Batch_APIs";

const validationSchema = Yup.object().shape({
  batchStart: Yup.string().required(),
  batchEnd: Yup.string().required(),
  batchDuration: Yup.string().required(),
});

const BatchEditModal = (props: {
  show: Boolean;
  onHide: any;
  data: any;
  setPageLoading: any;
}) => {
  const [loading, setLoading] = useState(false);

  var initialValues: any = {
    batchStart: props.data.instituteBatch.batchStart,
    batchEnd: props.data.instituteBatch.batchEnd,
    batchDuration: props.data.instituteBatch.batchDuration,
    batchDurationType: props.data.instituteBatch.batchDurationType,
    batchId: props.data.instituteBatch.batchId,
    display: 1,
  };
  var [searchParams] = useSearchParams();
  var branchId = searchParams.get("branchId");
  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema: validationSchema,
    onSubmit: (values) => {
      values.instituteBranchIdDetails = [{ branchId: branchId }];
      try {
        UpdateBatchData(values).then(() => {
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

  const options = [
    { value: "Year", label: "Year" },
    { value: "Month", label: "Month" },
  ];

  const optionsData = [
    {
      value: props.data.instituteBatch.batchDurationType,
      label: props.data.instituteBatch.batchDurationType,
    },
  ];

  return (
    <Modal {...props} aria-labelledby="contained-modal-title-vcenter" centered>
      <Modal.Header>
        <Modal.Title>
          <h1>Edit Batch</h1>
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
                  Batch Start :
                </label>

                <input
                  placeholder="Enter Batch Start"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("batchStart")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.batchStart && formik.errors.batchStart,
                    },
                    {
                      "is-valid":
                        formik.touched.batchStart && !formik.errors.batchStart,
                    }
                  )}
                />
                {formik.touched.batchStart && formik.errors.batchStart && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">Batch Start is Required</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">
                  Batch End :
                </label>

                <input
                  placeholder="Enter Batch End"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("batchEnd")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.batchEnd && formik.errors.batchEnd,
                    },
                    {
                      "is-valid":
                        formik.touched.batchEnd && !formik.errors.batchEnd,
                    }
                  )}
                />
                {formik.touched.batchEnd && formik.errors.batchEnd && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">Batch End is Required</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">
                  Batch Duration :
                </label>

                <input
                  placeholder="Enter Batch Duration"
                  type="number"
                  autoComplete="off"
                  {...formik.getFieldProps("batchDuration")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.batchDuration &&
                        formik.errors.batchDuration,
                    },
                    {
                      "is-valid":
                        formik.touched.batchDuration &&
                        !formik.errors.batchDuration,
                    }
                  )}
                />
                {formik.touched.batchDuration && formik.errors.batchDuration && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">Batch Duration is Required</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">
                  Batch Duration Type :
                </label>

                <Select
                  options={options}
                  defaultValue={optionsData}
                  onChange={(data: any) => {
                    formik.setFieldValue("batchDurationType", data.value);
                  }}
                />
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

export default BatchEditModal;
