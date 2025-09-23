import clsx from "clsx";
import { Field, Form, Formik } from "formik";
import { useState } from "react";
import { Modal, Button } from "react-bootstrap";
import * as Yup from "yup";
import { CreateToolData } from "../API/Tool_APIs";

const validationSchema = Yup.object().shape({
  name: Yup.string().required("Tool name is required"),
  isFree: Yup.string().required("Tool price type is required"),
  price: Yup.number()
    .typeError("Price must be a number")
    .when("isFree", {
      is: "false",
      then: (schema) => schema.required("Please enter the price").positive("Must be positive"),
      otherwise: (schema) => schema.notRequired(),
    }),
});

interface ToolCreateModalProps {
  show: boolean;
  onHide: () => void;
  setPageLoading?: (loading: boolean) => void;
}

const ToolCreateModal = ({ show, onHide, setPageLoading }: ToolCreateModalProps) => {
  const [loading, setLoading] = useState(false);

  const initialValues = {
    name: "",
    price: 0,
    isFree: "true",
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Add Tool</Modal.Title>
      </Modal.Header>

      <Formik
        enableReinitialize
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={async (values, { resetForm }) => {
          setLoading(true);
          setPageLoading?.(true);
          try {
            const isFreeBool = values.isFree === "true";
            const payload = {
              name: values.name,
              isFree: isFreeBool,
              price: isFreeBool ? 0 : Number(values.price),
            };
            await CreateToolData(payload);
            resetForm();
            onHide();
          } catch (error) {
            console.error(error);
            window.location.replace("/error");
          } finally {
            setLoading(false);
            setPageLoading?.(false);
          }
        }}
      >
        {({ errors, touched, values }) => (
          <Form>
            <Modal.Body>
              {/* Tool Name */}
              <div className="fv-row mb-3">
                <label className="required fs-6 fw-bold mb-2">Tool Name :</label>
                <Field
                  type="text"
                  name="name"
                  placeholder="Enter Tool Name"
                  className={clsx(
                    "form-control",
                    { "is-invalid": touched.name && errors.name },
                    { "is-valid": touched.name && !errors.name }
                  )}
                />
                {touched.name && errors.name && (
                  <div className="text-danger mt-1">{errors.name}</div>
                )}
              </div>

              {/* Tool Price */}
              <div className="fv-row mb-3">
                <label className="required fs-6 fw-bold mb-2">Tool Price :</label>
                <Field
                  as="select"
                  name="isFree"
                  className={clsx(
                    "form-control",
                    { "is-invalid": touched.isFree && errors.isFree },
                    { "is-valid": touched.isFree && !errors.isFree }
                  )}
                >
                  <option value="true">Free</option>
                  <option value="false">Paid</option>
                </Field>
                {touched.isFree && errors.isFree && (
                  <div className="text-danger mt-1">{errors.isFree}</div>
                )}
              </div>

              {values.isFree === "false" && (
                <div className="fv-row mb-3">
                  <label className="required fs-6 fw-bold mb-2">Enter Price :</label>
                  <Field
                    type="number"
                    name="price"
                    placeholder="Enter Price"
                    className={clsx(
                      "form-control",
                      { "is-invalid": touched.price && errors.price },
                      { "is-valid": touched.price && !errors.price }
                    )}
                  />
                  {touched.price && errors.price && (
                    <div className="text-danger mt-1">{errors.price}</div>
                  )}
                </div>
              )}
            </Modal.Body>

            <Modal.Footer>
              <Button variant="light" onClick={onHide}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={loading}>
                {!loading && "Submit"}
                {loading && (
                  <>
                    Please wait...
                    <span className="spinner-border spinner-border-sm ms-2"></span>
                  </>
                )}
              </Button>
            </Modal.Footer>
          </Form>
        )}
      </Formik>
    </Modal>
  );
};

export default ToolCreateModal;
