import clsx from "clsx";
import { useFormik } from "formik";
import React, { useEffect, useState } from "react";
import * as Yup from "yup";
import EmaillistTable from "./RoleUserTable";
import { findemail, readRoleGroupData } from "./components/core/roleUser_APIs";

const serchSchema = Yup.object().shape({
  searchname: Yup.string().required("Name is required"),
});

const ForgotPassword = () => {
  var initialValues: any = {
    searchname: "",
  };
  var emailsfound: any = [];
  var namesfound: any = [];
  const [loading, setLoading] = React.useState(false);
  const [listEmail, setListEmail] = React.useState([]);
  const [listName, setName] = React.useState([]);
  const [options, setOptions] = useState([
    { label: "loading", value: 0, disabled: true },
  ]);

  useEffect(() => {
    setLoading(true);

    try {
      readRoleGroupData().then((data) => {
        var roles = data.data.map((data: any) => {
          return { label: data.name, value: data.id };
        });
        setLoading(false);
        setOptions(roles);
      });
    } catch (error) {
      console.error(error);
      window.location.replace("/error");
    }
  }, []);
  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema: serchSchema,

    onSubmit: (data, { setStatus, setSubmitting }) => {
      // console.log(data.searchname);
      setLoading(true);
      try {
        findemail(data.searchname).then((data1) => {
          var ty = data1.data.map((userData) => {
            var t = userData.userRoleGroupMappings.map((userRole) => {
              return {
                value: userRole.roleGroup.id,
                label: userRole.roleGroup.name,
              };
            });
            userData.selectRoleGroupOptions = t;
            return userData;
          });
          data1.data = ty;
          setListEmail(data1.data);
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
          <div className="text-center border-0 mt-5 mb-3 pt-5">
            <h3
              className="card-title align-items-center flex-column"
              style={{ margin: "0px auto" }}
            >
              <span
                className="card-label fw-bolder m-3"
                style={{ fontSize: "3vmax" }}
              >
                <strong>Enter Name</strong>
              </span>
            </h3>
          </div>
        )}

        {!loading && (
          <form
            id="form1"
            style={{ color: "rgb(126, 30, 30)" }}
            className="form fv-plugins-bootstrap5 fv-plugins-framework"
            onSubmit={formik.handleSubmit}
          >
            <div className="row center mb-10 mt-0">
              <input
                placeholder="Name"
                type="text"
                autoComplete="off"
                {...formik.getFieldProps("searchname")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.searchname && formik.errors.searchname,
                  },
                  {
                    "is-valid":
                      formik.touched.searchname && !formik.errors.searchname,
                  }
                )}
              />
            </div>

            <div className="text-center">
              <button
                type="submit"
                id="kt_sign_up_submit"
                className="btn btn-sm btn-primary btn-active-light-secoundary"
                disabled={formik.isSubmitting || !formik.isValid}
              >
                {<span className="indicator-label">Submit</span>}
              </button>
            </div>

            <div>
              <div className="container mt-20">
                {listEmail.map((data: any, count) => (
                  <EmaillistTable
                    key={count}
                    data={data}
                    name={namesfound}
                    roleGroup={options}
                  />
                ))}
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
