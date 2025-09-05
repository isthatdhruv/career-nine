import { useState } from "react";
import { Button } from "react-bootstrap";
// var _ = require('underscore');
import ForgotpasswordCreateModal from "./ForgotpasswordCreateModal";

const EmaillistTable = (props: { email: any; name: any }) => {
  // var [data2, setData2] = useState();
  // console.log(props.result, "hi")
  // console.log(props.email)

  const [modalShowCreate, setModalShowCreate] = useState(false);
  const [editModalData, setEditModalData] = useState({
    officialEmailAddress: "",
  });

  return (
    <>
      <div className="container mt-20">
        {props.email.map((data: any) => (
          <>
            <div className="row mb-10">
              <div className="col-sm mb-4 ">{data}</div>
              <Button
                onClick={() => {
                  setEditModalData(data);
                  setModalShowCreate(true);
                }}
                style={{ width: "200px", height: "40px" }}
              >
                {" "}
                Reset Password
              </Button>
              <div className="w-100"></div>
            </div>
          </>
        ))}

        <ForgotpasswordCreateModal
          data={editModalData}
          show={modalShowCreate}
          onHide={() => setModalShowCreate(false)}
        />
      </div>
    </>
  );
};

export default EmaillistTable;
