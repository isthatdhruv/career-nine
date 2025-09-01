import { useEffect, useState } from "react";
import { GetGroupMembersDelete } from "../API/GoogleGroup_APIs";

import { Button } from "react-bootstrap";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";

const GoogleGroupsdata = (props: { groupNameData: any; memberData: any }) => {
  const [loading, setLoading] = useState(false);

  return (
    <>
      {loading && (
        <span className="indicator-progress m-5" style={{ display: "block" }}>
          Please wait...{" "}
          <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
        </span>
      )}

      {!loading &&
        props.memberData.map((data: any) => (
          <>
            <div className="row mb-10">
              <div className="col-sm mb-4 ">
                <h5>{data}</h5>
              </div>
              <div className="col-sm mb-4 ">
                <h5>Name</h5>
              </div>
              {/* <Button onClick={() => {
                                GetGroupMembersDelete(props.groupNameData, data).then(() => {
                                    setLoading(true)
                                    window.location.reload();
                                });
                            }} style={{ width: "200px", height: "40px" }}>Delete Member</Button> */}
              <button
                onClick={() => {
                  GetGroupMembersDelete(props.groupNameData, data).then(() => {
                    setLoading(true);
                    window.location.reload();
                  });
                }}
                className="btn btn-icon btn-danger"
              >
                <UseAnimations
                  animation={trash}
                  size={22}
                  strokeColor={"#EFF8FE"}
                />
              </button>
            </div>
          </>
        ))}
    </>
  );
};

export default GoogleGroupsdata;
