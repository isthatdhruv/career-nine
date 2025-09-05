import clsx from "clsx";
import { useFormik } from "formik";
import { useState } from "react";
import { Button, Form } from "react-bootstrap-v5";
import { AiFillDelete, AiOutlineCheck } from "react-icons/ai";
import * as Yup from "yup";
import { deleteRoleData, upsertRoleData } from "./components/core/Role_APIs";

type role = {
  id?: any;
  name: any;
  url: any;
  display: boolean;
};

const roleValidation = Yup.object().shape({
  name: Yup.string().required("required"),
  url: Yup.string()
    .required("required")
    .matches(/^[/]/, "Enter Url starting with '/'"),
});

const RoleTable = (props: { data: role }) => {
  const [loadingRole, setLoadingRole] = useState(false);

  props.data.id = props.data.id == null ? "" : props.data.id;
  props.data.url = props.data.url == null ? "" : props.data.url;
  props.data.name = props.data.name == null ? "" : props.data.name;

  var initialValues: role = {
    id: props.data.id,
    name: props.data.name,
    url: props.data.url,
    display: props.data.display,
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema: roleValidation,
    onSubmit: (values) => {
      values.display = true;
      try {
        upsertRoleData(values).then((data) => {
          window.location.reload();
        });
      } catch (error) {
        console.error(error);
        window.location.replace("/error");
      }

      formik.resetForm();
    },
  });

  return (
    <>
      {loadingRole && (
        <span
          className="indicator-progress mx-3 mt-5 mb-0"
          style={{ display: "block" }}
        >
          Please wait...{" "}
          <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
        </span>
      )}
      {!loadingRole && (
        <Form
          className="form fv-plugins-bootstrap5 fv-plugins-framework w-100 mt-5"
          onSubmit={formik.handleSubmit}
          key={props.data.id}
        >
          <div className="row">
            <div className="col">
              <input
                type="text"
                autoComplete="off"
                placeholder="Enter Role Name"
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
              {formik.touched.name && formik.errors.name && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    Role name is required
                  </div>
                </div>
              )}
            </div>
            <div className="col">
              <input
                type="text"
                autoComplete="off"
                placeholder="Enter URL"
                {...formik.getFieldProps("url")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.url && formik.errors.url,
                  },
                  {
                    "is-valid": formik.touched.url && !formik.errors.url,
                  }
                )}
              />
              {formik.touched.url && formik.errors.url && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    Enter Url starting with '/'
                  </div>
                </div>
              )}
            </div>

            <div className="col-2">
              <div className="d-flex justify-content-end flex-shrink-0">
                <Button
                  type="submit"
                  disabled={formik.isSubmitting || !formik.isValid}
                  className="btn btn-icon btn-dark  btn-active-color-primary btn-sm me-1"
                >
                  <AiOutlineCheck />
                </Button>
                <Button
                  type="button"
                  disabled={false}
                  onClick={() => {
                    setLoadingRole(true);
                    deleteRoleData(props.data.id).then(() => {
                      window.location.reload();
                    });
                  }}
                  className="btn btn-icon btn-danger  btn-active-color-primary btn-sm"
                >
                  <AiFillDelete />
                </Button>
              </div>
            </div>
          </div>
        </Form>
      )}
    </>
  );
};

export { RoleTable };
