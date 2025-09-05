import clsx from "clsx";
import { useFormik } from "formik";
import { useEffect, useState } from "react";
import { Button, Form } from "react-bootstrap-v5";
import { AiFillDelete, AiOutlineCheck } from "react-icons/ai";
import Select from "react-select";
import _ from "underscore";
import * as Yup from "yup";
import {
  deleteRole_RoleGroupData,
  upsertRole_RoleGroupData
} from "./components/core/Role_RoleGroup_APIs";
import { Role_RoleGroupCreateInput } from "./components/core/_models";

const role_roleGroupValidation = Yup.object().shape({
  name: Yup.string().required("required"),
});

const Role_RoleGroupTable = (props: {
  data: Role_RoleGroupCreateInput;
  role_data: any;
}) => {
  const [loadingRole_RoleGroup, setLoadingRole_RoleGroup] = useState(false);

  props.data.id = props.data.id == null ? 0 : props.data.id;
  props.data.name = props.data.name == null ? "" : props.data.name;
  props.data.roleRoleGroupMappings =
    props.data.roleRoleGroupMappings == null
      ? ""
      : props.data.roleRoleGroupMappings;

  var initialValues: Role_RoleGroupCreateInput = {
    id: props.data.id,
    name: props.data.name,
    roleRoleGroupMappings: props.data.roleRoleGroupMappings,
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
      // values.role_roleGroupMapping = values.role

      // delete values.role_roleGroupMapping;
      // setLoadingRole_RoleGroup(true);
      try {
        upsertRole_RoleGroupData(values).then((data) => {
          window.location.reload();
        });
      } catch (error) {
        console.error(error);
        window.location.replace("/error");
      }
      // var roleId = values.id
      // var roleUrlMapping = values.roleUrlMapping.map((data: any) => {
      //   return {
      //     create: {urlId: data.value},
      //     where: {roleId_urlId: {roleId: roleId, urlId: data.value}},
      //   }
      // })
      // delete values['roleUrlMapping']
      // values.roleUrlMapping = roleUrlMapping

      // setLoadingRole_RoleGroup(true)
      // upsertRole_RoleGroupData(values).then((data: any) => {
      //   formik.setFieldValue('role', data.data.role)
      //   formik.setFieldValue('id', data.data.id)
      //   formik.setFieldValue('roleUrlMapping', data.data.roleUrlMapping)
      //   formik.setSubmitting(false)
      //   setLoadingRole_RoleGroup(false)
      // })

      formik.resetForm();
    },
  });

  const [roleData, setRoleData] = useState(props.role_data);

  useEffect(() => {}, []);

  var role_roleGroupMappingOptions = _.map(
    props.data.roleRoleGroupMappings,
    (data) => {
      return { label: data.role.name, value: data.role.id };
    }
  );

  return (
    <>
      {loadingRole_RoleGroup && (
        <span
          className="indicator-progress mx-3 mt-5 mb-0"
          style={{ display: "block" }}
        >
          Please wait...{" "}
          <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
        </span>
      )}
      {!loadingRole_RoleGroup && (
        <Form
          className="form fv-plugins-bootstrap5 fv-plugins-framework w-100 mt-5"
          onSubmit={formik.handleSubmit}
          key={props.data.id as number}
        >
          <div className="row">
            <div className="col">
              <input
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
              <input
                type="hidden"
                defaultValue={props.data.id as number}
                autoComplete="off"
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
                defaultValue={role_roleGroupMappingOptions}
                loadingMessage={() => "Fetching Roles"}
                noOptionsMessage={() => "No Role Available"}
                isMulti
                options={roleData}
                onChange={(option: any) => {
                  formik.setFieldValue("roleRoleGroupMappings", option);
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
                    setLoadingRole_RoleGroup(true);
                    deleteRole_RoleGroupData(props.data.id).then(() => {
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

export { Role_RoleGroupTable };
