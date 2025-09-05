import clsx from "clsx";
import { useState ,useCallback} from "react";
import FileBase64 from "react-file-base64";
import { fileUpload } from "./Student_APIs";
import ImgsViewer from "react-images-viewer";






const StudnetDocumentsUpload = (props: {
  
  Filedata: any;
  formData: any;
  isSubmitting: any;
  filesize:any;
  filetypeValidation:any;
}) => {
  const [qualifiedRankLetter, setQualifiedRankLetter] = useState({
    isuploading: false,
    isError: false,
    uploaded: false,
  });

  function fileValidation(data) {
    var s = data.size.split(" kB");
    var re = new RegExp(props.filetypeValidation);
    var f = parseInt(s[0]);
    if (f >= props.filesize) {
      return false;
    } else {
      if (
        re.test(data.type)
      ) {
        return true;
      } else {
        return false;
      }
    }
  }

  function uploadFileData(data, feildStateSet) {
    
    feildStateSet({
      isuploading: true,
      isError: false,
      uploaded: false,
    });

    props.isSubmitting(true);
    if (fileValidation(data)) {
      fileUpload({
        data: data.base64.split("base64,")[1],
        fileName: "",
        type: data.type,
      }).then((res) => {
        if (res.status === 200) {

          
          props.isSubmitting(false);
          props.formData({
            
            value: res.data,
            variable: props.Filedata.variable,
            
          });
          feildStateSet({
            
            isuploading: false,
            isError: false,
            uploaded: true,
          });
        } else {
          props.isSubmitting(false);
          feildStateSet({
            isuploading: false,
            isError: true,
            uploaded: false,
          });
        }
      });
    } else {
      props.isSubmitting(false);
      feildStateSet({
        isuploading: false,
        isError: true,
        uploaded: false,
      });
    }
  }
  return (
    <>
      <style>{`.loader {
  border: 16px solid #f3f3f3; /* Light grey */
  border-top: 16px solid #3498db; /* Blue */
  border-radius: 50%;
  width: 120px;
  height: 120px;
  animation: spin 2s linear infinite;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}`}</style>

      <label className="fs-6 fw-bold mb-2">
        <strong>{props.Filedata.name}</strong>
      </label>
      <div
        className={clsx(
          "form-control form-control-lg form-control-solid d-flex",
          {
            "is-invalid text-danger": qualifiedRankLetter.isError,
          },
          {
            "is-valid": qualifiedRankLetter.uploaded,
          }
        )}
      >
        <FileBase64
          multiple={false}
          onDone={(data) => {
            uploadFileData(data, setQualifiedRankLetter);
            console.log(data)
          }}
        />
        
        <div>
  
     
    </div>
        <div
          className={clsx({
            "spinner-grow": qualifiedRankLetter.isuploading,
          })}
        >
          <span
            className={clsx({
              "sr-only": qualifiedRankLetter.isuploading,
            })}
          >
            {qualifiedRankLetter.isuploading ? "Loading..." : ""}
          </span>
        </div>
      </div>

      {qualifiedRankLetter.isError ? (
        <div className="error-message">
          {" "}
          The File must be less than 3MB and format of file could be PDF or
          image.
        </div>
      ) : (
        ""
      )}
    </>
  );
};

export default StudnetDocumentsUpload;