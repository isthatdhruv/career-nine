// ContactPersonCreatePage.tsx
import clsx from "clsx";
import { Formik, Form } from "formik";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { CreateContactInformationData } from "../API/Contact_Person_APIs";

const validationSchema = Yup.object().shape({
  contactPersons: Yup.array()
    .of(
      Yup.object().shape({
        name: Yup.string().required("Contact name is required"),
        email: Yup.string().email("Invalid email").required("Email is required"),
        phoneNumber: Yup.string().required("Phone number is required"), // 👈 changed
        gender: Yup.string().nullable(),
        designation: Yup.string().nullable(),
      })
    )
    .min(1, "At least one contact person is required"),
});

const ContactPersonCreatePage = ({ setPageLoading }: { setPageLoading?: any }) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const initialValues = {
    contactPersons: [
      {
        name: "",
        email: "",
        phoneNumber: "",   
        gender: "",
        designation: "",
      },
    ],
  };

  return (
    <div className="container py-5">
      <div className="card shadow-sm">
        <div className="card-header d-flex align-items-center justify-content-between">
          <h1 className="mb-0">Add Contact Person Information</h1>
        </div>

        <Formik
          enableReinitialize
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={async (values, { resetForm }) => {
            
            // setLoading(true);
            // try {
              for (const person of values.contactPersons) {
                // person already has correct keys: name, email, phoneNumber, gender, designation
                console.log(person)
                await CreateContactInformationData(person);
              }
            //   resetForm();
            //   if (setPageLoading) setPageLoading(["true"]);
            //   navigate("/contact-person");
            // } catch (error) {
            //   console.error(error);
            //   window.location.replace("/error");
            // } finally {
            //   setLoading(false);
            // }
          }}
        >
          {({ values, errors, touched, handleBlur, setFieldValue }) => {
            const addContactPerson = () => {
              setFieldValue("contactPersons", [
                ...values.contactPersons,
                {
                  name: "",
                  email: "",
                  phoneNumber: "",   // 👈 changed
                  gender: "",
                  designation: "",
                },
              ]);
            };

            const removeContactPerson = (index: number) => {
              if (values.contactPersons.length <= 1) return;
              const updated = [...values.contactPersons];
              updated.splice(index, 1);
              setFieldValue("contactPersons", updated);
            };

            const updateField = (index: number, field: string, value: any) => {
              const updated = [...values.contactPersons];
              updated[index] = { ...updated[index], [field]: value };
              setFieldValue("contactPersons", updated);
            };

            return (
              <Form className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework">
                <div className="card-body">
                  {values.contactPersons.map((person: any, index: number) => {
                    const t = (touched as any).contactPersons?.[index] || {};
                    const e = (errors as any).contactPersons?.[index] || {};

                    return (
                      <div
                        key={index}
                        className="mb-4 contact-person-outer"
                        style={{
                          border: "1px solid #e6e9ef",
                          borderRadius: 8,
                          padding: 16,
                          background: "#fff",
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h5 className="mb-0 fw-bold">Contact Person {index + 1}</h5>
                          <div>
                            {values.contactPersons.length > 1 && (
                              <button
                                type="button"
                                className="btn btn-sm btn-danger me-2"
                                onClick={() => removeContactPerson(index)}
                              >
                                -
                              </button>
                            )}
                            {index === values.contactPersons.length - 1 && (
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

                        <div className="row gx-3">
                          {/* Name */}
                          <div className="col-md-4">
                            <div className="p-3" style={{ background: "#f8fafc", borderRadius: 6 }}>
                              <label className="required fs-6 fw-bold mb-1">
                                Contact Person Name :
                              </label>
                              <input
                                type="text"
                                placeholder="Enter Contact Person Name"
                                value={person.name}
                                onChange={(e) => updateField(index, "name", e.target.value)}
                                onBlur={handleBlur}
                                className={clsx(
                                  "form-control form-control-lg form-control-solid mt-2",
                                  { "is-invalid text-danger": t.name && e.name }
                                )}
                              />
                              {t.name && e.name && (
                                <div className="fv-help-block text-danger mt-2">{e.name}</div>
                              )}
                            </div>
                          </div>

                          {/* Email */}
                          <div className="col-md-4">
                            <div className="p-3" style={{ background: "#f8fafc", borderRadius: 6 }}>
                              <label className="required fs-6 fw-bold mb-1">
                                Contact Person Email :
                              </label>
                              <input
                                type="email"
                                placeholder="Enter Contact Person Email"
                                value={person.email}
                                onChange={(e) => updateField(index, "email", e.target.value)}
                                onBlur={handleBlur}
                                className={clsx(
                                  "form-control form-control-lg form-control-solid mt-2",
                                  { "is-invalid text-danger": t.email && e.email }
                                )}
                              />
                              {t.email && e.email && (
                                <div className="fv-help-block text-danger mt-2">{e.email}</div>
                              )}
                            </div>
                          </div>

                          {/* Phone Number */}
                          <div className="col-md-4">
                            <div className="p-3" style={{ background: "#f8fafc", borderRadius: 6 }}>
                              <label className="required fs-6 fw-bold mb-1">
                                Contact Person Phone Number :
                              </label>
                              <input
                                type="text"
                                placeholder="Enter Contact Person Phone Number"
                                value={person.phoneNumber}    // 👈 changed
                                onChange={(e) =>
                                  updateField(index, "phoneNumber", e.target.value)
                                }
                                onBlur={handleBlur}
                                className={clsx(
                                  "form-control form-control-lg form-control-solid mt-2",
                                  { "is-invalid text-danger": t.phoneNumber && e.phoneNumber }
                                )}
                              />
                              {t.phoneNumber && e.phoneNumber && (
                                <div className="fv-help-block text-danger mt-2">
                                  {e.phoneNumber}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Row 2 */}
                        <div className="row gx-3 mt-3">
                          {/* Gender */}
                          <div className="col-md-6">
                            <div className="p-3" style={{ background: "#f8fafc", borderRadius: 6 }}>
                              <label className="fs-6 fw-bold mb-1">Gender :</label>
                              <select
                                value={person.gender}
                                onChange={(e) => updateField(index, "gender", e.target.value)}
                                className="form-select form-select-lg form-select-solid mt-2"
                              >
                                <option value="">Select gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>
                          </div>

                          {/* Designation */}
                          <div className="col-md-6">
                            <div className="p-3" style={{ background: "#f8fafc", borderRadius: 6 }}>
                              <label className="fs-6 fw-bold mb-1">Designation :</label>
                              <input
                                type="text"
                                placeholder="Enter Designation"
                                value={person.designation}
                                onChange={(e) => updateField(index, "designation", e.target.value)}
                                className="form-control form-control-lg form-control-solid mt-2"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="card-footer d-flex justify-content-end">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    onClick={() => navigate("/contact-person")}
                    disabled={loading}
                  >
                    Cancel
                  </button>

                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {!loading && <span className="indicator-label">Submit</span>}
                    {loading && (
                      <span className="indicator-progress" style={{ display: "block" }}>
                        Please wait...{" "}
                        <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
                      </span>
                    )}
                  </button>
                </div>
              </Form>
            );
          }}
        </Formik>
      </div>
    </div>
  );
};

export default ContactPersonCreatePage;
