import clsx from "clsx";
import { Tab, TabList, TabPanel, Tabs } from "react-tabs";
import DeleteFile from "./Delete";
import StudnetDocumentsUpload from "./StudnetDocumentsUpload";
import "./tabs.css";
const API_URL = process.env.REACT_APP_API_URL;

const Img_URL = API_URL + "/util/file-get/getbyname/";

const VerticalTabs = (props: {
  fileData: any;
  fileUserData: any;
  fileUserDataSet: any;
  setSubmitting: any;
  errors: any;
  isregistrar: any;
}) => {
  return (
    <>
      <Tabs style={{ borderRadius: "8px" }}>
        <TabList style={{ overflowY: "auto", borderRadius: "8px" }}>
          {props.fileData.map((data: any, index: any) =>
            data.required ? (
              <Tab
                key={index}
                className={clsx(
                  "text-dark",
                  {
                    "is-invalid text-danger": props.errors?.[data.variable],
                  },
                  {
                    "is-valid": !props.errors?.[data.variable],
                  }
                )}
              >
                <p key={index} className={props.errors?.[data.variable]}>
                  {props.errors?.[data.variable]}
                  {data.name}
                  {data.required ? "*" : ""}
                </p>
              </Tab>
            ) : (
              <></>
            )
          )}
        </TabList>
        {props.fileData.map((data: any, index: any) =>
          data.required ? (
            <TabPanel key={index}>
              {props.fileUserData[data.variable] ? (
                <div key={index} className="panel-content">
                  <img
                    src={
                      Img_URL +
                      props.fileUserData[data.variable]
                    }
                    width="25%"
                    height="25%"
                    alt=""
                  />
                  <p className="text-primary">
                    {props.fileUserData[data.variable]}{" "}
                  </p>
                  <DeleteFile
                    filetodelete={{
                      filename: props.fileUserData[data.variable],
                      variable: data.variable,
                    }}
                    fileUserDataSet={(data) => {
                      //  updatefileDeleteStudent(data.variable)
                      props.fileUserDataSet(data, "");
                    }}
                  />
                </div>
              ) : (
                <div key={index} className="container">
                  <div className="h-100">
                    <div className="h-100 flex align-items-center justify-content-center">
                      <div className="fv-row fv-plugins-icon-container">
                        <StudnetDocumentsUpload
                          Filedata={data}
                          filesize={data.filesize}
                          filetypeValidation={data.type}
                          formData={(data: {
                            variable: string;
                            value: any;
                          }) => {
                            props.fileUserDataSet(data.variable, data.value);
                          }}
                          isSubmitting={(data: boolean) => {
                            props.setSubmitting(data);
                          }}
                        />
                        {props.errors?.[data.variable] ? (
                          <span className="">
                            <>{props.errors?.[data.variable]}</>
                          </span>
                        ) : (
                          ""
                        )}
                      </div>

                      {props.isregistrar && (
                        <>
                          <div
                            className="text-danger m-3"
                            style={{ marginLeft: "10px", marginTop: "5px" }}
                          >
                            Uploading File should be of Maximum {data.filesize}{" "}
                            kB size and of {data.type} type
                          </div>

                          <div className="d-flex">
                            <div>
                              <input
                                className="form-check-input mt-2"
                                type="checkbox"
                                style={{
                                  borderColor: "black",
                                  width: "16px",
                                  height: "16px",
                                  borderRadius: "4px",
                                }}
                                onChange={(data1: any) => {
                                  data1.target.checked
                                    ? props.fileUserDataSet(
                                        "check." + data.variable,
                                        true
                                      )
                                    : props.fileUserDataSet(
                                        "check." + data.variable,
                                        false
                                      );
                                }}
                                checked={
                                  props.fileUserData.check != null
                                    ? props.fileUserData.check[data.variable]
                                    : false
                                }
                              />
                            </div>
                            <div
                              className="text-danger"
                              style={{ marginLeft: "10px", marginTop: "5px" }}
                            >
                              Is the Document Correct ?
                            </div>
                          </div>
                          <div className="d-flex">
                            <div>
                              <input
                                className="form-check-input mt-2"
                                type="checkbox"
                                style={{
                                  borderColor: "black",
                                  width: "16px",
                                  height: "16px",
                                  borderRadius: "4px",
                                }}
                                onChange={(data1: any) => {
                                  data1.target.checked
                                    ? props.fileUserDataSet(
                                        data.physicalVariable,
                                        true
                                      )
                                    : props.fileUserDataSet(
                                        data.physicalVariable,
                                        false
                                      );
                                }}
                                checked={
                                  props.fileUserData[data.physicalVariable] == 1
                                    ? true
                                    : false
                                }
                              />
                            </div>
                            <div
                              className="text-danger"
                              style={{ marginLeft: "10px", marginTop: "5px" }}
                            >
                              Have you received physical document ?
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </TabPanel>
          ) : (
            <></>
          )
        )}
      </Tabs>
    </>
  );
};

export default VerticalTabs;
