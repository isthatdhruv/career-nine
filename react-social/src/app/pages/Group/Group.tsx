import { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { IconContext } from "react-icons";
import { AiFillEdit } from "react-icons/ai";
import { BiBookReader } from "react-icons/bi";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";

const Group = () => {
  const [loading, setLoading] = useState(false);
  const [groupData, setGroupData] = useState([]);
  const [modalShowCreate, setModalShowCreate] = useState(false);
  const [pageLoading, setPageLoading] = useState(["false"]);
  const [modalShowEdit, setModalShowEdit] = useState(false);
  const [nameData, setNameData] = useState("");

  useEffect(() => {
    setLoading(true);
    try {
      // GetGroupNameData().then((data) => {
      //   setGroupData(data.data);
      //   setLoading(false);
      // });
    } catch (error) {
      console.error(error);
      window.location.replace("/error");
    }
  }, [pageLoading]);

  return (
    <>
      <div className="card">
        {!loading && (
          <div className="card-header border-0 pt-6 pb-8">
            <div className="card-title">
              <h1>Group</h1>
            </div>

            <div className="card-toolbar">
              <div className="d-flex justify-content-end">
                <Button
                  variant="primary"
                  onClick={() => {
                    setModalShowCreate(true);
                  }}
                >
                  <IconContext.Provider
                    value={{ style: { paddingBottom: "4px" } }}
                  >
                    <div>
                      Add Group <BiBookReader size={23} />
                    </div>
                  </IconContext.Provider>
                </Button>
              </div>
            </div>
          </div>
        )}

        {!loading &&
          groupData.map((data: any, index: number) => (
            <div className="card-body pt-5" key={index}>
              <div className="row">
                <div className="col-md-5">
                  <h4>{data.groupName}</h4>
                </div>
                <div className="col-md-3">
                  <h4>{data.googleGroupMappingData.typeOfGroup}</h4>
                </div>
                <div className="col-md-3">
                  <h4>{data.googleGroupMappingData.typeOfGroupName}</h4>
                </div>
                <div className="col-md-1">
                  <div className="row">
                    <button
                      onClick={() => {
                        setNameData(data);
                        setModalShowEdit(true);
                      }}
                      className="btn btn-icon btn-primary me-3"
                    >
                      <AiFillEdit size={22} />
                    </button>
                    <button
                      onClick={() => {
                        setLoading(true);
                        // DeleteGroupData(data).then(() => {
                        //   setPageLoading(["true"]);
                        // });
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
                </div>
              </div>
            </div>
          ))}
      </div>
      {/* <GroupCreateModal
            setPageLoading={setPageLoading}
            show={modalShowCreate}
            onHide={() => setModalShowCreate(false)}
          /> */}
      {/* <GroupEditModal
            show={modalShowEdit}
            onHide={() => setModalShowEdit(false)}
            data={nameData}
            setpageloading={setPageLoading}
          /> */}
    </>
  );
};

export default Group;
