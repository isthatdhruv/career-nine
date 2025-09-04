import clsx from "clsx";
import { Field, Form, Formik } from "formik";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { ReadToolData } from "../../Tool/API/Tool_APIs";
import { CreateToolData } from "../API/Tool_APIs";

const validationSchema = Yup.object().shape({
  toolName: Yup.string().required("Tool name is required"),
  toolPrice: Yup.string().required("Tool price is required"),
  priceAmount: Yup.number()
    .when("toolPrice", {
      is: "PAID",
      then: (schema) =>
        schema.required("Please enter the price").positive("Must be positive"),
      otherwise: (schema) => schema.notRequired(),
    }),
});

const ToolCreatePage = ({ setPageLoading }: { setPageLoading?: any }) => {
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const navigate = useNavigate();

  const initialValues = {
    toolName: "",
    toolPrice: "",
    priceAmount: "", // <-- new field for actual amount
  };

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const response = await ReadToolData();
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
        <div className="card-header">
          <h1 className="mb-0">Add Tool</h1>
        </div>

        <Formik
          enableReinitialize
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={async (values, { resetForm }) => {
            setLoading(true);
            try {
              await CreateToolData(values);
              resetForm();
              navigate("/tools");
            } catch (error) {
              console.error(error);
              window.location.replace("/error");
            } finally {
              setLoading(false);
            }
          }}
        >
          {({ errors, touched, values }) => (
            <Form className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework">
              <div className="card-body">
                {/* Tool Name */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">Tool Name :</label>
                  <Field
                    type="text"
                    name="toolName"
                    placeholder="Enter Tool Name"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger": touched.toolName && errors.toolName,
                      },
                      {
                        "is-valid": touched.toolName && !errors.toolName,
                      }
                    )}
                  />
                  {touched.toolName && errors.toolName && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.toolName}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tool Price Dropdown */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">Tool Price :</label>
                  <Field
                    as="select"
                    name="toolPrice"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger": touched.toolPrice && errors.toolPrice,
                      },
                      {
                        "is-valid": touched.toolPrice && !errors.toolPrice,
                      }
                    )}
                  >
                    <option value="">Select Tool Price</option>
                    <option value="FREE">Free</option>
                    <option value="PAID">Paid</option>
                  </Field>
                  {touched.toolPrice && errors.toolPrice && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.toolPrice}</span>
                      </div>
                    </div>
                  )}
                </div>

                {values.toolPrice === "PAID" && (
                  <div className="fv-row mb-7">
                    <label className="required fs-6 fw-bold mb-2">Enter Price :</label>
                    <Field
                      type="number"
                      name="priceAmount"
                      placeholder="Enter Price"
                      className={clsx(
                        "form-control form-control-lg form-control-solid",
                        {
                          "is-invalid text-danger": touched.priceAmount && errors.priceAmount,
                        },
                        {
                          "is-valid": touched.priceAmount && !errors.priceAmount,
                        }
                      )}
                    />
                    {touched.priceAmount && errors.priceAmount && (
                      <div className="fv-plugins-message-container">
                        <div className="fv-help-block text-danger">
                          <span role="alert">{errors.priceAmount}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="card-footer d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-light me-2"
                  onClick={() => navigate("/tools")}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {!loading && <span className="indicator-label">Submit</span>}
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
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default ToolCreatePage;
