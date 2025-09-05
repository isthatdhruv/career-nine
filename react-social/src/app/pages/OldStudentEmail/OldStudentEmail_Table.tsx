import { Button } from "react-bootstrap";
import { resetpassword } from "./OldStudentEmail_API";

const EmaillistTable = (props: { email: any; name: any }) => {
  return (
    <>
      <div className="container mt-20">
        {props.email.map((data: any) => (
          <>
            <div className="row mb-10">
              <div className="col-sm mb-4 ">{data}</div>
              <Button
                onClick={() => {
                  resetpassword(data).then(() => {
                    window.location.reload();
                  });
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
      </div>
    </>
  );
};

export default EmaillistTable;
