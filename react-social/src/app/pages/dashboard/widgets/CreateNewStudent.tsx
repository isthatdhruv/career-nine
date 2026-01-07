import clsx from "clsx";
import { Field, Form, Formik } from "formik";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";

// 👉 Replace these with your real APIs
// import { CreateStudent } from "../API/Student_APIs";
// import { GetAllTools } from "../API/Tool_APIs";

const validationSchema = Yup.object().shape({
  studentName: Yup.string().required("Student name is required"),
  assessmentId: Yup.string().required("Assessment is required"),
  groupName: Yup.string().required("Group name is required"),
});

const StudentCreatePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [assessments, setAssessments] = useState<any[]>([]);

  const initialValues = {
    studentName: "",
    assessmentId: "",
    groupName: "",
  };

  useEffect(() => {
    const fetchAssessments = async () => {
      try {
        // const res = await GetAllTools();
        // setAssessments(res.data);

        // TEMP MOCK DATA
        setAssessments([
          { id: "1", name: "Career Aptitude Test" },
          { id: "2", name: "Personality Assessment" },
          { id: "3", name: "Skill Evaluation" },
        ]);
      } catch (error) {
        console.error(error);
      }
    };

    fetchAssessments();
  }, []);

  return (
    <div className="container py-5">
      <div className="card shadow-sm py-5">
        <div className="card-header">
          <h1 className="mb-0">Add Student</h1>
        </div>

        <Formik
          enableReinitialize
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={async (values, { resetForm }) => {
            setLoading(true);
            try {
              const payload = {
                name: values.studentName,
                assessmentId: values.assessmentId,
                groupName: values.groupName,
              };

              // await CreateStudent(payload);

              resetForm();
              navigate("/students");
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

                {/* Student Name */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Student Name
                  </label>
                  <Field
                    type="text"
                    name="studentName"
                    placeholder="Enter student name"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid": touched.studentName && errors.studentName,
                        "is-valid": touched.studentName && !errors.studentName,
                      }
                    )}
                  />
                  {touched.studentName && errors.studentName && (
                    <div className="fv-help-block text-danger">
                      {errors.studentName}
                    </div>
                  )}
                </div>

                {/* Assessment Dropdown */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Allotted Assessment
                  </label>
                  <Field
                    as="select"
                    name="assessmentId"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid":
                          touched.assessmentId && errors.assessmentId,
                        "is-valid":
                          touched.assessmentId && !errors.assessmentId,
                      }
                    )}
                  >
                    <option value="">Select Assessment</option>
                    {assessments.map((tool) => (
                      <option key={tool.id} value={tool.id}>
                        {tool.name}
                      </option>
                    ))}
                  </Field>
                  {touched.assessmentId && errors.assessmentId && (
                    <div className="fv-help-block text-danger">
                      {errors.assessmentId}
                    </div>
                  )}
                </div>

                {/* Group Name */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Group Name
                  </label>
                  <Field
                    type="text"
                    name="groupName"
                    placeholder="Enter group name (e.g. Group A)"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid": touched.groupName && errors.groupName,
                        "is-valid": touched.groupName && !errors.groupName,
                      }
                    )}
                  />
                  {touched.groupName && errors.groupName && (
                    <div className="fv-help-block text-danger">
                      {errors.groupName}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="card-footer d-flex justify-content-end">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    onClick={() => navigate(-1)}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {!loading && "Submit"}
                    {loading && (
                      <>
                        Please wait...
                        <span className="spinner-border spinner-border-sm ms-2"></span>
                      </>
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

export default StudentCreatePage;
