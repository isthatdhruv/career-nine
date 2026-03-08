import { useFormik } from "formik";
import * as Yup from "yup";
import { Modal } from "react-bootstrap";
import UseAnimations from "react-useanimations";
import clsx from "clsx";
import menu2 from "react-useanimations/lib/menu2";
import { useState } from "react";
import { AddGamesData } from "./API/GAME_APIs";

const validationSchema = Yup.object().shape({
  gameName: Yup.string().required(),
  gameCode: Yup.number().required(),
});

const GameCreateModal = (props: any) => {
  const [loading, setLoading] = useState(false);

  const formik = useFormik({
    initialValues: {
      gameName: "",
      gameCode: "",
    },
    validationSchema,
    onSubmit: (values) => {
      setLoading(true);
      AddGamesData(values)
        .then(() => {
          props.onHide();
          props.setPageLoading(["true"]);
          formik.resetForm();
        })
        .catch((error) => {
          console.error(error);
        })
        .finally(() => {
          setLoading(false);
        });
    },
  });

  return (
    <Modal {...props} aria-labelledby="contained-modal-title-vcenter" centered>
      <Modal.Header>
        <Modal.Title>
          <h1>Add Game</h1>
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
                <label className="required fs-6 fw-bold mb-2">
                  Game Name :
                </label>

                <input
                  placeholder="Enter Game Name"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("gameName")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.gameName && formik.errors.gameName,
                    },
                    {
                      "is-valid":
                        formik.touched.gameName && !formik.errors.gameName,
                    }
                  )}
                />
                {formik.touched.gameName && formik.errors.gameName && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">Game Name is Required</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="fv-row mb-7">
                <label className="required fs-6 fw-bold mb-2">
                  Game Code :
                </label>

                <input
                  placeholder="Enter Game Code"
                  type="number"
                  autoComplete="off"
                  {...formik.getFieldProps("gameCode")}
                  className={clsx(
                    "form-control form-control-lg form-control-solid",
                    {
                      "is-invalid text-danger":
                        formik.touched.gameCode && formik.errors.gameCode,
                    },
                    {
                      "is-valid":
                        formik.touched.gameCode && !formik.errors.gameCode,
                    }
                  )}
                />
                {formik.touched.gameCode && formik.errors.gameCode && (
                  <div className="fv-plugins-message-container">
                    <div className="fv-help-block text-danger">
                      <span role="alert">Game Code is Required</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            className="btn btn-outline btn-secondary"
            onClick={props.onHide}
          >
            Close
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading && (
              <span className="indicator-progress">
                Please wait...{" "}
                <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
              </span>
            )}
            Save Changes
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  );
};

export default GameCreateModal;