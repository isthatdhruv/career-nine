import clsx from "clsx";
import { useFormik } from "formik";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import * as Yup from "yup";
import { ReadListByIdData, UpdateListData } from "../API/List_APIs";

const validationSchema = Yup.object().shape({
  listName: Yup.string().required("List name is required"),
  listPrice: Yup.string().required("List type is required"),
  priceAmount: Yup.number()
    .when("listPrice", {
      is: "PAID",
      then: (schema) =>
        schema.required("Please enter the price").positive("Must be positive"),
      otherwise: (schema) => schema.notRequired(),
    }),
});

const ListEditPage = (props?: {
  setPageLoading?: any;
}) => {
  const [loading, setLoading] = useState(false);
  const [listData, setListData] = useState<any>({
    name: "",
    price: "",
    id: "",
    type: "",
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  // Fetch list data when component mounts
  useEffect(() => {
    const fetchData = async () => {
      if (id) {
        try {
          setLoading(true);
          const response = await ReadListByIdData(id);
          console.log("Fetched list data:", response.data);
          const transformedData = {
            id: response.data.list_id || response.data.listId,
            listName: response.data.name || response.data.listName,
            listPrice: response.data.isFree ? "FREE" : "PAID",
            priceAmount: response.data.isFree ? "" : (response.data.price || ""),
            isFree: response.data.isFree
          };
          setListData(transformedData);
        } catch (error) {
          console.error("Error fetching list:", error);
          // Try to get data from location state as fallback
          const locationData = (location.state as any)?.data;
          if (locationData) {
            setListData(locationData);
          }
        } finally {
          setLoading(false);
        }
      } else {
        // Fallback to location state if no ID in URL
        const locationData = (location.state as any)?.data;
        if (locationData) {
          setListData(locationData);
        }
      }
    };

    fetchData();
  }, [id, location.state]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      id: listData.id || id,
      listName: listData.listName || "",
      listPrice: listData.listPrice || "",
      priceAmount: listData.priceAmount || "",
      isFree: listData.isFree || false,
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        console.log("Attempting to update list:");
        console.log("List ID:", values.id);
        console.log("Values being sent:", values);

        if (!values.id) {
          alert("No list ID found. Please try navigating back and selecting the list again.");
          return;
        }

        // Transform the form values to match backend expectations
        const payload = {
          name: values.listName,
          isFree: values.listPrice === "FREE",
          price: values.listPrice === "FREE" ? 0 : Number(values.priceAmount)
        };

        console.log("Payload being sent:", payload);

        const response = await UpdateListData(values.id, payload);
        console.log("Update successful:", response);

        navigate("/lists");

        if (props?.setPageLoading) {
          props.setPageLoading(["true"]);
        }

      } catch (error) {
        console.error("Full error object:", error);
        if (typeof error === "object" && error !== null) {
          console.error("Error response:", (error as any).response);
          console.error("Error message:", (error as any).message);
          console.error("Error status:", (error as any).response?.status);
          console.error("Error data:", (error as any).response?.data);

          const errorMessage = (error as any).response?.data?.message || (error as any).message || "Unknown error occurred";
          alert(`Failed to update list: ${errorMessage}`);
        } else {
          alert("Failed to update list: Unknown error occurred");
        }
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <div className="container py-5">
      <div className="card shadow-sm py-5">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h1 className="mb-0">Edit List</h1>
          <button
            className="btn btn-sm btn-icon btn-active-color-primary"
            onClick={() => navigate(-1)}
            aria-label="Close"
          >
            <UseAnimations
              animation={menu2}
              size={28}
              strokeColor={"#181C32"}
              reverse={true}
            />
          </button>
        </div>

        <form
          className="form w-100 fv-plugins-bootstrap5 fv-plugins-framework"
          onSubmit={formik.handleSubmit}
        >
          <div className="card-body">

            {/* List Name */}
            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">
                List Name:
              </label>
              <input
                type="text"
                placeholder="Enter List Name"
                {...formik.getFieldProps("listName")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.listName && formik.errors.listName,
                  },
                  {
                    "is-valid":
                      formik.touched.listName && !formik.errors.listName,
                  }
                )}
              />
              {formik.touched.listName && formik.errors.listName && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{String(formik.errors.listName)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* List Price Type */}
            <div className="fv-row mb-7">
              <label className="required fs-6 fw-bold mb-2">
                List Type:
              </label>
              <select
                {...formik.getFieldProps("listPrice")}
                className={clsx(
                  "form-control form-control-lg form-control-solid",
                  {
                    "is-invalid text-danger":
                      formik.touched.listPrice && formik.errors.listPrice,
                  },
                  {
                    "is-valid":
                      formik.touched.listPrice && !formik.errors.listPrice,
                  }
                )}
              >
                <option value="">Select List Type</option>
                <option value="FREE">Free</option>
                <option value="PAID">Paid</option>
              </select>
              {formik.touched.listPrice && formik.errors.listPrice && (
                <div className="fv-plugins-message-container">
                  <div className="fv-help-block text-danger">
                    <span role="alert">{String(formik.errors.listPrice)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Price Amount - only shown if PAID */}
            {formik.values.listPrice === "PAID" && (
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">
                  Price Amount:
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Enter Price Amount"
                  {...formik.getFieldProps("priceAmount")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.priceAmount && formik.errors.priceAmount,
                    },
                    {
                      "is-valid":
                        formik.touched.priceAmount && !formik.errors.priceAmount,
                    }
                  )}
                />
                {formik.touched.priceAmount && formik.errors.priceAmount && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">{String(formik.errors.priceAmount)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="card-footer d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-light me-2"
              onClick={() => navigate("/list")}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {!loading && <span className="indicator-label">Update</span>}
              {loading && (
                <span
                  className="indicator-progress"
                  style={{ display: "block" }}
                >
                  Please wait...{" "}
                  <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ListEditPage;
