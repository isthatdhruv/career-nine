import clsx from "clsx";
import { useFormik } from "formik";
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import { ReadMeasuredQualityTypesData, UpdateMeasuredQualityTypesData } from "../API/Measured_Quality_Types_APIs";


const validationSchema = Yup.object().shape({
  qualityTypeName: Yup.string().required("Quality Type name is required"),
  qualityTypeDescription: Yup.string().required("Quality Type description is required"),
  qualityTypeDisplayName: Yup.string().required("Quality Type display name is required"),
});

const MeasuredQualityTypesEditPage = (props?: {
  setPageLoading?: any;
}) => {
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  const MeasuredQualityTypesData = (location.state as any)?.data || {
    qualityTypeName: "",
    qualityTypeDescription: "",
    qualityTypeDisplayName: "",
    id: "",
  };


  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      id: MeasuredQualityTypesData.id,
      qualityTypeName: MeasuredQualityTypesData.qualityTypeName || "",
      qualityTypeDescription: MeasuredQualityTypesData.qualityTypeDescription || "",
      qualityTypeDisplayName: MeasuredQualityTypesData.qualityTypeDisplayName || "",
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        console.log("Attempting to update question:");
        console.log("Question ID:", values.id);
        console.log("Values being sent:", values);

        if (!values.id) {
          alert("No question ID found. Please try navigating back and selecting the question again.");
          return;
        }

        const response = await UpdateMeasuredQualityTypesData(values.id, values);
        console.log("Update successful:", response);

        navigate("/measured-quality-types");

        if (props?.setPageLoading) {
          props.setPageLoading(["true"]);
        }

      } catch (error) {
        console.error("Full error object:", error);
        if (typeof error === "object" && error !== null) {
          console.error("Error response:", (error as any).response);
          console.error("Error message:", (error as any).message);
          console.error("Error status:", (error as any).response?.status);
          console.error("Error data:", (error as any).response?.data);

          const errorMessage = (error as any).response?.data?.message || (error as any).message || "Unknown error occurred";
          alert(`Failed to update question: ${errorMessage}`);
        } else {
          alert("Failed to update question: Unknown error occurred");
        }
      } finally {
        setLoading(false);
      }
    },
  });

  // ✅ Fetch sections data
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const response = await ReadMeasuredQualityTypesData();
        setSections(response.data);
      } catch (error) {
        console.error("Error fetching sections:", error);
      }
    };
    fetchSections();
  }, []);

  return (
    <div className="container py-5">
      <div className="card shadow-sm py-5">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h1 className="mb-0">Edit Measured Quality Type</h1>
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

            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">
                Quality Type Name:
              </label>
              <textarea
                placeholder="Enter Quality Type Name"
                rows={4}
                {...formik.getFieldProps("qualityTypeName")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.qualityTypeName && formik.errors.qualityTypeName,
                  },
                  {
                    "is-valid":
                      formik.touched.qualityTypeName && !formik.errors.qualityTypeName,
                  }
                )}
              />
              {formik.touched.qualityTypeName && formik.errors.qualityTypeName && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{String(formik.errors.qualityTypeName)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">
                Measured Quality Type Description:
              </label>
              <select
                {...formik.getFieldProps("qualityTypeDescription")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.qualityTypeDescription && formik.errors.qualityTypeDescription,
                  },
                  {
                    "is-valid":
                      formik.touched.qualityTypeDescription && !formik.errors.qualityTypeDescription,
                  }
                )}
              >
                <option value="">Select Measured Quality Type</option>
                <option value="multiple-choice">Multiple Choice</option>
              </select>
              {formik.touched.qualityTypeDescription && formik.errors.qualityTypeDescription && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{String(formik.errors.qualityTypeDescription)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">
                Measured Quality Type Display Name :
              </label>
              <select
                {...formik.getFieldProps("qualityTypeDisplayName")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.qualityTypeDisplayName && formik.errors.qualityTypeDisplayName,
                  },
                  {
                    "is-valid":
                      formik.touched.qualityTypeDisplayName && !formik.errors.qualityTypeDisplayName,
                  }
                )}
              >
                <option value="">Select Measured Quality Type</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.sectionName}>
                    {section.sectionName}
                  </option>
                ))}
              </select>
              {formik.touched.qualityTypeDisplayName && formik.errors.qualityTypeDisplayName && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{String(formik.errors.qualityTypeDisplayName)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card-footer d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-light me-2"
              onClick={() => navigate("/tools")}
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

export default MeasuredQualityTypesEditPage;
