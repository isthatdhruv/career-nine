/*  */
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useFormik } from "formik";
import * as Yup from "yup";
var initialValues: any = { email: "" };
const studnetSchema = Yup.object().shape({
  email: Yup.string()
    .required("Offical Email Address is required")
    .notOneOf(["Invalid Email", null], "This Email Id is Already In Use")
    .email("Enter proper Email id"),
  otp: Yup.number().required("Only Number are Required").max(999999, "Error"),
  unirollno: Yup.number().required("Only Number are Required"),
});

const UniRollNoUpdate = () => {
  const [otpSend, setotpSend] = useState(false);
  const [otpEnter, setotpEnter] = useState(false);
  const [emailenetred, setemailenetred] = useState(false);
  // const { initMinute = 0, initSeconds = 10 } = props;
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    let myInterval = setInterval(() => {
      if (seconds > 0) {
        setSeconds(seconds - 1);
      }
      if (seconds === 0) {
        // if (minutes === 0) {
        //   clearInterval(myInterval);
        // } else {
        //   setMinutes(minutes - 1);
        //   setSeconds(59);
        // }
        setotpSend(false);
      }
    }, 1000);
    return () => {
      clearInterval(myInterval);
    };
  });
  const formik = useFormik({
    initialValues,
    validationSchema: studnetSchema,
    onSubmit: (values, { setStatus, setSubmitting }) => {},
  });
  return (
    <>
      <div className="d-flex flex-column flex-root" id="kt_app_root">
        {/* <style>body 
                      {background - image: url('https://preview.keenthemes.com/metronic8/demo1/assets/media/auth/bg8.jpg'); } 
                      [data-theme="dark"] 
                      body {background - image: url('/metronic8/demo1/assets/media/auth/bg8-dark.jpg'); }
                      </style> */}

        <div className="d-flex flex-column flex-center flex-column-fluid">
          <div className="d-flex flex-column flex-center text-center p-10">
            <div className="card card-flush w-md-750px py-5">
              <div className="card-body py-15 py-lg-20">
                <div className="mb-7">
                  <img
                    alt="Logo"
                    src="https://www.kccitm.edu.in/images/kcc-logo-new.png"
                    className="h-80px"
                  />
                </div>
                <h1 className="fw-bolder text-gray-900 mb-5">
                  University Roll No. Update
                </h1>
                {/* <div className="fw-semibold fs-6 text-gray-700 mb-7"> */}
                <div>
                  <form
                    id="form1"
                    style={{ color: "rgb(126, 30, 30)" }}
                    className="form fv-plugins-bootstrap5 fv-plugins-framework"
                    onSubmit={formik.handleSubmit}
                  >
                    <div className="row g-9 mb-8 mt-1">
                      <label className="col-md-4 required fs-6 fw-bold mb-2 d-flex">
                        <strong>Official Email Id : </strong>
                      </label>
                      <input
                        type="text"
                        autoComplete="off"
                        {...formik.getFieldProps("email")}
                        className={clsx(
                          "form-control form-control-lg form-control-solid col-md-6",
                          {
                            "is-invalid text-danger":
                              formik.touched.email && formik.errors.email,
                          },
                          {
                            "is-valid":
                              formik.touched.email && !formik.errors.email,
                          }
                        )}
                      ></input>
                      {seconds == 0 && !otpSend && !formik.errors.email && (
                        <>
                          <button
                            className="btn btn-primary col-md-4"
                            onClick={() => {
                              setotpSend(true);
                              setSeconds(10);
                            }}
                          >
                            Send OTP
                          </button>
                        </>
                      )}

                      {/* {formik.touched.email && formik.errors.email && (
                            <>{formik.errors.email}</>
                          )} */}
                      {seconds != 0 && (
                        <span>
                          Resend OTP in{" "}
                          <h1>
                            {minutes < 10 ? `0${minutes}` : minutes}:
                            {seconds < 10 ? `0${seconds}` : seconds}
                          </h1>{" "}
                          secs
                        </span>
                      )}
                    </div>

                    {otpSend && (
                      <div className="row g-9 mb-8 mt-1">
                        <label className="col-md-4 required fs-6 fw-bold mb-2 d-flex">
                          <strong>Enter OTP </strong>
                        </label>
                        <input
                          type="text"
                          autoComplete="off"
                          {...formik.getFieldProps("otp")}
                          className={clsx(
                            "form-control form-control-lg form-control-solid",
                            {
                              "is-invalid text-danger":
                                formik.touched.otp && formik.errors.otp,
                            },
                            {
                              "is-valid":
                                formik.touched.otp && !formik.errors.otp,
                            }
                          )}
                        ></input>
                        {!otpEnter && !formik.errors.otp && (
                          <>
                            <button
                              className="btn btn-primary col-md-4"
                              onClick={() => {
                                setotpEnter(true);
                              }}
                            >
                              Verify OTP
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {otpEnter && (
                      <div className="row g-9 mb-8 mt-1">
                        <label className="col-md-4 required fs-6 fw-bold mb-2 d-flex">
                          <strong>University Roll No. </strong>
                        </label>
                        <input
                          type="text"
                          autoComplete="off"
                          {...formik.getFieldProps("unirollno")}
                          className={clsx(
                            "form-control form-control-lg form-control-solid",
                            {
                              "is-invalid text-danger":
                                formik.touched.unirollno &&
                                formik.errors.unirollno,
                            },
                            {
                              "is-valid":
                                formik.touched.unirollno &&
                                !formik.errors.unirollno,
                            }
                          )}
                        ></input>
                        {!emailenetred && !formik.errors.unirollno && (
                          <>
                            <button
                              className="btn btn-primary col-md-4"
                              onClick={() => {
                                setemailenetred(true);
                              }}
                            >
                              Submit
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </form>
                </div>
                <div className="mb-0">
                  {/* <img src="https://media.istockphoto.com/vectors/vector-folded-hands-icon-on-a-white-background-vector-id1170697087?k=20&m=1170697087&s=612x612&w=0&h=moAI8OnApwLCMq659OsZw2Rxm44pez8gyRjnAZQ2diA=" className="mw-100 mh-300px theme-light-show" alt="" /> */}
                  {/* <img src="https://preview.keenthemes.com/metronic8/demo1/assets/media/auth/welcome-dark.png" className="mw-100 mh-300px theme-dark-show" alt="" /> */}
                </div>
                {/* </div> */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export { UniRollNoUpdate };
