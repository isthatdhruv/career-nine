/* eslint-disable jsx-a11y/anchor-is-valid */
import { useState } from "react";
import clsx from "clsx";
import { useFormik } from "formik";
import { Link } from "react-router-dom";
import * as Yup from "yup";
import { useAuth } from "../core/Auth";
import { login, getUserByToken } from "../core/_requests";

const API_URL = process.env.REACT_APP_API_URL;
const URL = process.env.REACT_APP_URL;

const Redirect_URL =
  API_URL +
  "/oauth2/authorize/google?redirect_uri=" +
  URL +
  "/oauth2/redirect";

const Login = () => {
  const [loading, setLoading] = useState(false);
  const { saveAuth, setCurrentUser } = useAuth();

  const formik = useFormik({
    initialValues: {
      email: "",
      password: "",
    },
    validationSchema: Yup.object({
      email: Yup.string().email("Invalid email address").required("Email is required"),
      password: Yup.string().required("Password is required"),
    }),
    onSubmit: async (values, { setStatus, setSubmitting }) => {
      setLoading(true);
      setStatus(undefined);
      try {
        const { data } = await login(values.email, values.password);
        // Backend returns { accessToken, tokenType } — map to AuthModel's api_token
        const auth = { api_token: data.accessToken };
        saveAuth(auth);
        const { data: user } = await getUserByToken(auth.api_token);
        setCurrentUser(user);
      } catch (error: any) {
        saveAuth(undefined);
        const msg =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Invalid email or password";
        setStatus(msg);
        setSubmitting(false);
        setLoading(false);
      }
    },
  });

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

      {formik.status && (
        <div className='mb-lg-15 alert alert-danger'>
          
          <div className='alert-text font-weight-bold'>{formik.status=="Unauthorized" ? "Invalid email or password" : formik.status}</div>
        </div>
      )}

      {/* begin::Form group Email */}
      <div className='fv-row mb-10'>
        <label className='form-label fs-6 fw-bolder text-dark'>Email</label>
        <input
          placeholder='Email'
          {...formik.getFieldProps('email')}
          className={clsx(
            'form-control form-control-lg form-control-solid',
            {'is-invalid': formik.touched.email && formik.errors.email},
            {'is-valid': formik.touched.email && !formik.errors.email}
          )}
          type='email'
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

      {/* begin::Form group Password */}
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

        <a
          href={Redirect_URL}
          className="btn btn-flex flex-center btn-light btn-lg w-100 mb-5"
        >
          Login with Google
        </a>
      </div>
      {/* end::Action */}
    </form>
  );
};

export default Login;
