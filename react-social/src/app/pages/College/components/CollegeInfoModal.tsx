// CollegeInfoModal.tsx
import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { Modal } from "react-bootstrap-v5";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import { useFormik } from "formik";
import * as Yup from "yup";
import { UpdateCollegeData } from "../API/College_APIs";

type ContactPerson = {
  name: string;
  email: string;
  phone?: string;
  gender?: string;
  designation?: string;
};

type CollegeFormValues = {
  instituteName: string;
  instituteAddress: string;
  instituteCode: string;
  display: number | string;
  questionOptions: string[];
  contactPersons: ContactPerson[];
};

const validationSchema = Yup.object().shape({
  instituteName: Yup.string().required("Institute name is required"),
  instituteAddress: Yup.string().required("Institute address is required"),
  instituteCode: Yup.string().required("Institute code is required"),
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

const defaultValues: CollegeFormValues = {
  instituteName: "",
  instituteAddress: "",
  instituteCode: "",
  display: 1,
  questionOptions: [""],
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

type Props = {
  show: boolean;
  onHide: (v?: boolean) => void;
  setPageLoading: (v: any) => void;
  data?: Partial<CollegeFormValues>; // optional prefill for edit
};

const CollegeInfoModal = (props: Props) => {
  const [loading, setLoading] = useState(false);

  // Inject scoped placeholder CSS once (same technique used previously)
  useEffect(() => {
    const styleId = "college-modal-placeholder-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        .college-modal .form-control::placeholder,
        .college-modal .form-select::placeholder {
          font-size: 0.95rem;
          opacity: 0.75;
        }
        .college-modal .form-control.form-control-lg::placeholder {
          font-size: 0.95rem;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const formik = useFormik<CollegeFormValues>({
    enableReinitialize: true,
    initialValues: {
      ...defaultValues,
      ...(props.data || {}),
      // ensure contactPersons exists and is at least one
      contactPersons:
        (props.data && props.data.contactPersons && props.data.contactPersons.length)
          ? props.data.contactPersons
          : defaultValues.contactPersons,
    },
    validationSchema,
    onSubmit: async (values, { resetForm }) => {
      setLoading(true);
      try {
        await UpdateCollegeData(values);
        props.onHide(false);
        props.setPageLoading(["true"]);
        resetForm();
      } catch (error) {
        console.error("UpdateCollegeData failed", error);
        window.location.replace("/error");
      } finally {
        setLoading(false);
      }
    },
  });

  // Helpers for questionOptions (kept from page)
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
    <Modal
      {...props}
      centered
      className="college-modal"
      aria-labelledby="college-info-modal-title"
    >
      <Modal.Header>
        <Modal.Title id="college-info-modal-title">
          <h3 className="mb-0">Institute Information</h3>
        </Modal.Title>

        <div
          className="btn btn-sm btn-icon btn-active-color-primary"
          onClick={() => props.onHide()}
          style={{ cursor: "pointer" }}
        >
          <UseAnimations animation={menu2} size={28} strokeColor={"#181C32"} reverse />
        </div>
      </Modal.Header>

      <form onSubmit={formik.handleSubmit} className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework">
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

              {/* Contact Person Section (outer container per person, inner field blocks) */}
              <div className="fv-row mb-7">
                <label className="fs-6 fw-bold mb-2">Contact Person Information :</label>

                {formik.values.contactPersons?.map((person, index) => {
                  const personError = (formik.errors.contactPersons as any)?.[index] || {};
                  const personTouched = (formik.touched.contactPersons as any)?.[index] || {};

                  return (
                    <div
                      key={index}
                      className="border rounded p-4 mb-4"
                      style={{ background: "#f7f8fa" }}
                    >
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="mb-0 fw-bold">Contact Person {index + 1}</h6>
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
                          {index === formik.values.contactPersons.length - 1 && (
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

                      {/* Row 1: Name | Email | Phone */}
                      <div className="row gx-3">
                        <div className="col-md-4">
                          <div className="mb-3">
                            <label className="form-label fw-semibold">Name</label>
                            <input
                              type="text"
                              placeholder="Enter name"
                              value={person.name}
                              onChange={(e) => updateContactPerson(index, "name", e.target.value)}
                              onBlur={formik.handleBlur}
                              className={clsx("form-control form-control-lg form-control-solid", {
                                "is-invalid text-danger": personTouched?.name && personError?.name,
                              })}
                            />
                            {personTouched?.name && personError?.name && (
                              <div className="fv-help-block text-danger mt-2">{personError?.name}</div>
                            )}
                          </div>
                        </div>

                        <div className="col-md-4">
                          <div className="mb-3">
                            <label className="form-label fw-semibold">Email</label>
                            <input
                              type="email"
                              placeholder="Enter email"
                              value={person.email}
                              onChange={(e) => updateContactPerson(index, "email", e.target.value)}
                              onBlur={formik.handleBlur}
                              className={clsx("form-control form-control-lg form-control-solid", {
                                "is-invalid text-danger": personTouched?.email && personError?.email,
                              })}
                            />
                            {personTouched?.email && personError?.email && (
                              <div className="fv-help-block text-danger mt-2">{personError?.email}</div>
                            )}
                          </div>
                        </div>

                        <div className="col-md-4">
                          <div className="mb-3">
                            <label className="form-label fw-semibold">Phone</label>
                            <input
                              type="text"
                              placeholder="Enter phone"
                              value={person.phone}
                              onChange={(e) => updateContactPerson(index, "phone", e.target.value)}
                              className="form-control form-control-lg form-control-solid"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Row 2: Gender | Designation */}
                      <div className="row gx-3">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label fw-semibold">Gender</label>
                            <select
                              value={person.gender}
                              onChange={(e) => updateContactPerson(index, "gender", e.target.value)}
                              className="form-select form-select-lg font-size-sm form-select-solid"
                            >
                              <option value="">Select gender</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                        </div>

                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label fw-semibold">Designation</label>
                            <input
                              type="text"
                              placeholder="Enter designation"
                              value={person.designation}
                              onChange={(e) => updateContactPerson(index, "designation", e.target.value)}
                              className="form-control form-control-lg form-control-solid"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>


              
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer className="d-flex flex-column align-items-stretch">
          <div className="w-100 d-flex justify-content-end mb-2">
            <button
              type="button"
              className="btn btn-sm btn-light me-2"
              onClick={() => props.onHide()}
              disabled={loading}
            >
              Close
            </button>

            <button
              type="submit"
              className="btn btn-sm btn-primary"
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
          </div>
        </Modal.Footer>
      </form>
    </Modal>
  );
};

export default CollegeInfoModal;
