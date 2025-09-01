import { useFormik } from "formik";
import { useEffect, useState } from "react";
import { Modal } from "react-bootstrap-v5";
import Select from "react-select";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import { getDataFor, setDataFor } from "../GoogleGroups/API/GoogleGroup_APIs";

const GroupEditModal = (props: {
  show: Boolean;
  onHide: any;
  data: any;
  setpageloading: any;
}) => {
  var t = props.data.googleGroupMappingData
    ? props.data.googleGroupMappingData.typeOfGroup
    : "";
  const [loading, setLoading] = useState(false);
  const [loadingFt, setLoadingFt] = useState(false);
  const [option, setOption] = useState([{ value: "", label: "Loading" }]);
  const [type, setType] = useState(t);
  var forignKeys = props.data.googleGroupMappingData
    ? props.data.googleGroupMappingData.forignKeys
    : "";
  var initialValues: any = {
    id: "",
    name: props.data.groupName,
  };

  var SessioninitialValues: any = {
    instituteSessionId: "",
    name: props.data,
  };

  var CourseinitialValues: any = {
    instituteCourseId: "",
    name: props.data,
  };

  var BatchinitialValues: any = {
    instituteBatchId: "",
    name: props.data,
  };

  var SectioninitialValues: any = {
    sectionId: "",
    name: props.data,
  };

  var BranchinitialValues: any = {
    instituteBranchId: "",
    name: props.data,
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    onSubmit: (values) => {
      if (type == "Session") {
        SessioninitialValues.instituteSessionId = values.id;

        try {
          setDataFor(type, SessioninitialValues)?.then(() => {
            props.onHide(false);
            props.setpageloading(["true"]);
          });
        } catch (error) {
          console.error(error);
          window.location.replace("/error");
        }
      }

      if (type == "Course") {
        CourseinitialValues.instituteCourseId = values.id;

        try {
          setDataFor(type, CourseinitialValues)?.then(() => {
            props.onHide(false);
            props.setpageloading(["true"]);
          });
        } catch (error) {
          console.error(error);
          window.location.replace("/error");
        }
      }

      if (type == "Batch") {
        BatchinitialValues.instituteBatchId = values.id;

        try {
          setDataFor(type, BatchinitialValues)?.then(() => {
            props.onHide(false);
            props.setpageloading(["true"]);
          });
        } catch (error) {
          console.error(error);
          window.location.replace("/error");
        }
      }

      if (type == "Section") {
        SectioninitialValues.sectionId = values.id;

        try {
          setDataFor(type, SectioninitialValues)?.then(() => {
            props.onHide(false);
            props.setpageloading(["true"]);
          });
        } catch (error) {
          console.error(error);
          window.location.replace("/error");
        }
      }

      if (type == "Branch") {
        SectioninitialValues.instituteBranchId = values.id;

        try {
          setDataFor(type, BranchinitialValues)?.then(() => {
            props.onHide(false);
            props.setpageloading(["true"]);
          });
        } catch (error) {
          console.error(error);
          window.location.replace("/error");
        }
      }

      setLoading(true);
    },
  });

  const options = [
    { value: "Session", label: "Session" },
    { value: "Course", label: "Course" },
    { value: "Batch", label: "Batch" },
    { value: "Section", label: "Section" },
    { value: "Branch", label: "Branch" },
  ];
  useEffect(() => {
    setLoading(true);
    getDataFor(type)?.then((data) => {
      if (type == "Course") {
        const CourseOptions: any = data.data.map((data: any) => {
          return { label: data.courseName, value: data.courseCode };
        });
        setOption(CourseOptions);
      } else if (type == "Session") {
        const SessionOptions = data.data.map((data: any) => {
          return { label: data.sessionEndDate, value: data.sessionId };
        });
        setOption(SessionOptions);
      } else if (type == "Batch") {
        const BatchOptions = data.data.map((data: any) => {
          if (data.instituteBranchIdDetails.length > 0)
            return {
              label:
                (data.instituteBranchIdDetails[0].abbreviation
                  ? data.instituteBranchIdDetails[0].abbreviation
                  : "") +
                "-" +
                data.batchStart +
                "-" +
                data.batchEnd,
              value: data.batchId,
            };
          else {
            return { label: "", value: "" };
          }
        });
        setOption(BatchOptions);
      } else if (type == "Section") {
        const SectionOptions = data.data.map((data: any) => {
          return { label: data.name, value: data.id };
        });
        setOption(SectionOptions);
      } else if (type == "Branch") {
        // const BranchOptions = data.data.map((data: any) => {
        //   return { label: data.name, value: data.branchId };
        // });
        // setOption(BranchOptions);
      }
      setLoading(false);
    });
  }, [type]);

  return (
    <Modal {...props} aria-labelledby="contained-modal-title-vcenter" centered>
      <Modal.Header>
        <Modal.Title>
          <h3>Edit {props.data.groupName} Group</h3>
        </Modal.Title>
        <div
          className="btn btn-sm btn-icon btn-active-color-primary"
          onClick={props.onHide}
        >
          <UseAnimations
            animation={menu2}
            size={28}
            strokeColor={"#181C32"}
            reverse={true}
          />
        </div>
      </Modal.Header>
      <form
        className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework"
        onSubmit={formik.handleSubmit}
      >
        <Modal.Body>
          <div className="modal-body">
            <div
              className="scroll-y me-n7 pe-7"
              id="kt_modal_add_scroll"
              data-kt-scroll="true"
              data-kt-scroll-activate="{default: false, lg: true}"
              data-kt-scroll-max-height="auto"
              data-kt-scroll-dependencies="#kt_modal_add_header"
              data-kt-scroll-wrappers="#kt_modal_add_scroll"
              data-kt-scroll-offset="300px"
            >
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">Type :</label>

                <Select
                  defaultValue={{
                    label: props.data.googleGroupMappingData
                      ? props.data.googleGroupMappingData.typeOfGroup
                      : "",
                    value: props.data.googleGroupMappingData
                      ? props.data.googleGroupMappingData.typeOfGroup
                      : "",
                  }}
                  options={options}
                  onChange={(data: any) => {
                    setType(data.value);
                    setLoadingFt(true);
                  }}
                />
              </div>

              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">
                  Select {type}:
                </label>

                {loadingFt && loading && (
                  <span
                    className="indicator-progress m-5"
                    style={{ display: "block" }}
                  >
                    Please wait...{" "}
                    <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
                  </span>
                )}

                {loadingFt && !loading && (
                  <Select
                    defaultInputValue={forignKeys}
                    options={option}
                    onChange={(data: any) => {
                      formik.setFieldValue("id", data.value);
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            className="btn btn-sm btn-light btn-active-light-secoundary"
            onClick={props.onHide}
          >
            Close
          </button>
          <button
            type="submit"
            id="kt_sign_up_submit"
            className="btn btn-sm btn-primary btn-active-light-secoundary"
            disabled={formik.isSubmitting || !formik.isValid}
          >
            {!loading && <span className="indicator-label">Submit</span>}
            {loading && (
              <span className="indicator-progress" style={{ display: "block" }}>
                Please wait...{" "}
                <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
              </span>
            )}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  );
};

export default GroupEditModal;
