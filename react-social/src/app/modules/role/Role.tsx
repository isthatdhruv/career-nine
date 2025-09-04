import clsx from "clsx";
import { useFormik } from "formik";
import { useEffect, useState } from "react";
import { Button, Form } from "react-bootstrap-v5";
import { AiOutlineCheck } from "react-icons/ai";
import * as Yup from "yup";
import { RoleTable } from "./RoleTable";
import { readRoleData, upsertRoleData } from "./components/core/Role_APIs";
import { Role } from "./components/core/_models";

const roleValidation = Yup.object().shape({
  name: Yup.string().required("required"),
  url: Yup.string()
    .required("required")
    .matches(/^[/]/, "Enter Url starting with '/'"),
});

const RolePage = () => {
  const [roleData, setRoleData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);

    try {
      readRoleData().then((data) => {
        setRoleData(data.data);
        setLoading(false);
      });
    } catch (error) {
      console.error(error);
      window.location.replace("/error");
    }
  }, []);

  var initialValues: Role = {
    name: "",
    url: "",
    display: true,
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema: roleValidation,
    onSubmit: (values) => {
      setLoading(true);
      upsertRoleData(values)
        .then((data) => {
        })
        .catch((error) => {
          console.error(error);
          window.location.replace("/error");
        })
        .finally(() => {
          window.location.reload();
        });

      formik.resetForm();
    },
  });

  return (
    <>
      <div id="kt_content_container" className="container-xxl">
        <div className="d-flex flex-column">
          <div className="row g-5 g-xl-8">
            <div className="card mb-5 mb-xl-8">
              <div className="card-body">
                <div className="row">
                  <div className="card">
                    {loading && (
                      <span
                        className="indicator-progress"
                        style={{ display: "block" }}
                      >
                        Please wait...{" "}
                        <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
                      </span>
                    )}

                    {!loading && (
                      <div className="text-center mb-3">
                        <h3>Roles List :</h3>
                      </div>
                    )}

                    {!loading &&
                      roleData.map((role: any, id) => (
                        <RoleTable data={role} key={id} />
                      ))}

                    {!loading && (
                      <div className="text-center mt-10 mb-3">
                        <h3>To Create Role :</h3>
                      </div>
                    )}

                    {!loading && (
                      <Form
                        className="form fv-plugins-bootstrap5 fv-plugins-framework w-100 mt-5 mb-5"
                        onSubmit={formik.handleSubmit}
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
                                  "is-valid":
                                    formik.touched.name && !formik.errors.name,
                                }
                              )}
                            />
                            {formik.touched.name && formik.errors.name && (
                              <div className="fv-plugins-message-container">
                                <div className="fv-help-block text-danger">
                                  <span role="alert">
                                    Role name is required
                                  </span>
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
                                  "is-valid":
                                    formik.touched.url && !formik.errors.url,
                                }
                              )}
                            />
                            {formik.touched.url && formik.errors.url && (
                              <div className="fv-plugins-message-container">
                                <div className="fv-help-block text-danger">
                                  <span role="alert">
                                    Enter Url starting with '/'
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="col-2">
                            <div className="d-flex justify-content-end flex-shrink-0">
                              <Button
                                type="submit"
                                disabled={
                                  formik.isSubmitting || !formik.isValid
                                }
                                className="btn btn-icon btn-dark  btn-active-color-primary btn-sm me-1"
                              >
                                <AiOutlineCheck />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Form>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RolePage;
