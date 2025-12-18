// CollegeInfoModal.tsx
import React, { useEffect, useState } from "react";
import { Modal } from "react-bootstrap-v5";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import { UpdateCollegeData } from "../API/College_APIs";
import { ReadBoardData } from "../../Board/API/Board_APIs";
import { ReadContactInformationData } from "../../ContactPerson/API/Contact_Person_APIs";

type ContactPerson = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  designation?: string;
};

type Board = {
  id?: string | number;
  boardName?: string;
  name?: string;
  [key: string]: any;
};

type CollegeDataForModal = {
  instituteCode?: string;
  contactPersons?: ContactPerson[];
  maxClass?: number | string;
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
  const [selectedContactIndexes, setSelectedContactIndexes] = useState<number[]>([]);
  const [contactDropdownOpen, setContactDropdownOpen] = useState(false);

  const [availableBoards, setAvailableBoards] = useState<Board[]>([]);
  const [selectedBoardIndexes, setSelectedBoardIndexes] = useState<number[]>([]);
  const [boardDropdownOpen, setBoardDropdownOpen] = useState(false);

  // 🔹 Step 3: max class state
  const [maxClass, setMaxClass] = useState<number | null>(null);

  useEffect(() => {
    if (!props.show) return;

    // ✅ Fetch ALL contact persons from API
    const fetchContacts = async () => {
      try {
        const res = await ReadContactInformationData();
        const rawContacts: any[] =
          (res as any)?.data?.data ??
          (res as any)?.data?.contacts ??
          (res as any)?.data ??
          [];

        const contacts: ContactPerson[] = rawContacts.filter(
          (c) => c && (c.name || c.email || c.phone || c.designation)
        );

        setAvailableContacts(contacts);

        // ✅ Pre-select contacts already mapped to this institute
        const instituteContacts = props.data?.contactPersons ?? [];
        const preSelected: number[] = [];

        contacts.forEach((contact, index) => {
          const match = instituteContacts.find(
            (ic) =>
              (ic.id && contact.id && ic.id === contact.id) ||
              (ic.email && contact.email && ic.email === contact.email)
          );
          if (match) {
            preSelected.push(index);
          }
        });

        setSelectedContactIndexes(preSelected);
      } catch (err) {
        console.error("Failed to load contacts:", err);
        setAvailableContacts([]);
        setSelectedContactIndexes([]);
      }
    };

    // ✅ BOARDS FROM API
    const fetchBoards = async () => {
      try {
        const res = await ReadBoardData();
        const rawBoards: any[] =
          (res as any)?.data?.data ??
          (res as any)?.data?.boards ??
          (res as any)?.data ??
          [];

        const boards: Board[] = rawBoards.filter(
          (b) =>
            b &&
            (typeof b.boardName === "string" ||
              typeof b.name === "string" ||
              typeof b.id !== "undefined")
        );
        setAvailableBoards(boards);
        setSelectedBoardIndexes([]);
      } catch (err) {
        console.error("Failed to load boards:", err);
        setAvailableBoards([]);
      }
    };

    fetchContacts();
    fetchBoards();

    // 🔹 Initialize maxClass from props (if present)
    if (props.data?.maxClass !== undefined && props.data?.maxClass !== null) {
      const num = Number(props.data.maxClass);
      if (!isNaN(num) && num >= 1 && num <= 12) {
        setMaxClass(num);
      } else {
        setMaxClass(null);
      }
    } else {
      setMaxClass(null);
    }
  }, [props.show, props.data]);

  const toggleContactSelection = (index: number) => {
    setSelectedContactIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const isContactSelected = (index: number) => selectedContactIndexes.includes(index);

  const toggleBoardSelection = (index: number) => {
    setSelectedBoardIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const isBoardSelected = (index: number) => selectedBoardIndexes.includes(index);

  const handleMaxClassChange = (value: string) => {
    if (value === "") {
      setMaxClass(null);
      return;
    }
    let num = Number(value);
    if (isNaN(num)) return;
    if (num < 1) num = 1;
    if (num > 12) num = 12;
    setMaxClass(num);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!props.data) {
      props.onHide();
      return;
    }

    const selectedContacts = selectedContactIndexes.map((i) => availableContacts[i]);
    const selectedBoards = selectedBoardIndexes.map((i) => availableBoards[i]);

    setLoading(true);
    try {
      const payload: any = {
        ...props.data,
        contactPersons: selectedContacts,
      };

      if (selectedBoards.length > 0) {
        payload.boards = selectedBoards;
      }

      // 🔹 include maxClass if selected
      if (maxClass !== null) {
        payload.maxClass = maxClass;
      }

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

  const getBoardLabel = (board: Board) =>
    board.boardName ?? board.name ?? (board.id !== undefined ? String(board.id) : "Board");

  const selectedContactList = selectedContactIndexes.map((i) => availableContacts[i]);
  const selectedBoardList = selectedBoardIndexes.map((i) => availableBoards[i]);

  // 🔐 Step 2 should only be usable after Step 1 has at least one selection
  const isStep2Enabled = selectedContactIndexes.length > 0;

  return (
    <Modal
      show={props.show}
      onHide={() => props.onHide()}
      centered
      className="college-modal"
      aria-labelledby="college-info-modal-title"
    >
      <Modal.Header className="border-0 pb-0">
        <div className="d-flex flex-column">
          <h3 id="college-info-modal-title" className="mb-1 fw-bold">
            Map Board &amp; Contact Person(s)
          </h3>
          <span className="text-muted small">
            Link the institute with appropriate contact person(s), board(s) and max class.
          </span>
        </div>

        <div
          className="btn btn-sm btn-icon btn-light ms-3"
          onClick={() => props.onHide()}
          style={{ cursor: "pointer" }}
        >
          <UseAnimations animation={menu2} size={24} strokeColor={"#181C32"} reverse />
        </div>
      </Modal.Header>

      <form onSubmit={handleSubmit} className="form w-100">
        <Modal.Body className="pt-3">
          <div className="d-flex flex-column gap-4">
            {/* ====== STEP 1: CONTACT PERSONS ====== */}
            <div className="card shadow-sm border-0">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div>
                    <div className="badge bg-light text-dark mb-1">Step 1</div>
                    <h5 className="mb-0">Select Contact Person(s)</h5>
                    <small className="text-muted">
                      Choose one or more contact persons associated with this institute.
                    </small>
                  </div>
                  {availableContacts.length > 0 && (
                    <span className="badge bg-success-subtle text-success">
                      {selectedContactIndexes.length} selected
                    </span>
                  )}
                </div>

                <div className="mb-3">
                  <button
                    type="button"
                    className="btn btn-outline-success dropdown-toggle d-flex align-items-center px-3 py-2"
                    onClick={() => setContactDropdownOpen((o) => !o)}
                  >
                    <span className="me-2">👤</span>
                    <span>
                      {selectedContactIndexes.length > 0
                        ? "Edit selected contact person(s)"
                        : "Select contact person(s)"}
                    </span>
                  </button>

                  <div
                    className={`dropdown-menu mt-2 shadow-sm border-0 ${
                      contactDropdownOpen ? "show" : ""
                    }`}
                    style={{
                      maxHeight: "260px",
                      overflowY: "auto",
                      minWidth: "320px",
                    }}
                  >
                    {availableContacts.length === 0 ? (
                      <span className="dropdown-item-text text-muted fst-italic">
                        No contact persons found.
                      </span>
                    ) : (
                      availableContacts.map((person, index) => {
                        const initials =
                          (person.name || "")
                            .split(" ")
                            .map((p) => p[0])
                            .join("")
                            .toUpperCase() || "?";

                        return (
                          <label
                            key={person.id ?? `${person.email}-${index}`}
                            className="dropdown-item d-flex align-items-start py-2"
                            style={{ cursor: "pointer" }}
                          >
                            <input
                              type="checkbox"
                              className="form-check-input me-3 mt-1"
                              checked={isContactSelected(index)}
                              onChange={() => toggleContactSelection(index)}
                            />
                            <div className="d-flex align-items-start w-100">
                              <div
                                className="rounded-circle d-flex align-items-center justify-content-center me-3"
                                style={{
                                  width: 32,
                                  height: 32,
                                  background: "#eef3ff",
                                  fontSize: 13,
                                  fontWeight: 600,
                                }}
                              >
                                {initials}
                              </div>
                              <div>
                                <div className="fw-semibold">
                                  {person.name || "Unnamed Contact"}
                                </div>
                                <div className="text-muted small">
                                  {person.email && <span>{person.email}</span>}
                                  {person.phone && (
                                    <span>
                                      {" "}
                                      {person.email ? " • " : ""}
                                      {person.phone}
                                    </span>
                                  )}
                                </div>
                                {(person.gender || person.designation) && (
                                  <div className="small text-muted">
                                    {[person.gender, person.designation]
                                      .filter(Boolean)
                                      .join(" • ")}
                                  </div>
                                )}
                              </div>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {selectedContactList.length > 0 && (
                  <div>
                    <div className="text-muted small mb-1">Selected contact(s):</div>
                    <div className="d-flex flex-wrap gap-2">
                      {selectedContactList.map((person, idx) => (
                        <span
                          key={person.id ?? `${person.email}-chip-${idx}`}
                          className="badge bg-light text-dark border"
                        >
                          {person.name || "Unnamed Contact"}
                          {person.designation && (
                            <span className="text-muted ms-1 small">
                              ({person.designation})
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ====== STEP 2: BOARDS ====== */}
            <div
              className={`card shadow-sm border-0 ${
                !isStep2Enabled ? "opacity-75" : ""
              }`}
            >
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div>
                    <div className="badge bg-light text-dark mb-1">Step 2</div>
                    <h5 className="mb-0">Select Board(s)</h5>
                    <small className="text-muted">
                      Map this institute to one or more education boards.
                      {!isStep2Enabled && (
                        <span className="text-danger ms-1">
                          (Select at least one contact person in Step 1 first)
                        </span>
                      )}
                    </small>
                  </div>
                  {availableBoards.length > 0 && isStep2Enabled && (
                    <span className="badge bg-primary-subtle text-primary">
                      {selectedBoardIndexes.length} selected
                    </span>
                  )}
                </div>

                <div className="mb-3">
                  <button
                    type="button"
                    className="btn btn-outline-primary dropdown-toggle d-flex align-items-center px-3 py-2"
                    onClick={() => {
                      if (!isStep2Enabled) return;
                      setBoardDropdownOpen((o) => !o);
                    }}
                    disabled={!isStep2Enabled}
                  >
                    <span className="me-2">📋</span>
                    <span>
                      {selectedBoardIndexes.length > 0
                        ? "Edit selected board(s)"
                        : "Select board(s)"}
                    </span>
                  </button>

                  <div
                    className={`dropdown-menu mt-2 shadow-sm border-0 ${
                      boardDropdownOpen && isStep2Enabled ? "show" : ""
                    }`}
                    style={{
                      maxHeight: "260px",
                      overflowY: "auto",
                      minWidth: "260px",
                    }}
                  >
                    {!isStep2Enabled ? (
                      <span className="dropdown-item-text text-muted fst-italic">
                        Please select contact person(s) in Step 1 first.
                      </span>
                    ) : availableBoards.length === 0 ? (
                      <span className="dropdown-item-text text-muted fst-italic">
                        No boards found.
                      </span>
                    ) : (
                      availableBoards.map((board, index) => {
                        const label = getBoardLabel(board);

                        return (
                          <label
                            key={`${label}-${index}`}
                            className="dropdown-item d-flex align-items-center py-2"
                            style={{ cursor: "pointer" }}
                          >
                            <input
                              type="checkbox"
                              className="form-check-input me-3"
                              checked={isBoardSelected(index)}
                              onChange={() => toggleBoardSelection(index)}
                            />
                            <span className="fw-semibold">{label}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {isStep2Enabled && selectedBoardList.length > 0 && (
                  <div>
                    <div className="text-muted small mb-1">Selected board(s):</div>
                    <div className="d-flex flex-wrap gap-2">
                      {selectedBoardList.map((board, idx) => (
                        <span
                          key={`${getBoardLabel(board)}-chip-${idx}`}
                          className="badge bg-light text-dark border"
                        >
                          {getBoardLabel(board)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ====== STEP 3: MAX CLASS ====== */}
            <div className="card shadow-sm border-0">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div>
                    <div className="badge bg-light text-dark mb-1">Step 3</div>
                    <h5 className="mb-0">Max Class</h5>
                    <small className="text-muted">
                      Set the maximum class for which this institute is applicable (1–12).
                    </small>
                  </div>

                  {maxClass !== null && (
                    <span className="badge bg-info-subtle text-info">
                      Class {maxClass}
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <div className="d-flex align-items-center gap-3 flex-wrap">
                    {/* Slider */}
                    <div className="flex-grow-1">
                      <input
                        type="range"
                        className="form-range"
                        min={1}
                        max={12}
                        step={1}
                        value={maxClass ?? 1}
                        onChange={(e) => handleMaxClassChange(e.target.value)}
                      />
                      <div className="d-flex justify-content-between text-muted small mt-1">
                        <span>1</span>
                        <span>12</span>
                      </div>
                    </div>

                    {/* Numeric input */}
                    <div style={{ minWidth: 90 }}>
                      <label className="form-label mb-1 small text-muted">
                        Max Class
                      </label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min={1}
                        max={12}
                        value={maxClass ?? ""}
                        placeholder="1–12"
                        onChange={(e) => handleMaxClassChange(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer className="border-0 pt-0">
          <div className="d-flex justify-content-between w-100 align-items-center">
            <div className="text-muted small">
              {props.data?.instituteCode && (
                <>
                  <span className="fw-semibold">Institute Code: </span>
                  <span>{props.data.instituteCode}</span>
                </>
              )}
            </div>

            <div>
              <button
                type="button"
                className="btn btn-sm btn-light me-2"
                onClick={() => props.onHide()}
                disabled={loading}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={
                  loading ||
                  (availableContacts.length === 0 && availableBoards.length === 0)
                }
              >
                {!loading && (
                  <span className="indicator-label">Save Selection</span>
                )}
                {loading && (
                  <span className="indicator-progress" style={{ display: "block" }}>
                    Please wait...
                    <span className="spinner-border spinner-border-sm align-middle ms-2" />
                  </span>
                )}
              </button>
            </div>
          </div>
        </Modal.Footer>
      </form>
    </Modal>
  );
};

export default CollegeInfoModal;
