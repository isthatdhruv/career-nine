import clsx from "clsx";
import { Field, Form, Formik } from "formik";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { ReadCollegeData } from "../../College/API/College_APIs";
import CollegeCreateModal from "../../College/components/CollegeCreateModal";

const validationSchema = Yup.object().shape({
  name: Yup.string().required("Assessment name is required"),
  isFree: Yup.string().required("Assessment price type is required"),
  price: Yup.number()
    .typeError("Price must be a number")
    .when("isFree", {
      is: "false",
      then: (schema) =>
        schema.required("Please enter the price").positive("Must be positive"),
      otherwise: (schema) => schema.notRequired(),
    }),
  collegeId: Yup.string().required("College is required"),
});

const AssessmentCreatePage = ({ setPageLoading }: { setPageLoading?: any }) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const initialValues = {
    name: "",
    price: 0,
    isFree: "true",
    collegeId: "",
  };

  const [college, setCollege] = useState<any[]>([]);
  const [showCollegeModal, setShowCollegeModal] = useState(false);

  useEffect(() => {
    const fetchCollege = async () => {
      try {
        const response = await ReadCollegeData();
        setCollege(response.data || []); 
      } catch (error) {
        console.error("Error fetching college:", error);
      }
    };

    fetchCollege();
  }, []);

  return (
    <div className="container py-5">
      <div className="card shadow-sm py-5">
        <div className="card-header">
          <h1 className="mb-0 mt-5">Create Assessment</h1>
        </div>

        <Formik
          enableReinitialize
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={async (values) => {
            setLoading(true);
            try {
              const isFreeBool = values.isFree === "true";
              const payload = {
                name: values.name,
                isFree: isFreeBool,
                price: isFreeBool ? 0 : Number(values.price),
                collegeId: values.collegeId,
              };
              localStorage.setItem("assessmentStep1", JSON.stringify(payload));
              navigate("/assessments/create/step-2");
            } catch (error) {
              console.error(error);
              window.location.replace("/error");
            } finally {
              setLoading(false);
            }
          }}
        >
          {({ errors, touched }) => (
            <Form className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework">
              <div className="card-body">
                {/* Assessment Name */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Assessment Name:
                  </label>
                  <Field
                    as="input"
                    name="name"
                    placeholder="Enter Assessment Name"
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

                {/* Select College */}
                <div className="fv-row mb-7">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="required fs-6 fw-bold">
                      Select College
                    </label>
                    <button
                      type="button"
                      className="btn btn-sm btn-light-primary"
                      onClick={() => setShowCollegeModal(true)}
                    >
                      Add New College
                    </button>
                  </div>

                  {/* College Modal */}
                  <CollegeCreateModal
                    setPageLoading={setPageLoading ?? (() => {})}
                    show={showCollegeModal}
                    onHide={() => setShowCollegeModal(false)}
                  />

                  <Field
                    as="select"
                    name="collegeId"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid text-danger":
                          touched.collegeId && errors.collegeId,
                      },
                      {
                        "is-valid": touched.collegeId && !errors.collegeId,
                      }
                    )}
                  >
                    <option value="">Select College</option>
                    {college.map((inst) => (
                      <option
                        key={inst.instituteCode}
                        value={inst.instituteCode}
                      >
                        {inst.instituteName}
                      </option>
                    ))}
                  </Field>

                  {touched.collegeId && errors.collegeId && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block text-danger">
                        <span role="alert">{errors.collegeId}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
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
                    {!loading && <span className="indicator-label">Next</span>}
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

export default AssessmentCreatePage;
