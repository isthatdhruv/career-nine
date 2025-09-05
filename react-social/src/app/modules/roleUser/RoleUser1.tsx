import { useFormik } from "formik";
import { useEffect, useState } from "react";
import { Button, Form } from "react-bootstrap-v5";
import { AiOutlineCheck } from "react-icons/ai";
import Select from "react-select";
import _ from "underscore";
import * as Yup from "yup";
import { RoleUserTable } from "./RoleUserTable1";
import {
  readRoleGroupData,
  readUserData,
  upsertRoleGroupUserData
} from "./components/core/roleUser_APIs";

const RoleUserValidation = Yup.object().shape({
  name: Yup.string().required("required"),
});

const RoleUserPage = () => {
  const [userData, setUserData] = useState([]);
  const [roleUserData, setRoleUserData] = useState([]);
  const [loading, setloading] = useState(false);
  const [options, setOptions] = useState([
    { label: "loading", value: 0, disabled: true },
  ]);

  const [userOptions, setUserOptions] = useState([
    { label: "loading", value: 0, disabled: true },
  ]);

  useEffect(() => {
    setloading(true);

    try {
      readRoleGroupData().then((data) => {
        var roles = data.data.map((data: any) => {
          return { label: data.name, value: data.id };
        });
        setOptions(roles);

        try {
          readUserData().then((data) => {
            var users = data.data.map((data: any) => {
              return { label: data.name, value: data.id };
            });
            setUserOptions(users);
            setRoleUserData(data.data);

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

  // var initialValues: RoleUserCreateInput = {
  //   name: "",
  //   roleUserMapping: [],
  //   display: 1
  // };

  var initialValues: any = {
    user: 0,
    roleGroupTemp: [],
    display: 1,
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    // validationSchema: RoleUserValidation,
    onSubmit: (values) => {
      setloading(true);

      values.roleGroupTemp = _.map(values.roleGroupTemp, (data) => {
        return data.id.value;
      });
      try {
        upsertRoleGroupUserData(values).then(() => {
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
                        <h3>User-Role List :</h3>
                      </div>
                    )}

                    {!loading &&
                      roleUserData.map((roleUser: any, id) => (
                        <RoleUserTable data={roleUser} key={id} />
                      ))}

                    {!loading && (
                      <div className="text-center mt-10 mb-3">
                        <h3>To Create User-Role Mapping :</h3>
                      </div>
                    )}

                    {!loading && (
                      <Form
                        className="form fv-plugins-bootstrap5 fv-plugins-framework w-100 mt-5 mb-5"
                        id="college_data_form"
                        onSubmit={formik.handleSubmit}
                      >
                        <div className="row">
                          <div className="col">
                            {/* <AsyncSelect
                              aria-label="Enter name"
                              onInputChange={(data) => { console.log(data) }}
                              noOptionsMessage={()=>{return "Enter Email address!"}}
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
                            /> */}
                            <Select
                              closeMenuOnSelect={false}
                              isMulti
                              options={userOptions}
                              placeholder="Select User"
                              isOptionDisabled={(option: any) =>
                                option.disabled
                              }
                              loadingMessage={() => "Fetching Users"}
                              noOptionsMessage={() => "No User Available"}
                              onChange={(data: any) => {
                                var data1 = data[0].value;
                                formik.setFieldValue("user", data1);
                              }}
                            />
                            {formik.touched.name && formik.errors.name && (
                              <div className="fv-plugins-message-container">
                                <div className="fv-help-block text-danger">
                                  User name is required
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="col">
                            <Select
                              closeMenuOnSelect={false}
                              isMulti
                              options={options}
                              placeholder="Assign Role Group"
                              isOptionDisabled={(option: any) =>
                                option.disabled
                              }
                              loadingMessage={() => "Fetching Roles"}
                              noOptionsMessage={() => "No Role Available"}
                              onChange={(data: any) => {
                                data = data.map((value: any) => {
                                  return {
                                    id: value,
                                  };
                                });
                                formik.setFieldValue("roleGroupTemp", data);
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

export default RoleUserPage;
