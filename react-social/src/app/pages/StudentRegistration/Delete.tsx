import { Button } from "react-bootstrap";
import { fileDelete } from "./Student_APIs";

const DeleteFile = (props: { filetodelete: any; fileUserDataSet: any }) => {
  return (
    <div>
      <Button
        variant="outline-danger"
        onClick={() => {
          fileDelete(props.filetodelete.variable);

          props.fileUserDataSet(props.filetodelete.variable);
        }}
      >
        Delete
      </Button>{" "}
    </div>
  );
};

export default DeleteFile;
