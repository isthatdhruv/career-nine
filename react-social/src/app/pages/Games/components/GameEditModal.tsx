import { useState } from "react";
import * as Yup from "yup";
import { UpdateGameTableData } from "./API/GAME_APIs";
import { useFormik } from "formik";
import { Modal } from "react-bootstrap";

const validationSchema = Yup.object().shape({
    gameName: Yup.string().required(),
    gameCode: Yup.number().required(),
  });

const GameEditModal = (props: {
  show: Boolean;
  onHide: any;
  data: any;
  setPageLoading: any;
}) => {
  const [loading, setLoading] = useState(false);

  var initialValues: any = {
    gameName: props.data.gameName,
    gameCode: props.data.gameCode,
    gameId: props.data.gameId,
    display: 1,
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validationSchema: validationSchema,
    onSubmit: (values) => {
      try {
        UpdateGameTableData(values.gameId, values).then(() => {
          props.onHide(false);
          props.setPageLoading(["true"]);
        });
      } catch (error) {
        console.error(error);
        window.location.replace("/error");
      }
      setLoading(true);
    },
  });

  return (
    <Modal
      show={props.show as boolean}
      onHide={() => props.onHide(false)}
      size="lg"
      centered
    >
      <Modal.Header closeButton>
        <Modal.Title>Edit Game</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <form onSubmit={formik.handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Game Name</label>
            <input
              type="text"
              className="form-control"
              {...formik.getFieldProps("gameName")}
            />
            {formik.touched.gameName && formik.errors.gameName && (
              <div className="text-danger">{String(formik.errors.gameName)}</div>
            )}
          </div>
          <div className="mb-3">
            <label className="form-label">Game Code</label>
            <input
              type="number"
              className="form-control"
              {...formik.getFieldProps("gameCode")}
            />
            {formik.touched.gameCode && formik.errors.gameCode && (
              <div className="text-danger">{String(formik.errors.gameCode)}</div>
            )}
          </div>
          <div className="d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-secondary me-2"
              onClick={() => props.onHide(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal.Body>
    </Modal>
  );
};
export default GameEditModal;