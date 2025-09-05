import { useFormik } from "formik";
import { useEffect, useState } from "react";
import { Button, Form } from "react-bootstrap-v5";
import { AiFillDelete, AiOutlineCheck } from "react-icons/ai";
import Select from "react-select";
import _ from "underscore";
import * as Yup from "yup";
import { RoleUserCreateInput } from "./components/core/_models";
import {
  deleteRoleUserData,
  readRoleGroupData,
  readUserData,
  upsertRoleGroupUserData
} from "./components/core/roleUser_APIs";

const urlRoleValidation = Yup.object().shape({
  user: Yup.string().required("User Name is required"),
});

const RoleUserTable = (props: { data: RoleUserCreateInput }) => {
  const [loadingRoleUser, setLoadingRoleUser] = useState(false);

  const [userOptions, setUserOptions] = useState([
    { label: "loading", value: 0, disabled: true },
  ]);

  props.data.id = props.data.id == null ? 0 : props.data.id;
  props.data.name = props.data.name == null ? "" : props.data.name;
  props.data.userRoleGroupMappings =
    props.data.userRoleGroupMappings == null
      ? ""
      : props.data.userRoleGroupMappings;

  var initialValues: any = {
    id: props.data.userRoleGroupMappings.id,
    user: props.data.id,
    roleGroupTemp: props.data.userRoleGroupMappings,
    display: 1,
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    // validationSchema: urlRoleValidation,
    onSubmit: (values) => {

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
      // try {
      //   upsertRoleUserData(values).then((data) => {
      //     console.log(data);
      //     window.location.reload();
      //   });
      // } catch (error) {
      //   console.error(error);
      //   window.location.replace("/error");
      // }

      formik.resetForm();
    },
  });

  const [roleData, setRoleData] = useState([]);

  useEffect(() => {
    try {
      readRoleGroupData().then((data) => {
        setRoleData(data.data);
      });
    } catch (error) {
      console.error(error);
      window.location.replace("/error");
    }
    try {
      readUserData().then((data) => {
        var users = data.data.map((data: any) => {
          return { label: data.name, value: data.id };
        });
        setUserOptions(users);

        // setloading(false);
      });
    } catch (error) {
      console.error(error);
      window.location.replace("/error");
    }
  }, []);

  var roleOptions = roleData.map((data: any) => {
    return { label: data.name, value: data.id };
  });

  var useroptions = { label: props.data.name, value: props.data.id };

  var roleUserOptions = _.map(props.data.userRoleGroupMappings, (data) => {
    return { label: data.roleGroup.name, value: data.roleGroup.id };
  });

  return (
    <>
      {loadingRoleUser && (
        <span
          className="indicator-progress mx-3 mt-5 mb-0"
          style={{ display: "block" }}
        >
          Please wait...{" "}
          <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
        </span>
      )}
      {!loadingRoleUser && (
        <Form
          className="form fv-plugins-bootstrap5 fv-plugins-framework w-100 mt-5"
          id="college_data_form"
          onSubmit={formik.handleSubmit}
          key={props.data.id as number}
        >
          <div className="row">
            <div className="col">
              <Select
                closeMenuOnSelect={false}
                defaultValue={useroptions}
                options={userOptions}
                placeholder="Select User"
                isOptionDisabled={(option: any) => option.disabled}
                loadingMessage={() => "Fetching Users"}
                noOptionsMessage={() => "No User Available"}
                onChange={(data: any) => {
                  formik.setFieldValue("user", data.value);
                }}
              />
              {formik.touched.user && formik.errors.user && (
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
                defaultValue={roleUserOptions}
                loadingMessage={() => "Fetching Roles"}
                noOptionsMessage={() => "No Role Available"}
                isMulti
                options={roleOptions}
                onChange={(data: any) => {
                  data = data.map((value: any) => {
                    return {
                      id: value,
                    };
                  });
                  formik.setFieldValue("roleGroupTemp", data);
                }}
              />

              <input
                type="hidden"
                defaultValue={props.data.id as number}
                autoComplete="off"
              />
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
                    setLoadingRoleUser(true);
                    deleteRoleUserData(props.data.id).then(() => {
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

export { RoleUserTable };
