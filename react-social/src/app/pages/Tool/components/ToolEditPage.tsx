import clsx from "clsx";
import { useFormik } from "formik";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import { ReadToolByIdData, UpdateToolData } from "../API/Tool_APIs";

const validationSchema = Yup.object().shape({
  toolName: Yup.string().required("Tool name is required"),
  toolPrice: Yup.string().required("Tool type is required"),
  priceAmount: Yup.number()
    .when("toolPrice", {
      is: "PAID",
      then: (schema) =>
        schema.required("Please enter the price").positive("Must be positive"),
      otherwise: (schema) => schema.notRequired(),
    }),
});

const ToolEditPage = (props?: {
  setPageLoading?: any;
}) => {
  const [loading, setLoading] = useState(false);
  const [toolData, setToolData] = useState<any>({
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
          const response = await ReadToolByIdData(id);
          console.log("Fetched tool data:", response.data);
          const transformedData = {
            id: response.data.tool_id || response.data.toolId,
            toolName: response.data.name || response.data.toolName,
            toolPrice: response.data.isFree ? "FREE" : "PAID",
            priceAmount: response.data.isFree ? "" : (response.data.price || ""),
          };
          setToolData(transformedData);
        } catch (error) {
          console.error("Error fetching tool:", error);
          // Try to get data from location state as fallback
          const locationData = (location.state as any)?.data;
          if (locationData) {
            setToolData(locationData);
          }
        } finally {
          setLoading(false);
        }
      } else {
        // Fallback to location state if no ID in URL
        const locationData = (location.state as any)?.data;
        if (locationData) {
          setToolData(locationData);
        }
      }
    };

    fetchData();
  }, [id, location.state]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      id: toolData.id || id,
      toolName: toolData.toolName || "",
      toolPrice: toolData.toolPrice || "",
      priceAmount: toolData.priceAmount || "",
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        console.log("Attempting to update tool:");
        console.log("Tool ID:", values.id);
        console.log("Values being sent:", values);

        if (!values.id) {
          alert("No tool ID found. Please try navigating back and selecting the tool again.");
          return;
        }

        const response = await UpdateToolData(values.id, values);
        console.log("Update successful:", response);

        navigate("/tools");

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
          <h1 className="mb-0">Edit Tool</h1>
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

            {/* Tool Name */}
            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">
                Tool Name:
              </label>
              <input
                type="text"
                placeholder="Enter Tool Name"
                {...formik.getFieldProps("toolName")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.toolName && formik.errors.toolName,
                  },
                  {
                    "is-valid":
                      formik.touched.toolName && !formik.errors.toolName,
                  }
                )}
              />
              {formik.touched.toolName && formik.errors.toolName && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{String(formik.errors.toolName)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Tool Price Type */}
            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">
                Tool Type:
              </label>
              <select
                {...formik.getFieldProps("toolPrice")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.toolPrice && formik.errors.toolPrice,
                  },
                  {
                    "is-valid":
                      formik.touched.toolPrice && !formik.errors.toolPrice,
                  }
                )}
              >
                <option value="">Select Tool Type</option>
                <option value="FREE">Free</option>
                <option value="PAID">Paid</option>
              </select>
              {formik.touched.toolPrice && formik.errors.toolPrice && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{String(formik.errors.toolPrice)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Price Amount - only shown if PAID */}
            {formik.values.toolPrice === "PAID" && (
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

export default ToolEditPage;
