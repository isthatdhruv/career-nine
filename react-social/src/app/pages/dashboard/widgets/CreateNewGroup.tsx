import clsx from "clsx";
import { Form, Formik, Field } from "formik";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import Select, { components } from "react-select";
import { ReadToolData } from "../../Tool/API/Tool_APIs";

/* -------------------- VALIDATION -------------------- */
const validationSchema = Yup.object().shape({
  groupName: Yup.string().required("Group name is required"),
  assessmentName: Yup.string().required("Assessment is required"),
  startDate: Yup.date().required("Start date is required"),
  endDate: Yup.date()
    .required("End date is required")
    .min(Yup.ref("startDate"), "End date cannot be before start date"),
  students: Yup.array().min(1, "Select at least one student"),
  admin: Yup.string().required("Admin is required"),
});

/* -------------------- DUMMY DATA -------------------- */
const studentOptions = [
  { value: "Aarav Sharma", label: "Aarav Sharma" },
  { value: "Priya Verma", label: "Priya Verma" },
  { value: "Rohit Mehta", label: "Rohit Mehta" },
  { value: "Sneha Kapoor", label: "Sneha Kapoor" },
  { value: "Karan Singh", label: "Karan Singh" },
];

const adminOptions = [
  "Rahul Verma",
  "Neha Sharma",
  "Amit Khanna",
];

/* -------------------- CUSTOM OPTION WITH CHECKBOX -------------------- */
const CheckboxOption = (props: any) => (
  <components.Option {...props}>
    <input
      type="checkbox"
      checked={props.isSelected}
      readOnly
      className="me-2"
    />
    {props.label}
  </components.Option>
);

const GroupCreatePage = () => {
  const [loading, setLoading] = useState(false);
  const [assessments, setAssessments] = useState<any[]>([]);
  const navigate = useNavigate();

  const initialValues = {
    groupName: "",
    assessmentName: "",
    startDate: "",
    endDate: "",
    students: [] as string[],
    admin: "",
  };

  /* -------------------- FETCH ASSESSMENTS -------------------- */
  useEffect(() => {
    const fetchAssessments = async () => {
      try {
        const res = await ReadToolData();

        // 👉 Adjust if API structure differs
        setAssessments(res.data);
      } catch (error) {
        console.error("Error fetching assessments:", error);
      }
    };

    fetchAssessments();
  }, []);

  return (
    <div className="container py-5">
      <style>{`
        .react-select__control {
          min-height: 52px;
          background: #f5f8fa;
          border: 1px solid #e4e6ef;
          border-radius: 8px;
        }
        .react-select__multi-value {
          background: #e7f1ff;
          border-radius: 6px;
        }
        .react-select__multi-value__label {
          color: #3699ff;
          font-weight: 500;
        }
        .react-select__multi-value__remove:hover {
          background: #3699ff;
          color: #fff;
        }
      `}</style>

      <div className="card shadow-sm py-5">
        <div className="card-header">
          <h1 className="mb-0">Add Group</h1>
        </div>

        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={async (values) => {
            setLoading(true);
            try {
              console.log("FINAL GROUP PAYLOAD 👉", values);
              // await CreateGroupData(values);
              navigate("/school/groups");
            } catch (error) {
              console.error(error);
              window.location.replace("/error");
            } finally {
              setLoading(false);
            }
          }}
        >
          {({ errors, touched, setFieldValue }) => (
            <Form className="form w-100">
              <div className="card-body">

                {/* Group Name */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Group Name :
                  </label>
                  <Field
                    type="text"
                    name="groupName"
                    placeholder="Enter Group Name"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid": touched.groupName && errors.groupName,
                      }
                    )}
                  />
                </div>

                {/* ✅ Assessment from API */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Assessment Name :
                  </label>
                  <Field
                    as="select"
                    name="assessmentName"
                    className={clsx(
                      "form-control form-control-lg form-control-solid",
                      {
                        "is-invalid":
                          touched.assessmentName && errors.assessmentName,
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

                {/* Start Date */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Start Date :
                  </label>
                  <Field
                    type="date"
                    name="startDate"
                    className="form-control form-control-lg form-control-solid"
                  />
                </div>

                {/* End Date */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    End Date :
                  </label>
                  <Field
                    type="date"
                    name="endDate"
                    className="form-control form-control-lg form-control-solid"
                  />
                </div>

                {/* Students (MULTI SELECT) */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Students :
                  </label>

                  <Select
                    options={studentOptions}
                    isMulti
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    components={{ Option: CheckboxOption }}
                    placeholder="Select students"
                    classNamePrefix="react-select"
                    onChange={(selected: any) =>
                      setFieldValue(
                        "students",
                        selected.map((s: any) => s.value)
                      )
                    }
                  />

                  {touched.students && errors.students && (
                    <div className="text-danger mt-1">
                      {errors.students as string}
                    </div>
                  )}
                </div>

                {/* Admin */}
                <div className="fv-row mb-7">
                  <label className="required fs-6 fw-bold mb-2">
                    Admin :
                  </label>
                  <Field
                    as="select"
                    name="admin"
                    className="form-control form-control-lg form-control-solid"
                  >
                    <option value="">Select Admin</option>
                    {adminOptions.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </Field>
                </div>

                {/* Footer */}
                <div className="card-footer d-flex justify-content-end">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    onClick={() => navigate("/school/groups")}
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

export default GroupCreatePage;
