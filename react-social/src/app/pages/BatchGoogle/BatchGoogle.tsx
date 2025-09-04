import { useFormik } from "formik";
import { useEffect, useState } from "react";
import Select from "react-select";
import { ReadBranchByIdData, ReadBranchData } from "./BatchGoogle_API";
const BatchGoogle = () => {
  var initialValues: any = {
    branch: "",
  };
  const [options, setoptions] = useState([]);
  const [data, setdata] = useState([]);
  useEffect(() => {
    try {
      ReadBranchData().then((data) => {
        setoptions(data.data);
      });
    } catch (error) {
      console.error(error);
      window.location.replace("/error");
    }
  }, []);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    // validationSchema: serchSchema,

    onSubmit: (values, { setStatus, setSubmitting }) => {
      try {
        ReadBranchByIdData(values.branch).then((data) => {
          setdata(data.data);
        });
      } catch (error) {
        console.error(error);
        window.location.replace("/error");
      }

      formik.resetForm();
    },
  });
  const optionBatch = options.map((data: any) => {
    return { value: data.branchId, label: data.abbreviation };
  });
  return (
    <div>
      <div className="text border-0 mt-5 mb-3 pt-5">
        <h3
          className="card-title align-items-center flex-column"
          style={{ margin: "0px auto" }}
        >
          <span
            className="card-label fw-bolder m-3"
            style={{ fontSize: "2vmax" }}
          >
            <strong>Batch</strong>
          </span>
        </h3>
      </div>

      <form
        id="form1"
        style={{ color: "rgb(126, 30, 30)" }}
        className="form fv-plugins-bootstrap5 fv-plugins-framework"
        onSubmit={formik.handleSubmit}
      >
        <div className="row center mb-10 mt-0">
          {/* <input
              placeholder="Name"
              type="text"

              autoComplete="off"
              {...formik.getFieldProps("searchname")}
              className={clsx(
                "form-control form-control-lg form-control-solid",
                {
                  "is-invalid text-danger":
                    formik.touched.searchname && formik.errors.searchname,
                },
                {
                  "is-valid":
                    formik.touched.searchname && !formik.errors.searchname,
                }
              )}
            /> */}

          <Select
            closeMenuOnSelect={true}
            options={optionBatch}
            placeholder="Batch"
            loadingMessage={() => "Fetching Branches"}
            noOptionsMessage={() => "No Branch Available"}
            onChange={(data: any) => {
              formik.setFieldValue("branch", data.label);
            }}
          />
        </div>

        <div className="text-center">
          <button
            type="submit"
            id="kt_sign_up_submit"
            className="btn btn-sm btn-primary btn-active-light-secoundary"
            disabled={formik.isSubmitting || !formik.isValid}
          >
            {<span className="indicator-label">Submit</span>}
          </button>
        </div>
      </form>
      {data.map((data: any) => (
        <>
          <div className="row mb-10">
            <div className="col-sm mb-4 ">{data.email}</div>
            {/* <Button onClick={() => {
                                resetpassword(data).then(() => { console.log("Password Changed") })
                                // console.log(data)
                            }} style={{ width: "200px", height: "40px" }}> Reset Password</Button> */}
            <div className="w-100"></div>
          </div>
        </>
      ))}
    </div>
  );
};
export default BatchGoogle;
