import clsx from "clsx";
import { useFormik } from "formik";
import { useState } from "react";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import {
  ReadContactInformationByIdData,
  UpdateContactInformationData,
} from "../API/Contact_Person_APIs";
import { Modal } from "react-bootstrap";

const validationSchema = Yup.object().shape({
  name: Yup.string().required("Contact name is required"),
  email: Yup.string().email("Invalid email").required("Email is required"),
  phoneNumber: Yup.string().required("Phone number is required"),
  gender: Yup.string().required("Gender is required"),
  designation: Yup.string().required("Designation is required"),
});

type Props = {
  show: boolean;
  onHide: (value?: any) => void;
  data?: any;
  setPageLoading?: any;
};

const ContactPersonEditModal = (props: Props) => {
  const [loading, setLoading] = useState(false);

  interface FormValues {
    name: string;
    email: string;
    phoneNumber: string;
    gender: string;
    designation: string;
    display?: number;
  }

  // safe defaults if props.data is undefined
  const initialValues: FormValues = {
    name: props.data?.name ?? "",
    email: props.data?.email ?? "",
    phoneNumber: props.data?.phoneNumber ?? "",
    gender: props.data?.gender ?? "",
    designation: props.data?.designation ?? "",
    display: 1,
  };

  const formik = useFormik<FormValues>({
    enableReinitialize: true,
    initialValues,
    validationSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);

        // Build payload according to your backend expectations.
        // If your API expects (id, payload) adjust accordingly.
        const payload = {
          name: values.name,
          email: values.email,
          phoneNumber: values.phoneNumber,
          gender: values.gender,
          designation: values.designation,
          display: values.display,
        };

        // If your UpdateContactInformationData expects (id, payload):
        if (props.data?.id) {
          await UpdateContactInformationData(props.data.id, payload);
        } else {
          // fallback: if API expects only payload
          await UpdateContactInformationData(props.data.id, payload);
        }

        if (props.setPageLoading) props.setPageLoading(["true"]);
        props.onHide(false);
      } catch (error) {
        console.error("Update error:", error);
        // navigate to an error page if you want:
        // window.location.replace("/error");
        alert("Failed to update contact person. Check console for details.");
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <Modal {...props} aria-labelledby="contained-modal-title-vcenter" centered>
      <Modal.Header>
        <Modal.Title>
          <h1>Edit Contact Person</h1>
        </Modal.Title>

        <button
          type="button"
          className="btn btn-sm btn-icon btn-active-color-primary"
          onClick={() => props.onHide?.()}
          disabled={loading}
        >
          <UseAnimations
            animation={menu2}
            size={28}
            strokeColor={"#181C32"}
            reverse={true}
          />
        </button>
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
                <label className="fs-6 fw-bold mb-2">
                  Contact Person Name:
                </label>

                <input
                  placeholder="Enter Contact Person Name"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("name")}
                  className="form-control form-control-lg form-control-solid"
                  disabled
                />
              </div>

              {/* Email */}
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">Email :</label>

                <input
                  placeholder="Enter Email"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("email")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.email && !!formik.errors.email,
                    },
                    {
                      "is-valid": formik.touched.email && !formik.errors.email,
                    }
                  )}
                  disabled={loading}
                />

                {formik.touched.email && formik.errors.email && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">{formik.errors.email}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Phone */}
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">
                  Phone Number :
                </label>

                <input
                  placeholder="Enter Phone Number"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("phoneNumber")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.phoneNumber &&
                        !!formik.errors.phoneNumber,
                    },
                    {
                      "is-valid":
                        formik.touched.phoneNumber &&
                        !formik.errors.phoneNumber,
                    }
                  )}
                  disabled={loading}
                />
                {formik.touched.phoneNumber && formik.errors.phoneNumber && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">Phone Number is Required</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Gender */}
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">Gender :</label>

                <select
                  {...formik.getFieldProps("gender")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.gender && !!formik.errors.gender,
                    },
                    {
                      "is-valid":
                        formik.touched.gender && !formik.errors.gender,
                    }
                  )}
                  disabled={loading}
                >
                  <option value="" disabled>
                    Select Gender
                  </option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>

                {formik.touched.gender && formik.errors.gender && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">{formik.errors.gender}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Designation */}
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">
                  Designation :
                </label>

                <input
                  placeholder="Enter Designation"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("designation")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.designation &&
                        !!formik.errors.designation,
                    },
                    {
                      "is-valid":
                        formik.touched.designation &&
                        !formik.errors.designation,
                    }
                  )}
                  disabled={loading}
                />
                {formik.touched.designation && formik.errors.designation && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">Designation is Required</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <button
            type="button"
            className="btn btn-sm btn-light btn-active-light-secondary"
            onClick={() => props.onHide?.()}
            disabled={loading}
          >
            Close
          </button>

          <button
            type="submit"
            id="kt_sign_up_submit"
            className="btn btn-sm btn-primary btn-active-light-secondary"
            disabled={formik.isSubmitting || !formik.isValid || loading}
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
export default ContactPersonEditModal;
