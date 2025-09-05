import { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
// var _ = require('underscore');
import Select from "react-select";
import { upsertRoleUserData } from "./components/core/roleUser_APIs";

const EmaillistTable = (props: { data: any; name: any; roleGroup: any }) => {
  const [rolesGroup, setRolesGroup] = useState(false);
  const [selectedRoleGroup, setSelectedRoleGroup] = useState([]);
  const [email, setemail] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    var selectRoleGroupOptions = props.data.selectRoleGroupOptions.map(
      (selectRoleGroup) => {
        return selectRoleGroup.value;
      }
    );
    setRolesGroup(selectRoleGroupOptions);
    setSelectedRoleGroup(props.data.selectRoleGroupOptions);
    setLoading(false);
  }, []);

  return (
    <>
      {
        <>
          <div className="row mb-10">
            <div className="col-md-3 mb-4 ">
              {props.data.googleUserData.name.fullName}
            </div>
            <div className="col-md-3 mb-4 ">
              {props.data.googleUserData.primaryEmail}
            </div>
            <div className="col-md-3">
              <div className="col">
                {!loading ? (
                  <Select
                    closeMenuOnSelect={false}
                    defaultValue={props.data.selectRoleGroupOptions}
                    isMulti
                    options={props.roleGroup}
                    placeholder="Assign Role Group"
                    loadingMessage={() => "Fetching Roles"}
                    noOptionsMessage={() => "No Role Available"}
                    onChange={(data: any) => {
                      data = data.map((value: any) => {
                        return value.value;
                      });
                      setRolesGroup(data);
                    }}
                  />
                ) : (
                  <p>Data is loading</p>
                )}
              </div>
            </div>
            <div className="col-md-3 mb-3 text-center">
              <Button
                onClick={() => {
                  upsertRoleUserData(
                    rolesGroup,
                    props.data.googleUserData.primaryEmail
                  ).then((data) => {
                  });
                }}
                style={{ width: "200px", height: "40px" }}
              >
                Update Role
              </Button>
            </div>
          </div>
        </>
      }
    </>
  );
};

export default EmaillistTable;
