import clsx from "clsx";
import { useFormik } from "formik";
import { useState, useEffect } from "react";
import { Modal } from "react-bootstrap-v5";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import { UpdateCollegeData } from "../API/College_APIs";

const validationSchema = Yup.object().shape({
  instituteName: Yup.string().required(),
  instituteAddress: Yup.string().required(),
  instituteCode: Yup.string().required(),
  contactPersons: Yup.array().of(
    Yup.object().shape({
      name: Yup.string().required("Name is required"),
      email: Yup.string().email("Invalid email").required("Email is required"),
      phone: Yup.string().nullable(),
      gender: Yup.string().nullable(),
      designation: Yup.string().nullable(),
    })
  ),
});

const CollegeInfoModal = (props: {
  setPageLoading: any;
  show: boolean;
  onHide: any;
}) => {
  const [loading, setLoading] = useState(false);

  // Inject scoped placeholder CSS once
  useEffect(() => {
    const styleId = "college-modal-placeholder-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      // adjust font-size (and opacity if you want lighter placeholder)
      style.innerHTML = `
        /* scoped to modal via .college-modal class */
        .college-modal .form-control::placeholder,
        .college-modal .form-select::placeholder {
          font-size: 0.9rem;
          opacity: 0.75;
        }

        /* smaller placeholder for large inputs if needed */
        .college-modal .form-control.form-control-lg::placeholder {
          font-size: 0.9rem;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const initialValues: any = {
    instituteName: "",
    instituteAddress: "",
    instituteCode: "",
    display: 1,
    // options preserved; keep simple options array if you still use it
    questionOptions: [""],
    // CONTACT PERSONS: at least one by default
    contactPersons: [
      {
        name: "",
        email: "",
        phone: "",
        gender: "",
        designation: "",
      },
    ],
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema: validationSchema,
    onSubmit: async (values, { resetForm }) => {
      setLoading(true);
      try {
        await UpdateCollegeData(values);
        props.onHide(false);
        props.setPageLoading(["true"]);
        resetForm();
      } catch (error) {
        console.error(error);
        window.location.replace("/error");
      } finally {
        setLoading(false);
      }
    },
  });

  // Helpers for managing simple options (text inputs)
  const updateOption = (index: number, value: string) => {
    const opts = [...(formik.values.questionOptions || [])];
    opts[index] = value;
    formik.setFieldValue("questionOptions", opts);
  };

  const addOption = () => {
    const opts = [...(formik.values.questionOptions || [])];
    opts.push("");
    formik.setFieldValue("questionOptions", opts);
  };

  const removeOption = (index: number) => {
    const opts = [...(formik.values.questionOptions || [])];
    if (opts.length <= 1) return;
    opts.splice(index, 1);
    formik.setFieldValue("questionOptions", opts);
  };

  // Helpers for contact persons
  const updateContactPerson = (index: number, field: string, value: any) => {
    const persons = [...(formik.values.contactPersons || [])];
    persons[index] = { ...persons[index], [field]: value };
    formik.setFieldValue("contactPersons", persons);
  };

  const addContactPerson = () => {
    const persons = [...(formik.values.contactPersons || [])];
    persons.push({
      name: "",
      email: "",
      phone: "",
      gender: "",
      designation: "",
    });
    formik.setFieldValue("contactPersons", persons);
  };

  const removeContactPerson = (index: number) => {
    const persons = [...(formik.values.contactPersons || [])];
    if (persons.length <= 1) return; // keep at least one contact person
    persons.splice(index, 1);
    formik.setFieldValue("contactPersons", persons);
  };

  return (
    // add className to scope placeholder CSS
    <Modal {...props} aria-labelledby="contained-modal-title-vcenter" centered className="college-modal">
      <Modal.Header>
        <Modal.Title>
          <h1>Institute Information</h1>
        </Modal.Title>
        <div
          className="btn btn-sm btn-icon btn-active-color-primary"
          onClick={props.onHide}
        >
          <UseAnimations
            animation={menu2}
            size={28}
            strokeColor={"#181C32"}
            reverse={true}
          />
        </div>
      </Modal.Header>

      <form
        className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework"
        onSubmit={formik.handleSubmit}
      >
        <Modal.Body>
          <div className="modal-body">
            <div
              className="scroll-y me-n7 pe-7"
              id="kt_modal_add_scroll"
              data-kt-scroll="true"
              data-kt-scroll-activate="{default: false, lg: true}"
              data-kt-scroll-max-height="auto"
              data-kt-scroll-dependencies="#kt_modal_add_header"
              data-kt-scroll-wrappers="#kt_modal_add_scroll"
              data-kt-scroll-offset="300px"
            >
              {/* Contact Person Section */}
              <div className="fv-row mb-7">
                <label className="fs-6 fw-bold mb-2">Contact Person Information :</label>

                {formik.values.contactPersons?.map(
                  (person: any, index: number) => (
                    <div
                      key={index}
                      className="border rounded p-4 mb-4"
                      style={{ background: "#f7f8fa" }}
                    >
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="mb-0 fw-bold">
                          Contact Person {index + 1}
                        </h6>
                        <div>
                          {formik.values.contactPersons.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-sm btn-danger me-2"
                              onClick={() => removeContactPerson(index)}
                            >
                              -
                            </button>
                          )}
                          {index ===
                            formik.values.contactPersons.length - 1 && (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={addContactPerson}
                            >
                              +
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Name */}
                      <div className="mb-3">
                        <label className="form-label fw-semibold">Name</label>
                        <input
                          type="text"
                          placeholder="Enter name"
                          value={person.name}
                          onChange={(e) =>
                            updateContactPerson(index, "name", e.target.value)
                          }
                          className={clsx(
                            "form-control form-control-lg form-control-solid",
                            {
                              "is-invalid text-danger":
                                formik.touched.contactPersons &&
                                formik.touched.contactPersons[index] &&
                                (formik.errors.contactPersons as any)?.[index]
                                  ?.name,
                            },
                            {
                              "is-valid":
                                formik.touched.contactPersons &&
                                formik.touched.contactPersons[index] &&
                                !(formik.errors.contactPersons as any)?.[index]
                                  ?.name,
                            }
                          )}
                        />
                      </div>

                      {/* Email */}
                      <div className="mb-3">
                        <label className="form-label fw-semibold">Email</label>
                        <input
                          type="email"
                          placeholder="Enter email"
                          value={person.email}
                          onChange={(e) =>
                            updateContactPerson(index, "email", e.target.value)
                          }
                          className={clsx(
                            "form-control form-control-lg form-control-solid",
                            {
                              "is-invalid text-danger":
                                formik.touched.contactPersons &&
                                formik.touched.contactPersons[index] &&
                                (formik.errors.contactPersons as any)?.[index]
                                  ?.email,
                            },
                            {
                              "is-valid":
                                formik.touched.contactPersons &&
                                formik.touched.contactPersons[index] &&
                                !(formik.errors.contactPersons as any)?.[index]
                                  ?.email,
                            }
                          )}
                        />
                      </div>

                      {/* Phone */}
                      <div className="mb-3">
                        <label className="form-label fw-semibold">Phone</label>
                        <input
                          type="text"
                          placeholder="Enter phone"
                          value={person.phone}
                          onChange={(e) =>
                            updateContactPerson(index, "phone", e.target.value)
                          }
                          className="form-control form-control-lg form-control-solid"
                        />
                      </div>

                      {/* Gender */}
                      <div className="mb-3">
                        <label className="form-label fw-semibold">Gender</label>
                        <select
                          value={person.gender}
                          onChange={(e) =>
                            updateContactPerson(index, "gender", e.target.value)
                          }
                          className="form-select form-select-lg font-size-sm form-select-solid"
                        >
                          <option value="">Select gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      {/* Designation */}
                      <div className="mb-3">
                        <label className="form-label fw-semibold">
                          Designation
                        </label>
                        <input
                          type="text"
                          placeholder="Enter designation"
                          value={person.designation}
                          onChange={(e) =>
                            updateContactPerson(
                              index,
                              "designation",
                              e.target.value
                            )
                          }
                          className="form-control form-control-lg form-control-solid"
                        />
                      </div>
                    </div>
                  )
                )}
              </div>

            </div>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <button
            type="button"
            className="btn btn-sm btn-light btn-active-light-secoundary"
            onClick={props.onHide}
          >
            Close
          </button>

          <button
            type="submit"
            className="btn btn-sm btn-primary btn-active-light-secoundary"
            disabled={formik.isSubmitting || !formik.isValid || loading}
          >
            {!loading && <span className="indicator-label">Submit</span>}
            {loading && (
              <span className="indicator-progress" style={{ display: "block" }}>
                Please wait...{" "}
                <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
              </span>
            )}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  );
};

export default CollegeInfoModal;
