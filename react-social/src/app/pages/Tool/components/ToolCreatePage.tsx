import clsx from "clsx";
import { Field, Form, Formik } from "formik";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

const ToolCreatePage = ({ setPageLoading }: { setPageLoading?: any }) => {
  const [loading, setLoading] = useState(false);
  // const [sections, setSections] = useState<any[]>([]);
  const navigate = useNavigate();

  const initialValues = {
    name: "",
    price: 0,
    isFree: "true",
  };

  // const formik = useFormik({
  //   enableReinitialize: true,
  //   initialValues: initialValues,
  //   validationSchema: validationSchema,
  //   onSubmit: async (values, { resetForm }) => {
  //     setLoading(true);
  //     try {
  //       await CreateToolData(values);
  //       resetForm();
  //       navigate("/tools");
  //     } catch (error) {
  //       console.error(error);
  //       window.location.replace("/error");
  //     } finally {
  //       setLoading(false);
  //     }
  //   },
  // });

  // useEffect(() => {
  //   const fetchSections = async () => {
  //     try {
  //       const response = await ReadToolData();
  //       setSections(response.data);
  //     } catch (error) {
  //       console.error("Error fetching sections:", error);
  //     }
  //   };
  //   fetchSections();
  // }, []);

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
              const isFreeBool = values.isFree === "true";
              const payload = {
                name: values.name,
                isFree: isFreeBool,
                price: isFreeBool ? 0 : Number(values.price),
              };
              await CreateToolData(payload);
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
                    name="name"
                    placeholder="Enter Tool Name"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger": touched.name && errors.name,
                      },
                      {
                        "is-valid": touched.name && !errors.name,
                      }
                    )}
                  />
                  {touched.name && errors.name && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.name}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tool Price Dropdown */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">Tool Price :</label>
                  <Field
                    as="select"
                    name="isFree"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger": touched.isFree && errors.isFree,
                      },
                      {
                        "is-valid": touched.isFree && !errors.isFree,
                      }
                    )}
                  >
                    <option value="true">Free</option>
                    <option value="false">Paid</option>
                  </Field>
                  {touched.isFree && errors.isFree && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.isFree}</span>
                      </div>
                    </div>
                  )}
                </div>

                {values.isFree === "false" && (
                  <>
                    <div className="fv-row mb-7">
                      <label className="required fs-6 fw-bold mb-2">Enter Price :</label>
                      <Field
                        type="number"
                        name="price"
                        placeholder="Enter Price"
                        className={clsx(
                          "form-control form-control-lg form-control-solid",
                          {
                            "is-invalid text-danger": touched.price && errors.price,
                            "is-valid": touched.price && !errors.price,
                          }
                        )}
                      />
                    </div>
                  </>
                )}
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
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default ToolCreatePage;
