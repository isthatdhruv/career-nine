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

interface Option {
  id: string;
  text: string;
  sequence: number;
}

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
  
  // Options state
  const [options, setOptions] = useState<Option[]>([]);
  const [newOptionText, setNewOptionText] = useState("");
  
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  // Generate sequence options for dropdown
  const generateSequenceOptions = (maxSequence: number) => {
    return Array.from({ length: maxSequence }, (_, i) => i + 1);
  };

  // Add new option
  const addOption = () => {
    if (newOptionText.trim()) {
      const newOption: Option = {
        id: Date.now().toString(),
        text: newOptionText.trim(),
        sequence: options.length + 1
      };
      setOptions([...options, newOption]);
      setNewOptionText("");
    }
  };

  // Remove option
  const removeOption = (optionId: string) => {
    const updatedOptions = options
      .filter(opt => opt.id !== optionId)
      .map((opt, index) => ({ ...opt, sequence: index + 1 }));
    setOptions(updatedOptions);
  };

  // Update option sequence
  const updateOptionSequence = (optionId: string, newSequence: number) => {
    const optionToMove = options.find(opt => opt.id === optionId);
    if (!optionToMove) return;

    // Remove the option from current position
    const otherOptions = options.filter(opt => opt.id !== optionId);
    
    // Insert at new position
    const updatedOptions = [...otherOptions];
    updatedOptions.splice(newSequence - 1, 0, optionToMove);
    
    // Reassign sequences
    const resequencedOptions = updatedOptions.map((opt, index) => ({
      ...opt,
      sequence: index + 1
    }));
    
    setOptions(resequencedOptions);
  };

  // Update option text
  const updateOptionText = (optionId: string, newText: string) => {
    setOptions(options.map(opt => 
      opt.id === optionId ? { ...opt, text: newText } : opt
    ));
  };

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
          
          // Load options if they exist in the response
          if (response.data.options && Array.isArray(response.data.options)) {
            const loadedOptions = response.data.options.map((opt: any, index: number) => ({
              id: opt.id || `option_${index}`,
              text: opt.text || opt.optionText || "",
              sequence: opt.sequence || index + 1
            }));
            setOptions(loadedOptions);
          }
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
        console.log("Options being sent:", options);

        if (!values.id) {
          alert("No assessment ID found. Please try navigating back and selecting the assessment again.");
          return;
        }

        // Transform the form values to match backend expectations
        const payload = {
          name: values.assessmentName,
          isFree: values.assessmentType === "FREE",
          price: values.assessmentType === "FREE" ? 0 : Number(values.priceAmount),
          options: options.sort((a, b) => a.sequence - b.sequence).map(opt => ({
            id: opt.id,
            text: opt.text,
            sequence: opt.sequence
          }))
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
          alert(`Failed to update assessment: ${errorMessage}`);
        } else {
          alert("Failed to update assessment: Unknown error occurred");
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

            {/* Options Management Section */}
            <div className="card mb-7">
              <div className="card-header">
                <h3 className="card-title">Assessment Options</h3>
              </div>
              <div className="card-body">
                
                {/* Add New Option */}
                <div className="row mb-4">
                  <div className="col-md-8">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter new option text"
                      value={newOptionText}
                      onChange={(e) => setNewOptionText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addOption()}
                    />
                  </div>
                  <div className="col-md-4">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={addOption}
                      disabled={!newOptionText.trim()}
                    >
                      <i className="fas fa-plus me-2"></i>
                      Add Option
                    </button>
                  </div>
                </div>

                {/* Options List */}
                {options.length > 0 && (
                  <div className="table-responsive">
                    <table className="table table-row-bordered">
                      <thead>
                        <tr className="fw-bold fs-6 text-gray-800">
                          <th style={{ width: "80px" }}>Sequence</th>
                          <th>Option Text</th>
                          <th style={{ width: "100px" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {options
                          .sort((a, b) => a.sequence - b.sequence)
                          .map((option) => (
                          <tr key={option.id}>
                            <td>
                              <select
                                className="form-select form-select-sm"
                                value={option.sequence}
                                onChange={(e) => updateOptionSequence(option.id, parseInt(e.target.value))}
                              >
                                {generateSequenceOptions(options.length).map(seq => (
                                  <option key={seq} value={seq}>{seq}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={option.text}
                                onChange={(e) => updateOptionText(option.id, e.target.value)}
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                onClick={() => removeOption(option.id)}
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {options.length === 0 && (
                  <div className="text-center py-4 text-muted">
                    No options added yet. Add your first option above.
                  </div>
                )}
              </div>
            </div>

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
