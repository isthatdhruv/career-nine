/* eslint-disable jsx-a11y/anchor-is-valid */
import { useState } from "react";
import clsx from "clsx";
import { useFormik } from "formik";
import { Link, useNavigate } from "react-router-dom";
import * as Yup from "yup";
import { useAuth } from "../core/Auth";
import { login, studentLogin, getCurrentUser } from "../core/_requests";

const API_URL = process.env.REACT_APP_API_URL;
const URL = process.env.REACT_APP_URL;

const Redirect_URL =
  API_URL +
  "/oauth2/authorize/google?redirect_uri=" +
  URL +
  "/oauth2/redirect";

// Convert an <input type="date"> value (yyyy-MM-dd) to the dd-MM-yyyy the API expects.
const toDdMmYyyy = (iso: string): string => {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}-${m}-${y}`;
};

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"staff" | "student">("staff");
  const { setCurrentUser } = useAuth();
  const navigate = useNavigate();

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      mode: "staff",
      email: "",
      password: "",
      dob: "",
    },
    validationSchema: Yup.object({
      mode: Yup.string(),
      email: Yup.string().when("mode", {
        is: "student",
        then: (s) => s.required("Username or email is required"),
        otherwise: (s) => s.email("Invalid email address").required("Email is required"),
      }),
      password: Yup.string().when("mode", {
        is: "student",
        then: (s) => s.notRequired(),
        otherwise: (s) => s.required("Password is required"),
      }),
      dob: Yup.string().when("mode", {
        is: "student",
        then: (s) => s.required("Date of birth is required"),
        otherwise: (s) => s.notRequired(),
      }),
    }),
    onSubmit: async (values, { setStatus, setSubmitting }) => {
      setLoading(true);
      setStatus(undefined);
      try {
        if (values.mode === "student") {
          await studentLogin(values.email, toDdMmYyyy(values.dob));
        } else {
          // Phase 16: cookies are set by the server on /auth/login.
          await login(values.email, values.password);
        }
        const { data: user } = await getCurrentUser();
        setCurrentUser(user);
        if (values.mode === "student") {
          // One-time profile completion: a student whose info isn't completed yet
          // (e.g. freshly provisioned from a website lead) fills the student-info
          // form once before reaching the dashboard. infoCompleted comes from /auth/me.
          const infoCompleted = (user as any)?.infoCompleted === true;
          navigate(infoCompleted ? "/student/dashboard" : "/student/dashboard/student-info");
        }
      } catch (error: any) {
        const msg =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          (values.mode === "student"
            ? "Invalid username/email or date of birth"
            : "Invalid email or password");
        setStatus(msg);
        setSubmitting(false);
        setLoading(false);
      }
    },
  });

  const switchMode = (next: "staff" | "student") => {
    setMode(next);
    formik.setFieldValue("mode", next);
    formik.setStatus(undefined);
  };

  const isStudent = mode === "student";

  return (
    <form className="form w-100" noValidate id="kt_login_signin_form" onSubmit={formik.handleSubmit}>
      {/* begin::Heading */}
      <div className="text-center mb-10">
        <h1 className="text-dark mb-3">Sign In to Career-9</h1>
        <div className="text-gray-400 fw-bold fs-4">
          New Here?{' '}
          <Link to='/auth/registration' className='link-primary fw-bolder'>
            Create an Account
          </Link>
        </div>
      </div>
      {/* end::Heading */}

      {/* begin::Mode toggle (staff vs student) */}
      <div className='d-flex gap-3 mb-10'>
        <button
          type='button'
          onClick={() => switchMode('staff')}
          className={clsx('btn btn-lg w-100', isStudent ? 'btn-light' : 'btn-primary')}
        >
          Staff
        </button>
        <button
          type='button'
          onClick={() => switchMode('student')}
          className={clsx('btn btn-lg w-100', isStudent ? 'btn-primary' : 'btn-light')}
        >
          Student
        </button>
      </div>
      {/* end::Mode toggle */}

      {formik.status && (
        <div className='mb-lg-15 alert alert-danger'>
          <div className='alert-text font-weight-bold'>{formik.status == "Unauthorized" ? "Invalid email or password" : formik.status}</div>
        </div>
      )}

      {/* begin::Form group identifier */}
      <div className='fv-row mb-10'>
        <label className='form-label fs-6 fw-bolder text-dark'>{isStudent ? 'Username or Email' : 'Email'}</label>
        <input
          placeholder={isStudent ? 'Username or Email' : 'Email'}
          {...formik.getFieldProps('email')}
          className={clsx(
            'form-control form-control-lg form-control-solid',
            {'is-invalid': formik.touched.email && formik.errors.email},
            {'is-valid': formik.touched.email && !formik.errors.email}
          )}
          type={isStudent ? 'text' : 'email'}
          name='email'
          autoComplete='off'
        />
        {formik.touched.email && formik.errors.email && (
          <div className='fv-plugins-message-container'>
            <div className='fv-help-block'>
              <span role='alert'>{formik.errors.email}</span>
            </div>
          </div>
        )}
      </div>
      {/* end::Form group */}

      {/* begin::Form group secret (password for staff, DOB for student) */}
      {isStudent ? (
        <div className='fv-row mb-10'>
          <label className='form-label fw-bolder text-dark fs-6'>Date of Birth</label>
          <input
            type='date'
            autoComplete='off'
            {...formik.getFieldProps('dob')}
            className={clsx(
              'form-control form-control-lg form-control-solid',
              {'is-invalid': formik.touched.dob && formik.errors.dob},
              {'is-valid': formik.touched.dob && !formik.errors.dob}
            )}
            name='dob'
          />
          {formik.touched.dob && formik.errors.dob && (
            <div className='fv-plugins-message-container'>
              <div className='fv-help-block'>
                <span role='alert'>{formik.errors.dob}</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className='fv-row mb-10'>
          <div className='d-flex justify-content-between mt-n5'>
            <div className='d-flex flex-stack mb-2'>
              <label className='form-label fw-bolder text-dark fs-6 mb-0'>Password</label>
              <Link
                to='/auth/forgot-password'
                className='link-primary fs-6 fw-bolder'
                style={{marginLeft: '5px'}}
              >
                Forgot Password ?
              </Link>
            </div>
          </div>
          <input
            type='password'
            autoComplete='off'
            {...formik.getFieldProps('password')}
            className={clsx(
              'form-control form-control-lg form-control-solid',
              {'is-invalid': formik.touched.password && formik.errors.password},
              {'is-valid': formik.touched.password && !formik.errors.password}
            )}
            name='password'
            placeholder='Password'
          />
          {formik.touched.password && formik.errors.password && (
            <div className='fv-plugins-message-container'>
              <div className='fv-help-block'>
                <span role='alert'>{formik.errors.password}</span>
              </div>
            </div>
          )}
        </div>
      )}
      {/* end::Form group */}

      {/* begin::Action */}
      <div className="text-center">
        <button
          type='submit'
          className="btn btn-lg btn-primary w-100 mb-5"
          disabled={formik.isSubmitting || !formik.isValid}
        >
          {!loading && <span className='indicator-label'>Login</span>}
          {loading && (
            <span className='indicator-progress' style={{display: 'block'}}>
              Please wait...
              <span className='spinner-border spinner-border-sm align-middle ms-2'></span>
            </span>
          )}
        </button>

        {/* <a
          href={Redirect_URL}
          className="btn btn-flex flex-center btn-light btn-lg w-100 mb-5"
        >
          Login with Google
        </a> */}
      </div>
      {/* end::Action */}

      {/*
        Student & Counsellor role buttons removed (R2): the separate /student/login
        portal is dissolved; students sign in via the "Student" mode toggle above.
        Counsellor login remains reachable at /counsellor/login directly.

      <div className='text-center text-muted text-uppercase fw-bolder mb-5' style={{fontSize: '12px'}}>Or sign in as</div>
      <div className='d-flex gap-3'>
        <a href='/student/login' ...>Student</a>
        <a href='/counsellor/login' ...>Counsellor</a>
      </div>
      */}
    </form>
  );
};

export default Login;
