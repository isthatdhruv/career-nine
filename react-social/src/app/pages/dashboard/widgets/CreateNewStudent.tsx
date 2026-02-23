import clsx from "clsx";
import { Field, Form, Formik } from "formik";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";

// ✅ API
import { ReadToolData } from "../../Tool/API/Tool_APIs";

/* -------------------- VALIDATION -------------------- */
const validationSchema = Yup.object().shape({
  studentName: Yup.string().required("Student name is required"),
  rollNumber: Yup.string().required("Roll number is required"),
  studentClass: Yup.string().required("Class is required"),
  instituteName: Yup.string().required("Institute name is required"),
  assessmentId: Yup.string().required("Assessment is required"),
  groupName: Yup.string().required("Group name is required"),
});

const StudentCreatePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [assessments, setAssessments] = useState<any[]>([]);

  const initialValues = {
    studentName: "",
    rollNumber: "",
    studentClass: "",
    instituteName: "",
    assessmentId: "",
    groupName: "",
  };

  /* -------------------- FETCH ASSESSMENTS -------------------- */
  useEffect(() => {
    const fetchAssessments = async () => {
      try {
        const res = await ReadToolData();
        setAssessments(res.data);
      } catch (error) {
        console.error("Error fetching assessments:", error);
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
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={async (values, { resetForm }) => {
            setLoading(true);
            try {
              const payload = {
                name: values.studentName,
                rollNumber: values.rollNumber,
                class: values.studentClass,
                instituteName: values.instituteName,
                assessmentId: values.assessmentId,
                groupName: values.groupName,
              };

              console.log("FINAL STUDENT PAYLOAD 👉", payload);
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
                      }
                    )}
                  />
                </div>

                {/* Roll Number */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Roll Number
                  </label>
                  <Field
                    type="text"
                    name="rollNumber"
                    placeholder="Enter roll number"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid": touched.rollNumber && errors.rollNumber,
                      }
                    )}
                  />
                </div>

                {/* Class */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Class
                  </label>
                  <Field
                    type="text"
                    name="studentClass"
                    placeholder="Enter class (e.g. 10th / B.Tech 3rd Year)"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid":
                          touched.studentClass && errors.studentClass,
                      }
                    )}
                  />
                </div>

                {/* Institute Name */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Institute Name
                  </label>
                  <Field
                    type="text"
                    name="instituteName"
                    placeholder="Enter institute name"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid":
                          touched.instituteName && errors.instituteName,
                      }
                    )}
                  />
                </div>

                {/* Assessment Dropdown (API) */}
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
                      }
                    )}
                  />
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
                    {!loading ? "Submit" : "Please wait..."}
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
