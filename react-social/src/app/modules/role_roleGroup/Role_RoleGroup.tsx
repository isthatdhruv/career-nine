import clsx from "clsx";
import { useFormik } from "formik";
import { useEffect, useState } from "react";
import { Button, Form } from "react-bootstrap-v5";
import { AiOutlineCheck } from "react-icons/ai";
import { useLocation } from "react-router";
import Select from "react-select";
import _ from "underscore";
import * as Yup from "yup";
import { useAuth } from "../../modules/auth";
import { Role_RoleGroupTable } from "./Role_RoleGroupTable";
import {
  readRoleData,
  readRole_RoleGroupData,
  upsertRole_RoleGroupData,
} from "./components/core/Role_RoleGroup_APIs";
import { Role_RoleGroupCreateInput } from "./components/core/_models";

const role_roleGroupValidation = Yup.object().shape({
  name: Yup.string().required("required"),
});

const Role_RoleGroupPage = () => {
  const [role_roleGroupData, setRole_roleGroupData] = useState([]);
  const [loading, setloading] = useState(false);
  const [autorized, setAutorized] = useState(false);
  const [options, setoptions] = useState([
    { label: "Loading", value: 0, disabled: true },
  ]);

  const location = useLocation();
  const currentUser = useAuth().currentUser;
  // const authUser = currentUser?.authorityUrls?.includes(location.pathname)

  useEffect(() => {
    // if (_.contains(currentUser!.authorityUrls!, location.pathname)) {
    //   setAutorized(true);
    // }
    // console.log(currentUser?.authorityUrls?.includes(location.pathname));
    setloading(true);
    try {
      readRoleData().then((data) => {
        var roleOptions = data.data.map((data: any) => {
          return { label: data.name, value: data.id };
        });
        setoptions(roleOptions);
        try {
          readRole_RoleGroupData().then((data1) => {
            setRole_roleGroupData(data1.data);
            setloading(false);
          });
        } catch (error) {
          console.error(error);
          window.location.replace("/error");
        }
      });
    } catch (error) {
      console.error(error);
      window.location.replace("/error");
    }
  }, []);

  var initialValues: Role_RoleGroupCreateInput = {
    name: "",
    roleRoleGroupMappings: [],
    display: 1,
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema: role_roleGroupValidation,
    onSubmit: (values) => {
      values.roleRoleGroupMappings = _.map(
        values.roleRoleGroupMappings,
        (data) => {
          return {
            display: true,
            role: {
              display: true,
              name: data.label,
              id: data.value,
            },
            roleGroup: values.id,
          };
        }
      );
      setloading(true);
      try {
        upsertRole_RoleGroupData(values).then((data) => {
          window.location.reload();
        });
      } catch (error) {
        console.error(error);
        window.location.replace("/error");
      }

      formik.resetForm();
    },
  });
  // if (!autorized) { return(<Error500 />) }
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
                        <h3>Role Group-Role List :</h3>
                      </div>
                    )}

                    {!loading &&
                      role_roleGroupData.map((role_roleGroup: any, id) => (
                        <Role_RoleGroupTable
                          data={role_roleGroup}
                          key={id}
                          role_data={options}
                        />
                      ))}

                    {!loading && (
                      <div className="text-center mt-10 mb-3">
                        <h3>To Create Role Group-Role Mapping :</h3>
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
                              placeholder="Enter Role Group Name"
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
                                  Role group name is required
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="col">
                            <Select
                              closeMenuOnSelect={false}
                              isMulti
                              options={options}
                              placeholder="Assign Roles"
                              isOptionDisabled={(option: any) =>
                                option.disabled
                              }
                              loadingMessage={() => "Fetching Roles"}
                              noOptionsMessage={() => "No Role Available"}
                              onChange={(data: any) => {
                                formik.setFieldValue(
                                  "roleRoleGroupMappings",
                                  data
                                );
                              }}
                            />
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

export default Role_RoleGroupPage;
