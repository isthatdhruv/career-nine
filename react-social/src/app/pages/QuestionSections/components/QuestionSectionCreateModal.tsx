import clsx from "clsx";
import { useFormik } from "formik";
import { useState } from "react";
import { Modal, Button } from "react-bootstrap";
import * as Yup from "yup";
import { CreateQuestionSectionData } from "../API/Question_Section_APIs";

const validationSchema = Yup.object().shape({
  sectionName: Yup.string().required("Section name is required"),
  sectionDescription: Yup.string().required("Section description is required"),
});

interface QuestionSectionCreateModalProps {
  show: boolean;
  onHide: () => void;
  onSuccess?: () => void; // Optional callback after successful creation
}

const QuestionSectionCreateModal = ({ show, onHide, onSuccess }: QuestionSectionCreateModalProps) => {
  const [loading, setLoading] = useState(false);

  const initialValues = {
    sectionName: "",
    sectionDescription: "",
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        await CreateQuestionSectionData(values);
        formik.resetForm();
        if (onSuccess) onSuccess(); // Call parent callback
        onHide(); // Close modal
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Add New Section</Modal.Title>
      </Modal.Header>

      <form onSubmit={formik.handleSubmit}>
        <Modal.Body>
          {/* Section Name */}
          <div className="fv-row mb-4">
            <label className="required fs-6 fw-bold mb-2">Section Name:</label>
            <input
              type="text"
              placeholder="Enter Section Name"
              {...formik.getFieldProps("sectionName")}
              className={clsx(
                "form-control form-control-solid",
                {
                  "is-invalid text-danger": formik.touched.sectionName && formik.errors.sectionName,
                  "is-valid": formik.touched.sectionName && !formik.errors.sectionName,
                }
              )}
            />
            {formik.touched.sectionName && formik.errors.sectionName && (
              <div className="fv-help-block text-danger">
                <span role="alert">{formik.errors.sectionName}</span>
              </div>
            )}
          </div>

          {/* Section Description */}
          <div className="fv-row mb-4">
            <label className="required fs-6 fw-bold mb-2">Section Description:</label>
            <textarea
              placeholder="Enter Section Description"
              {...formik.getFieldProps("sectionDescription")}
              className={clsx(
                "form-control form-control-solid",
                {
                  "is-invalid text-danger": formik.touched.sectionDescription && formik.errors.sectionDescription,
                  "is-valid": formik.touched.sectionDescription && !formik.errors.sectionDescription,
                }
              )}
            />
            {formik.touched.sectionDescription && formik.errors.sectionDescription && (
              <div className="fv-help-block text-danger">
                <span role="alert">{formik.errors.sectionDescription}</span>
              </div>
            )}
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="light" onClick={onHide}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={formik.isSubmitting || !formik.isValid}>
            {!loading && <span>Submit</span>}
            {loading && (
              <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
            )}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
};

export default QuestionSectionCreateModal;
