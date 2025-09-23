import clsx from "clsx";
import { useFormik } from "formik";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import { ReadAssessmentByIdData, UpdateAssessmentData } from "../API/Create_Assessment_APIs";

const validationSchema = Yup.object().shape({
  assessmentName: Yup.string().required("Assessment name is required"),
  assessmentType: Yup.string().required("Assessment type is required"),
  priceAmount: Yup.number()
    .when("assessmentType", {
      is: "PAID",
      then: (schema) =>
        schema.required("Please enter the price").positive("Must be positive"),
      otherwise: (schema) => schema.notRequired(),
    }),
});

const AssessmentEditPage = (props?: {
  setPageLoading?: any;
}) => {
  const [loading, setLoading] = useState(false);
  const [assessmentData, setAssessmentData] = useState<any>({
    name: "",
    price: "",
    id: "",
    type: "",
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  // Fetch tool data when component mounts
  useEffect(() => {
    const fetchData = async () => {
      if (id) {
        try {
          setLoading(true);
          const response = await ReadAssessmentByIdData(id);
          console.log("Fetched assessment data:", response.data);
          const transformedData = {
            id: response.data.assessment_id || response.data.assessmentId,
            assessmentName: response.data.name || response.data.assessmentName,
            assessmentType: response.data.isFree ? "FREE" : "PAID",
            priceAmount: response.data.isFree ? "" : (response.data.price || ""),
            isFree: response.data.isFree
          };
          setAssessmentData(transformedData);
        } catch (error) {
          console.error("Error fetching assessment:", error);
          // Try to get data from location state as fallback
          const locationData = (location.state as any)?.data;
          if (locationData) {
            setAssessmentData(locationData);
          }
        } finally {
          setLoading(false);
        }
      } else {
        // Fallback to location state if no ID in URL
        const locationData = (location.state as any)?.data;
        if (locationData) {
          setAssessmentData(locationData);
        }
      }
    };

    fetchData();
  }, [id, location.state]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      id: assessmentData.id || id,
      assessmentName: assessmentData.assessmentName || "",
      assessmentType: assessmentData.assessmentType || "",
      priceAmount: assessmentData.priceAmount || "",
      isFree: assessmentData.isFree || false,
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        console.log("Attempting to update assessment:");
        console.log("Assessment ID:", values.id);
        console.log("Values being sent:", values);

        if (!values.id) {
          alert("No assessment ID found. Please try navigating back and selecting the assessment again.");
          return;
        }

        // Transform the form values to match backend expectations
        const payload = {
          name: values.assessmentName,
          isFree: values.assessmentType === "FREE",
          price: values.assessmentType === "FREE" ? 0 : Number(values.priceAmount)
        };

        console.log("Payload being sent:", payload);

        const response = await UpdateAssessmentData(values.id, payload);
        console.log("Update successful:", response);

        navigate("/assessments");

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
          alert(`Failed to update tool: ${errorMessage}`);
        } else {
          alert("Failed to update tool: Unknown error occurred");
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
          <h1 className="mb-0">Edit Assessment</h1>
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

            {/* Assessment Name */}
            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">
                Assessment Name:
              </label>
              <input
                type="text"
                placeholder="Enter Assessment Name"
                {...formik.getFieldProps("assessmentName")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.assessmentName && formik.errors.assessmentName,
                  },
                  {
                    "is-valid":
                      formik.touched.assessmentName && !formik.errors.assessmentName,
                  }
                )}
              />
              {formik.touched.assessmentName && formik.errors.assessmentName && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{String(formik.errors.assessmentName)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Assessment Price Type */}
            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">
                Assessment Type:
              </label>
              <select
                {...formik.getFieldProps("assessmentType")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.assessmentType && formik.errors.assessmentType,
                  },
                  {
                    "is-valid":
                      formik.touched.assessmentType && !formik.errors.assessmentType,
                  }
                )}
              >
                <option value="">Select Assessment Type</option>
                <option value="FREE">Free</option>
                <option value="PAID">Paid</option>
              </select>
              {formik.touched.assessmentType && formik.errors.assessmentType && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{String(formik.errors.assessmentType)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Price Amount - only shown if PAID */}
            {formik.values.assessmentType === "PAID" && (
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">
                  Price Amount:
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Enter Price Amount"
                  {...formik.getFieldProps("priceAmount")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.priceAmount && formik.errors.priceAmount,
                    },
                    {
                      "is-valid":
                        formik.touched.priceAmount && !formik.errors.priceAmount,
                    }
                  )}
                />
                {formik.touched.priceAmount && formik.errors.priceAmount && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">{String(formik.errors.priceAmount)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="card-footer d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-light me-2"
              onClick={() => navigate("/assessments")}
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

export default AssessmentEditPage;
