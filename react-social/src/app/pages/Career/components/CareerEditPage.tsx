<<<<<<< HEAD
import clsx from "clsx";
import { useFormik } from "formik";
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import {
  ReadCareerData,
  UpdateCareerData,
} from "../API/Career_APIs";

const validationSchema = Yup.object().shape({
  careerName: Yup.string().required("Career name is required"),
  careerDescription: Yup.string().required("Career description is required"),
  // displayName: Yup.string().required("Display name is required"),
=======
import { useFormik } from "formik";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { UpdateCareerData } from "../API/Career_APIs";

const validationSchema = Yup.object().shape({
  title: Yup.string().required("Title is required"),
  description: Yup.string().required("Description is required"),
>>>>>>> origin/palak
});

const CareerEditPage = (props?: { setPageLoading?: any }) => {
  const [loading, setLoading] = useState(false);
<<<<<<< HEAD
  const [sections, setSections] = useState<any[]>([]);
=======
>>>>>>> origin/palak
  const navigate = useNavigate();
  const location = useLocation();

  const careerData = (location.state as any)?.data || {
<<<<<<< HEAD
    careerName: "",
    careerDescription: "",
    // displayName: "",
    id: "",
=======
    title: "",
    description: "",
    career_id: "",
>>>>>>> origin/palak
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
<<<<<<< HEAD
      id: careerData.id,
      careerName: careerData.careerName || "",
      careerDescription: careerData.careerDescription || "",
      // displayName: careerData.displayName || "",
=======
      career_id: careerData.career_id,
      title: careerData.title || "",
      description: careerData.description || "",
>>>>>>> origin/palak
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
<<<<<<< HEAD
        console.log("Attempting to update question:");
        console.log("Question ID:", values.id);
        console.log("Values being sent:", values);

        if (!values.id) {
          alert(
            "No question ID found. Please try navigating back and selecting the question again."
          );
          return;
        }

        const response = await UpdateCareerData(values.id, values);
        console.log("Update successful:", response);

        navigate("/careers");

=======
        if (!values.career_id) {
          alert("No career ID found. Please try navigating back and selecting the career again.");
          return;
        }
        const updatePayload = {
          title: values.title,
          description: values.description,
        };
        const response = await UpdateCareerData(values.career_id, updatePayload);
        navigate("/career");
>>>>>>> origin/palak
        if (props?.setPageLoading) {
          props.setPageLoading(["true"]);
        }
      } catch (error) {
<<<<<<< HEAD
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
=======
        alert("Failed to update career. Please try again.");
>>>>>>> origin/palak
      } finally {
        setLoading(false);
      }
    },
  });

<<<<<<< HEAD
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const response = await ReadCareerData();
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
          <h1 className="mb-0">Edit Career</h1>
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

          <div className="fv-row mb-7">
            <label className="required fs-6 fw-bold mb-2">Question Text:</label>
            <textarea
              placeholder="Enter Career Name"
              rows={4}
              {...formik.getFieldProps("careerName")}
              className={clsx(
                "form-control form-control-lg form-control-solid",
                {
                  "is-invalid text-danger":
                    formik.touched.careerName && formik.errors.careerName,
                },
                {
                  "is-valid":
                    formik.touched.careerName && !formik.errors.careerName,
                }
              )}
            />
            {formik.touched.careerName && formik.errors.careerName && (
              <div className="fv-plugins-message-container">
                <div className="fv-help-block text-danger">
                  <span role="alert">
                    {String(formik.errors.careerName)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="fv-row mb-7">
            <label className="required fs-6 fw-bold mb-2">Career Type:</label>
            <select
              {...formik.getFieldProps("careerDescription")}
              className={clsx(
                "form-control form-control-lg form-control-solid",
                {
                  "is-invalid text-danger":
                    formik.touched.careerDescription &&
                    formik.errors.careerDescription,
                },
                {
                  "is-valid":
                    formik.touched.careerDescription &&
                    !formik.errors.careerDescription,
                }
              )}
            >
              <option value="">Select Question Type</option>
              <option value="multiple-choice">Multiple Choice</option>
            </select>
            {formik.touched.careerDescription &&
              formik.errors.careerDescription && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">
                      {String(formik.errors.careerDescription)}
                    </span>
                  </div>
                </div>
              )}
          </div>

          {/* <div className="fv-row mb-7">
            <label className="required fs-6 fw-bold mb-2">Section</label>
            <select
              {...formik.getFieldProps("displayName")}
              className={clsx(
                "form-control form-control-lg form-control-solid",
                {
                  "is-invalid text-danger":
                    formik.touched.displayName && formik.errors.displayName,
                },
                {
                  "is-valid":
                    formik.touched.displayName && !formik.errors.displayName,
                }
              )}
            >
              <option value="">Select Section</option>
              {sections.map((section) => (
                <option key={section.id} value={section.displayName}>
                  {section.displayName}
                </option>
              ))}
            </select>
            {formik.touched.displayName && formik.errors.displayName && (
              <div className="fv-plugins-message-container">
                <div className="fv-help-block text-danger">
                  <span role="alert">
                    {String(formik.errors.displayName)}
                  </span>
                </div>
              </div>
            )}
          </div> */}

          <div className="card-footer d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-light me-2"
              onClick={() => navigate("/careers")}
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
=======
  return (
    <div className="container py-5">
      <form onSubmit={formik.handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Title</label>
          <input
            type="text"
            className="form-control"
            name="title"
            value={formik.values.title}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
          />
          {formik.touched.title && typeof formik.errors.title === "string" && (
            <div className="text-danger">{formik.errors.title}</div>
          )}
        </div>
        <div className="mb-3">
          <label className="form-label">Description</label>
          <input
            type="text"
            className="form-control"
            name="description"
            value={formik.values.description}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
          />
          {formik.touched.description && typeof formik.errors.description === "string" && (
            <div className="text-danger">{formik.errors.description}</div>
          )}
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Updating..." : "Update Career"}
        </button>
      </form>
>>>>>>> origin/palak
    </div>
  );
};

export default CareerEditPage;
