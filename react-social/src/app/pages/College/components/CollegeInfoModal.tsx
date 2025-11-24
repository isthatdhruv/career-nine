// CollegeInfoModal.tsx
import React, { useEffect, useState } from "react";
import { Modal } from "react-bootstrap-v5";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import { UpdateCollegeData } from "../API/College_APIs";

type ContactPerson = {
  id?: string; // optional, if your DB returns an id
  name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  designation?: string;
};

type CollegeDataForModal = {
  instituteCode?: string;
  contactPersons?: ContactPerson[];
  // keep it open so you can pass anything else UpdateCollegeData needs
  [key: string]: any;
};

type Props = {
  show: boolean;
  onHide: (v?: boolean) => void;
  setPageLoading: (v: any) => void;
  data?: CollegeDataForModal; 
};

const CollegeInfoModal = (props: Props) => {
  const [loading, setLoading] = useState(false);
  const [availableContacts, setAvailableContacts] = useState<ContactPerson[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);

  useEffect(() => {
    if (!props.show) return;

    const rawContacts = props.data?.contactPersons ?? [];

    const contacts = rawContacts.filter(
      (c) => c && (c.name || c.email || c.phone || c.designation)
    );

    setAvailableContacts(contacts);

    setSelectedIndexes([]);
  }, [props.show, props.data]);

  const toggleSelection = (index: number) => {
    setSelectedIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const isSelected = (index: number) => selectedIndexes.includes(index);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!props.data) {
      props.onHide();
      return;
    }

    const selectedContacts = selectedIndexes.map((i) => availableContacts[i]);

    setLoading(true);
    try {
      const payload = {
        ...props.data,
        contactPersons: selectedContacts,
      };

      await UpdateCollegeData(payload);
      props.setPageLoading(["true"]);
      props.onHide(false);
    } catch (error) {
      console.error("UpdateCollegeData failed", error);
      window.location.replace("/error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      show={props.show}
      onHide={() => props.onHide()}
      centered
      className="college-modal"
      aria-labelledby="college-info-modal-title"
    >
      <Modal.Header>
        <Modal.Title id="college-info-modal-title">
          <h3 className="mb-0">Select Contact Person(s)</h3>
        </Modal.Title>

        <div
          className="btn btn-sm btn-icon btn-active-color-primary"
          onClick={() => props.onHide()}
          style={{ cursor: "pointer" }}
        >
          <UseAnimations animation={menu2} size={28} strokeColor={"#181C32"} reverse />
        </div>
      </Modal.Header>

      <form onSubmit={handleSubmit} className="form w-100">
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
              {availableContacts.length === 0 ? (
                <div className="text-muted">
                  No contact persons found .
                </div>
              ) : (
                <div className="fv-row mb-3">
                  <label className="fs-6 fw-bold mb-2">
                    Contact Person Information (select one or more):
                  </label>

                  <div className="list-group">
                    {availableContacts.map((person, index) => (
                      <label
                        key={person.id ?? `${person.email}-${index}`}
                        className="list-group-item d-flex align-items-start"
                        style={{ cursor: "pointer" }}
                      >
                        <input
                          type="checkbox"
                          className="form-check-input me-3 mt-1"
                          checked={isSelected(index)}
                          onChange={() => toggleSelection(index)}
                        />
                        <div>
                          <div className="fw-bold">
                            {person.name || "Unnamed Contact"}
                          </div>
                          <div className="text-muted small">
                            {person.email && <span>{person.email}</span>}
                            {person.phone && (
                              <span> {person.email ? " | " : ""}{person.phone}</span>
                            )}
                            {(person.gender || person.designation) && (
                              <span>
                                {" "}
                                {" | "}
                                {[person.gender, person.designation]
                                  .filter(Boolean)
                                  .join(" - ")}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <button
            type="button"
            className="btn btn-sm btn-light me-2"
            onClick={() => props.onHide()}
            disabled={loading}
          >
            Close
          </button>

          <button
            type="submit"
            className="btn btn-sm btn-primary"
            disabled={loading || availableContacts.length === 0}
          >
            {!loading && <span className="indicator-label">Save Selection</span>}
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

export default CollegeInfoModal;
