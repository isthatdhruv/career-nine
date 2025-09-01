import clsx from "clsx";
import { useFormik } from "formik";
import React from "react";
import * as Yup from "yup";
import { findemail } from "./OldStudentEmail_API";

const serchSchema = Yup.object().shape({
  name: Yup.string().required("Name is required"),
  session: Yup.string().required("Session is required"),
  searchmail: Yup.string().required("Search Mail is required"),
});

const OldStudentEmail = () => {
  var initialValues: any = {
    name: "",
    session: "",
    searchmail: "",
  };

  var emailsfound: any = [];
  var namesfound: any = [];
  const [loading, setLoading] = React.useState(false);
  const [listEmail, setListEmail] = React.useState([]);
  const [listName, setName] = React.useState([]);
  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema: serchSchema,

    onSubmit: (data, { setStatus, setSubmitting }) => {
      // console.log(data.name);
      setLoading(true);
      try {
        findemail(data.searchmail).then((data1) => {
          var emaildata = data1.data;
          emaildata.map((data2) => {
            var emails = data2.emails;
            var names = data2.name.fullName;
            namesfound.push(names);
            emails.map((emailarray) => {
              if (emailarray.primary === true) {
                emailsfound.push(emailarray.address);
              } else {
                return;
              }
            });
            // console.log(emailsfound)
            setListEmail(emailsfound);
            // console.log(namesfound)
            setName(namesfound);
          });
          setLoading(false);
        });
      } catch (error) {
        console.error(error);
        window.location.replace("/error");
      }
      formik.resetForm();
    },
  });

  return (
    <div className="container">
      <div className="card p-8 mb-10 mt-5">
        {loading && (
          <span className="indicator-progress m-5" style={{ display: "block" }}>
            Please wait...{" "}
            <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
          </span>
        )}

        {!loading && (
          <div className="text-center border-0 mt-3 mb-8">
            <h3
              className="card-title align-items-center flex-column"
              style={{ margin: "0px auto" }}
            >
              <span
                className="card-label fw-bolder m-3"
                style={{ fontSize: "3vmax" }}
              >
                <strong>Enter Old Student Details</strong>
              </span>
            </h3>
          </div>
        )}

        {!loading && (
          <form
            style={{ color: "rgb(126, 30, 30)" }}
            className="form fv-plugins-bootstrap5 fv-plugins-framework"
            onSubmit={formik.handleSubmit}
          >
            <div className="row center mb-10 mt-0">
              <input
                placeholder="Enter Name"
                type="text"
                autoComplete="off"
                {...formik.getFieldProps("name")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.name && formik.errors.name,
                  },
                  {
                    "is-valid": formik.touched.name && !formik.errors.name,
                  }
                )}
              />
            </div>
            <div className="row center mb-10 mt-0">
              <input
                placeholder="Enter Session"
                type="text"
                autoComplete="off"
                {...formik.getFieldProps("session")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.session && formik.errors.session,
                  },
                  {
                    "is-valid":
                      formik.touched.session && !formik.errors.session,
                  }
                )}
              />
            </div>
            <div className="row center mb-10 mt-0">
              <input
                placeholder="Search Mail"
                type="text"
                autoComplete="off"
                {...formik.getFieldProps("searchmail")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.searchmail && formik.errors.searchmail,
                  },
                  {
                    "is-valid":
                      formik.touched.searchmail && !formik.errors.searchmail,
                  }
                )}
              />
            </div>

            <div className="text-center">
              <button
                type="submit"
                className="btn btn-sm btn-primary btn-active-light-secoundary"
                disabled={formik.isSubmitting || !formik.isValid}
              >
                {<span className="indicator-label">Submit</span>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default OldStudentEmail;
