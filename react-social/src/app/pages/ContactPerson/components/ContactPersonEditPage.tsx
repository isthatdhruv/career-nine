import clsx from "clsx";
import { useFormik } from "formik";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import { ReadContactInformationByIdData, UpdateContactInformationData } from "../API/Contact_Person_APIs";

const validationSchema = Yup.object().shape({
  contactName: Yup.string().required("Contact name is required"),
  contactEmail: Yup.string().email("Invalid email").required("Email is required"),
  contactPhone: Yup.string().required("Phone number is required"),
});

const ContactPersonEditPage = (props?: {
  setPageLoading?: any;
}) => {
  const [loading, setLoading] = useState(false);
  const [contactPersonData, setContactPersonData] = useState<any>({
    name: "",
    email: "",
    phone: "",
    id: "",
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  // Fetch contact person data when component mounts
  useEffect(() => {
    const fetchData = async () => {
      if (id) {
        try {
          setLoading(true);
          const response = await ReadContactInformationByIdData(id);
          console.log("Fetched contact person data:", response.data);
          const transformedData = {
            id: response.data.contact_id || response.data.contactId,
            contactName: response.data.name || response.data.contactName,
            contactEmail: response.data.email || response.data.contactEmail,
            contactPhone: response.data.phone || response.data.contactPhone,
          };
          setContactPersonData(transformedData);
        } catch (error) {
          console.error("Error fetching contact person:", error);
          // Try to get data from location state as fallback
          const locationData = (location.state as any)?.data;
          if (locationData) {
            setContactPersonData(locationData);
          }
        } finally {
          setLoading(false);
        }
      } else {
        // Fallback to location state if no ID in URL
        const locationData = (location.state as any)?.data;
        if (locationData) {
          setContactPersonData(locationData);
        }
      }
    };

    fetchData();
  }, [id, location.state]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      id: contactPersonData.id || id,
      contactName: contactPersonData.contactName || "",
      contactEmail: contactPersonData.contactEmail || "",
      contactPhone: contactPersonData.contactPhone || "",
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        console.log("Attempting to update contact person:");
        console.log("Contact Person ID:", values.id);
        console.log("Values being sent:", values);

        if (!values.id) {
          alert("No contact person ID found. Please try navigating back and selecting the contact person again.");
          setLoading(false);
          return;
        }

        // Transform the form values to match backend expectations
        const payload = {
          name: values.contactName,
          email: values.contactEmail,
          phone: values.contactPhone
        };

        console.log("Payload being sent:", payload);

        const response = await UpdateContactInformationData(values.id, payload);
        console.log("Update successful:", response);

        if (props?.setPageLoading) {
          props.setPageLoading(["true"]);
        }

        navigate("/contact-person");
      } catch (error) {
        console.error("Full error object:", error);
        if (typeof error === "object" && error !== null) {
          console.error("Error response:", (error as any).response);
          console.error("Error message:", (error as any).message);
          console.error("Error status:", (error as any).response?.status);
          console.error("Error data:", (error as any).response?.data);

          const errorMessage = (error as any).response?.data?.message || (error as any).message || "Unknown error occurred";
          alert(`Failed to update contact person: ${errorMessage}`);
        } else {
          alert("Failed to update contact person: Unknown error occurred");
        }
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <div className="container py-5">
      <div className="card shadow-sm py-5">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h1 className="mb-0">Edit Contact Person</h1>
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
          <div className="card-body">

            {/* Contact Person Name */}
            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">
                Contact Person Name:
              </label>
              <input
                type="text"
                placeholder="Enter Contact Person Name"
                {...formik.getFieldProps("contactName")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.contactName && formik.errors.contactName,
                  },
                  {
                    "is-valid":
                      formik.touched.contactName && !formik.errors.contactName,
                  }
                )}
              />
              {formik.touched.contactName && formik.errors.contactName && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{String(formik.errors.contactName)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Contact Person Email */}
            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">
                Contact Person Email:
              </label>
              <input
                type="email"
                placeholder="Enter Contact Person Email"
                {...formik.getFieldProps("contactEmail")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.contactEmail && formik.errors.contactEmail,
                  },
                  {
                    "is-valid":
                      formik.touched.contactEmail && !formik.errors.contactEmail,
                  }
                )}
              />
              {formik.touched.contactEmail && formik.errors.contactEmail && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{String(formik.errors.contactEmail)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Contact Person Phone */}
            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">
                Contact Person Phone:
              </label>
              <input
                type="tel"
                placeholder="Enter Contact Person Phone"
                {...formik.getFieldProps("contactPhone")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.contactPhone && formik.errors.contactPhone,
                  },
                  {
                    "is-valid":
                      formik.touched.contactPhone && !formik.errors.contactPhone,
                  }
                )}
              />
              {formik.touched.contactPhone && formik.errors.contactPhone && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{String(formik.errors.contactPhone)}</span>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="card-footer d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-light me-2"
              onClick={() => navigate("/contact-person")}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {!loading && <span className="indicator-label">Update</span>}
              {loading && (
                <span
                  className="indicator-progress"
                  style={{ display: "block" }}
                >
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

export default ContactPersonEditPage;
