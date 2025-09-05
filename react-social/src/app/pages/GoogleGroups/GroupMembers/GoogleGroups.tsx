import React, { Suspense } from "react";
import Select from "react-select";
import { useEffect, useState } from "react";
import { GetGroupNameData, GetGroupMembersData } from "../API/GoogleGroup_APIs";
import GoogleGroupsdata from "./GoogleGroupsdata";
import _ from "underscore";
import {
  LayoutSplashScreen,
  MetronicSplashScreenProvider,
} from "../../../../_metronic/layout/core";

const GoogleGroups = () => {
  const [groupData, setGroupData] = useState([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [memberData, setMemberData] = useState([]);
  const [groupNameData, setGroupNameData] = useState("");
  useEffect(() => {
    try {
      GetGroupNameData().then((data) => {
        setGroupData(data.data);
      });
    } catch (error) {
      console.error(error);
      window.location.replace("/error");
    }
  }, []);

  const optionsGroup = groupData.map((data: any) => {
    return { label: data, value: data };
  });

  if (loading) {
    return <LayoutSplashScreen visible={true} />;
  }
  return (
    <div className="container">
      <div className="text-center border-0 mt-5 mb-3 pt-5">
        <h3
          className="card-title align-items-center flex-column"
          style={{ margin: "0px auto" }}
        >
          <span
            className="card-label fw-bolder m-3"
            style={{ fontSize: "2vmax" }}
          >
            <strong>Student Detail</strong>
          </span>
        </h3>
      </div>

      <div className="text-center row center mb-10 mt-10">
        {!(groupData.length == 0) && (
          <Select
            closeMenuOnSelect={true}
            options={optionsGroup}
            placeholder="Groups"
            isOptionDisabled={(option: any) => option.disabled}
            noOptionsMessage={() => "No Groups Available"}
            onChange={(data: any) => {
              setLoading(true);
              setGroupNameData(data.value);
              GetGroupMembersData(data.value)
                .then((data) => {
                  setMemberData(data.data);
                  setLoading(false);
                })
                .finally(() => {
                  setLoading(false);
                });
            }}
          />
        )}
        <p>{!_.isEmpty(memberData)}</p>
      </div>
      {!_.isEmpty(memberData) && (
        <div>
          <GoogleGroupsdata
            groupNameData={groupNameData}
            memberData={memberData}
          />
        </div>
      )}
    </div>
  );
};
export default GoogleGroups;
