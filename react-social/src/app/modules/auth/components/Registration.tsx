/* eslint-disable jsx-a11y/anchor-is-valid */
import { useState, useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import clsx from "clsx";
import { Link } from "react-router-dom";
import { PasswordMeterComponent } from "../../../../_metronic/assets/ts/components";

const API_URL = process.env.REACT_APP_API_URL;

const initialValues = {
  firstname: "",
  lastname: "",
  email: "",
  password: "",
  changepassword: "",
  phone: "",
  organisation:"",
  designation:"",
};

const registrationSchema = Yup.object().shape({
  firstname: Yup.string()
    .min(3, "Minimum 3 symbols")
    .max(50, "Maximum 50 symbols")
    .required("First name is required"),
  email: Yup.string()
    .email("Wrong email format")
    .min(3, "Minimum 3 symbols")
    .max(50, "Maximum 50 symbols")
    .required("Email is required"),
  lastname: Yup.string()
    .min(3, "Minimum 3 symbols")
    .max(50, "Maximum 50 symbols")
    .required("Last name is required"),
  password: Yup.string()
    .min(3, "Minimum 3 symbols")
    .max(50, "Maximum 50 symbols")
    .required("Password is required"),
  phone: Yup.string()
    .min(10, "Minimum 10 symbols")
    .max(15, "Maximum 15 symbols")
    .required("Phone number is required"),
  organisation: Yup.string()
    .min(3, "Minimum 3 symbols")
    .max(50, "Maximum 50 symbols")
    .required("Organisation is required"),
  designation: Yup.string()
    .min(3, "Minimum 3 symbols")
    .max(50, "Maximum 50 symbols")
    .required("Designation is required"),
  changepassword: Yup.string()
    .required("Password confirmation is required")
    .when("password", {
      is: (val: string) => (val && val.length > 0 ? true : false),
      then: Yup.string().oneOf(
        [Yup.ref("password")],
        "Password and Confirm Password didn't match"
      ),
    }),
});

export function Registration() {
  const [loading] = useState(false);
  const formik = useFormik({
    initialValues,
    validationSchema: registrationSchema,
    onSubmit: async (values, { setStatus, setSubmitting }) => {
      setStatus(undefined);
      try {
        const payload = {
          name: `${values.firstname} ${values.lastname}`,
          firstname: values.firstname,
          lastname: values.lastname,
          email: values.email,
          password: values.password,
          phone: values.phone,
          organisation: values.organisation,
          designation: values.designation,
        };
        console.log("Submitting registration with payload:", payload);

        const res = await fetch(`${API_URL}/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          // server-side validation or error message
          const msg = data && (data.message || data.error) ? (data.message || data.error) : 'Registration failed';
          setStatus(msg);
        } else {
          // success - redirect to login
          window.location.href = '/auth/login';
        }
      } catch (err: any) {
        setStatus(err && err.message ? err.message : 'Unexpected error');
      } finally {
        setSubmitting(false);
      }
    },
  });

  useEffect(() => {
    PasswordMeterComponent.bootstrap();
  }, []);

  return (
    <form
      className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework"
      noValidate
      id="kt_login_signup_form"
      onSubmit={formik.handleSubmit}
    >
      {/* begin::Heading */}
      <div className="mb-10 text-center">
        {/* begin::Title */}
        <h1 className="text-dark mb-3">Create an Account</h1>
        <div className="text-gray-400 fw-bold fs-4">
          Already have an account?
          <Link
            to="/auth/login"
            className="link-primary fw-bolder"
            style={{ marginLeft: "5px" }}
          >
            Forgot Password ?
          </Link>
        </div>
        {/* end::Link */}
      </div>
      {/* end::Heading */}

      {formik.status && (
        <div className="mb-lg-15 alert alert-danger">
          <div className="alert-text font-weight-bold">{formik.status}</div>
        </div>
      )}

      {/* begin::Form group Firstname */}
      <div className="row fv-row mb-7">
        <div className="col-xl-6">
          <label className='class="form-label fw-bolder text-dark fs-6'>
            First name
          </label>
          <input
            placeholder="First name"
            type="text"
            autoComplete="off"
            {...formik.getFieldProps("firstname")}
            className={clsx(
              "form-control form-control-lg form-control-solid",
              {
                "is-invalid":
                  formik.touched.firstname && formik.errors.firstname,
              },
              {
                "is-valid":
                  formik.touched.firstname && !formik.errors.firstname,
              }
            )}
          />
          {formik.touched.firstname && formik.errors.firstname && (
            <div className="fv-plugins-message-container">
              <div className="fv-help-block">
                <span role="alert">{formik.errors.firstname}</span>
              </div>
            </div>
          )}
        </div>
        <div className="col-xl-6">
          {/* begin::Form group Lastname */}
          <div className="fv-row mb-5">
            <label className="form-label fw-bolder text-dark fs-6">
              Last name
            </label>
            <input
              placeholder="Last name"
              type="text"
              autoComplete="off"
              {...formik.getFieldProps("lastname")}
              className={clsx(
                "form-control form-control-lg form-control-solid",
                {
                  "is-invalid":
                    formik.touched.lastname && formik.errors.lastname,
                },
                {
                  "is-valid":
                    formik.touched.lastname && !formik.errors.lastname,
                }
              )}
            />
            {formik.touched.lastname && formik.errors.lastname && (
              <div className="fv-plugins-message-container">
                <div className="fv-help-block">
                  <span role="alert">{formik.errors.lastname}</span>
                </div>
              </div>
            )}
          </div>
          {/* end::Form group */}
        </div>
      </div>
      {/* end::Form group */}

      {/* begin::Form group Email */}
      <div className="fv-row mb-7">
        <label className="form-label fw-bolder text-dark fs-6">Email</label>
        <input
          placeholder="Email"
          type="email"
          autoComplete="off"
          {...formik.getFieldProps("email")}
          className={clsx(
            "form-control form-control-lg form-control-solid",
            { "is-invalid": formik.touched.email && formik.errors.email },
            {
              "is-valid": formik.touched.email && !formik.errors.email,
            }
          )}
        />
        {formik.touched.email && formik.errors.email && (
          <div className="fv-plugins-message-container">
            <div className="fv-help-block">
              <span role="alert">{formik.errors.email}</span>
            </div>
          </div>
        )}
      </div>

      <div className="fv-row mb-7">
        <label className="form-label fw-bolder text-dark fs-6">Phone Number</label>
        <input
          placeholder="Phone Number"
          type="tel"
          autoComplete="off"
          {...formik.getFieldProps("phone")}
          className={clsx(
            "form-control form-control-lg form-control-solid",
            { "is-invalid": formik.touched.phone && formik.errors.phone },
            {
              "is-valid": formik.touched.phone && !formik.errors.phone,
            }
          )}
        />
        {formik.touched.phone && formik.errors.phone && (
          <div className="fv-plugins-message-container">
            <div className="fv-help-block">
              <span role="alert">{formik.errors.phone}</span>
            </div>
          </div>
        )}
      </div>

      <div className="fv-row mb-7">
        <label className="form-label fw-bolder text-dark fs-6">Organisation</label>
        <input
          placeholder="Organisation"
          type="text"
          autoComplete="off"
          {...formik.getFieldProps("organisation")}
          className={clsx(
            "form-control form-control-lg form-control-solid",
            { "is-invalid": formik.touched.organisation && formik.errors.organisation },
            {
              "is-valid": formik.touched.organisation && !formik.errors.organisation,
            }
          )}
        />
        {formik.touched.organisation && formik.errors.organisation && (
          <div className="fv-plugins-message-container">
            <div className="fv-help-block">
              <span role="alert">{formik.errors.organisation}</span>
            </div>
          </div>
        )}
      </div>

      <div className="fv-row mb-7">
        <label className="form-label fw-bolder text-dark fs-6">Designation</label>
        <input
          placeholder="Designation"
          type="text"
          autoComplete="off"
          {...formik.getFieldProps("designation")}
          className={clsx(
            "form-control form-control-lg form-control-solid",
            { "is-invalid": formik.touched.designation && formik.errors.designation },
            {
              "is-valid": formik.touched.designation && !formik.errors.designation,
            }
          )}
        />
        {formik.touched.designation && formik.errors.designation && (
          <div className="fv-plugins-message-container">
            <div className="fv-help-block">
              <span role="alert">{formik.errors.designation}</span>
            </div>
          </div>
        )}
      </div>

      {/* end::Form group */}

      {/* begin::Form group Password */}
      <div className="mb-10 fv-row" data-kt-password-meter="true">
        <div className="mb-1">
          <label className="form-label fw-bolder text-dark fs-6">
            Password
          </label>
          <div className="position-relative mb-3">
            <input
              type="password"
              placeholder="Password"
              autoComplete="off"
              {...formik.getFieldProps("password")}
              className={clsx(
                "form-control form-control-lg form-control-solid",
                {
                  "is-invalid":
                    formik.touched.password && formik.errors.password,
                },
                {
                  "is-valid":
                    formik.touched.password && !formik.errors.password,
                }
              )}
            />
            {formik.touched.password && formik.errors.password && (
              <div className="fv-plugins-message-container">
                <div className="fv-help-block">
                  <span role="alert">{formik.errors.password}</span>
                </div>
              </div>
            )}
          </div>
          {/* begin::Meter */}
          <div
            className="d-flex align-items-center mb-3"
            data-kt-password-meter-control="highlight"
          >
            <div className="flex-grow-1 bg-secondary bg-active-success rounded h-5px me-2"></div>
            <div className="flex-grow-1 bg-secondary bg-active-success rounded h-5px me-2"></div>
            <div className="flex-grow-1 bg-secondary bg-active-success rounded h-5px me-2"></div>
            <div className="flex-grow-1 bg-secondary bg-active-success rounded h-5px"></div>
          </div>
          {/* end::Meter */}
        </div>
        <div className="text-muted">
          Use 8 or more characters with a mix of letters, numbers & symbols.
        </div>
      </div>
      {/* end::Form group */}

      {/* begin::Form group Confirm password */}
      <div className="fv-row mb-5">
        <label className="form-label fw-bolder text-dark fs-6">
          Confirm Password
        </label>
        <input
          type="password"
          placeholder="Password confirmation"
          autoComplete="off"
          {...formik.getFieldProps("changepassword")}
          className={clsx(
            "form-control form-control-lg form-control-solid",
            {
              "is-invalid":
                formik.touched.changepassword && formik.errors.changepassword,
            },
            {
              "is-valid":
                formik.touched.changepassword && !formik.errors.changepassword,
            }
          )}
        />
        {formik.touched.changepassword && formik.errors.changepassword && (
          <div className="fv-plugins-message-container">
            <div className="fv-help-block">
              <span role="alert">{formik.errors.changepassword}</span>
            </div>
          </div>
        )}
      </div>
      {/* end::Form group */}

      {/* begin::Form group */}
      {/* <div className="fv-row mb-10">
        <div className="form-check form-check-custom form-check-solid">
          <input
            className="form-check-input"
            type="checkbox"
            id="kt_login_toc_agree"
            {...formik.getFieldProps("acceptTerms")}
          />
          <label
            className="form-check-label fw-bold text-gray-700 fs-6"
            htmlFor="kt_login_toc_agree"
          >
            I Agree the{" "}
            <Link to="/auth/terms" className="ms-1 link-primary">
              terms and conditions
            </Link>
            .
          </label>
          {formik.touched.acceptTerms && formik.errors.acceptTerms && (
            <div className="fv-plugins-message-container">
              <div className="fv-help-block">
                <span role="alert">{formik.errors.acceptTerms}</span>
              </div>
            </div>
          )}
        </div>
      </div> */}
      {/* end::Form group */}

      {/* begin::Form group */}
      <div className="text-center">
        <button
          type="submit"
          id="kt_sign_up_submit"
          className="btn btn-lg btn-primary w-100 mb-5"
          disabled={formik.isSubmitting || !formik.isValid}
        >
          {!loading && <span className="indicator-label">Submit</span>}
          {loading && (
            <span className="indicator-progress" style={{ display: "block" }}>
              Please wait...{" "}
              <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
            </span>
          )}
        </button>
        <Link to="/auth/login">
          <button
            type="button"
            id="kt_login_signup_form_cancel_button"
            className="btn btn-lg btn-light-primary w-100 mb-5"
          >
            Cancel
          </button>
        </Link>
      </div>
      {/* end::Form group */}
    </form>
  );
}
