import { useFormik } from "formik";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { UpdateCareerData } from "../API/Career_APIs";

const validationSchema = Yup.object().shape({
  title: Yup.string().required("Title is required"),
  description: Yup.string().required("Description is required"),
});

const CareerEditPage = (props?: { setPageLoading?: any }) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const careerData = (location.state as any)?.data || {
    title: "",
    description: "",
    career_id: "",
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      career_id: careerData.career_id,
      title: careerData.title || "",
      description: careerData.description || "",
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
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
        if (props?.setPageLoading) {
          props.setPageLoading(["true"]);
        }
      } catch (error) {
        alert("Failed to update career. Please try again.");
      } finally {
        setLoading(false);
      }
    },
  });

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
    </div>
  );
};

export default CareerEditPage;
