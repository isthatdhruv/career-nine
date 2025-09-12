import clsx from "clsx";
import { useFormik } from "formik";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import {
  ReadMeasuredQualitiesData,
  UpdateMeasuredQualitiesData,
} from "../API/Measured_Qualities_APIs";

const validationSchema = Yup.object().shape({
  measuredQualityName: Yup.string().required("Quality name is required"),
  measuredQualityDescription: Yup.string().required("Quality description is required"),
  qualityDisplayName
    : Yup.string().required("Display name is required"),
});

const MeasuredQualitiesEditPage = (props?: { setPageLoading?: any }) => {
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  const measuredQualitiesData = (location.state as any)?.data || {
    measuredQualityName: "",
    measuredQualityDescription: "",
    qualityDisplayName: "",
    measuredQualityId: "",
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      measuredQualityId: measuredQualitiesData.measuredQualityId,
      measuredQualityName: measuredQualitiesData.measuredQualityName || "",
      measuredQualityDescription: measuredQualitiesData.measuredQualityDescription || "",
      qualityDisplayName
        : measuredQualitiesData.qualityDisplayName
        || "",
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        console.log("Attempting to update Measured Quality:");
        console.log("Quality ID:", values.measuredQualityId);
        console.log("Values being sent:", values);

        if (!values.measuredQualityId) {
          alert(
            "No question ID found. Please try navigating back and selecting the question again."
          );
          return;
        }

        const updatePayload = {
          measuredQualityName: values.measuredQualityName,
          measuredQualityDescription: values.measuredQualityDescription,
          qualityDisplayName: values.qualityDisplayName,
          // Explicitly exclude tools field to prevent relationship reset
        };

        console.log("Values being sent:", updatePayload);
        const response = await UpdateMeasuredQualitiesData(values.measuredQualityId, updatePayload);
        console.log("Update successful:", response);
        navigate("/measured-qualities");

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

          const errorMessage =
            (error as any).response?.data?.message ||
            (error as any).message ||
            "Unknown error occurred";
          alert(`Failed to update question: ${errorMessage}`);
        } else {
          alert("Failed to update question: Unknown error occurred");
        }
      } finally {
        setLoading(false);
      }
    },
  });

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const response = await ReadMeasuredQualitiesData();
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
          <h1 className="mb-0">Edit Measured Quality</h1>
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
              <label className="required fs-6 fw-bold mb-2">Quality Name:</label>
              <input
                type="text"
                placeholder="Enter Quality Name"

                {...formik.getFieldProps("measuredQualityName")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.measuredQualityName && formik.errors.measuredQualityName,
                  },
                  {
                    "is-valid":
                      formik.touched.measuredQualityName && !formik.errors.measuredQualityName,
                  }
                )}
              />
              {formik.touched.measuredQualityName && formik.errors.measuredQualityName && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">
                      {String(formik.errors.measuredQualityName)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">Quality Description:</label>
              <textarea
                placeholder="Enter Quality Description"
                rows={4}
                {...formik.getFieldProps("measuredQualityDescription")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.measuredQualityDescription &&
                      formik.errors.measuredQualityDescription,
                  },
                  {
                    "is-valid":
                      formik.touched.measuredQualityDescription &&
                      !formik.errors.measuredQualityDescription,
                  }
                )}
              >
              </textarea>
              {formik.touched.measuredQualityDescription &&
                formik.errors.measuredQualityDescription && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">
                        {String(formik.errors.measuredQualityDescription)}
                      </span>
                    </div>
                  </div>
                )}
            </div>

            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">Display Name:</label>
              <input
                type="text"
                placeholder="Enter Display Name"
                {...formik.getFieldProps("qualityDisplayName")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.qualityDisplayName &&
                      formik.errors.qualityDisplayName,
                  },
                  {
                    "is-valid":
                      formik.touched.qualityDisplayName &&
                      !formik.errors.qualityDisplayName,
                  }
                )}
              />
              {formik.touched.qualityDisplayName
                && formik.errors.qualityDisplayName
                && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">
                        {String(formik.errors.qualityDisplayName
                        )}
                      </span>
                    </div>
                  </div>
                )}
            </div>
          </div>
          <div className="card-footer d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-light me-2"
              onClick={() => navigate("/measured-qualities")}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {!loading && <span className="indicator-label">Update</span>}
              {loading && (
                <span className="indicator-progress" style={{ display: "block" }}>
                  Please wait...
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

export default MeasuredQualitiesEditPage;
