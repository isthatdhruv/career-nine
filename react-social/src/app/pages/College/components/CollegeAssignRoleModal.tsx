// CollegeInfoModal.tsx
import React, { useEffect, useState } from "react";
import { Modal } from "react-bootstrap-v5";
import UseAnimations from "react-useanimations";
import menu2 from "react-useanimations/lib/menu2";
import { UpdateCollegeData } from "../API/College_APIs";
import { ReadBoardData } from "../../Board/API/Board_APIs";
import { ReadContactInformationData } from "../../ContactPerson/API/Contact_Person_APIs";
import { readRoleData } from "../../../modules/role_roleGroup/components/core/Role_RoleGroup_APIs";
import axios from "axios";

type ContactPerson = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  designation?: string;
  roles?: string[]; // optional roles field
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

// fallback list in case API returns no roles or fails
const FALLBACK_ROLE_OPTIONS = [
  "Principal",
  "Administrator",
  "Coordinator",
  "Teacher",
  "Accountant",
  "Counselor",
];

const CollegeAssignRoleModal = (props: Props) => {
  const [loading, setLoading] = useState(false);

  const [availableContacts, setAvailableContacts] = useState<ContactPerson[]>([]);
  const [selectedContactIndexes, setSelectedContactIndexes] = useState<number[]>([]);

  // Per-contact dropdown open state (index -> boolean)
  const [openRoleDropdowns, setOpenRoleDropdowns] = useState<Record<number, boolean>>({});

  // Per-contact selected roles (index -> string[])
  const [contactRoles, setContactRoles] = useState<Record<number, string[]>>({});

  const [availableBoards, setAvailableBoards] = useState<Board[]>([]);
  const [selectedBoardIndexes, setSelectedBoardIndexes] = useState<number[]>([]);
  const [boardDropdownOpen, setBoardDropdownOpen] = useState(false);

  // Roles from API
  const [roleOptions, setRoleOptions] = useState<string[]>(FALLBACK_ROLE_OPTIONS);
  const [rolesLoading, setRolesLoading] = useState(false);

  useEffect(() => {
    if (!props.show) return;

    // Fetch contacts
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

        // Pre-select contacts already mapped to this institute (if any)
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

    // Fetch boards
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

    // Fetch roles from API
    const fetchRoles = async () => {
      setRolesLoading(true);
      try {
        const res = await readRoleData();
        // Normalize different possible shapes: { data: { data: [...] } } or { data: [...] } or [...]
        const rawRoles: any[] =
          (res as any)?.data?.data ??
          (res as any)?.data?.roles ??
          (res as any)?.data ??
          [];

        // Try to extract string labels. If roles are objects, try common keys.
        const roles: string[] = (rawRoles || [])
          .map((r) => {
            if (!r && r !== 0) return null;
            if (typeof r === "string") return r;
            if (typeof r === "object") {
              // prefer name/role/roleName/title
              return r.role ?? r.name ?? r.roleName ?? r.title ?? r.label ?? null;
            }
            return null;
          })
          .filter(Boolean) as string[];

        if (roles.length > 0) {
          setRoleOptions(roles);
        } else {
          // fallback if API returned empty
          setRoleOptions(FALLBACK_ROLE_OPTIONS);
        }
      } catch (err) {
        console.error("Failed to load roles:", err);
        // fallback to default roles if API fails
        setRoleOptions(FALLBACK_ROLE_OPTIONS);
      } finally {
        setRolesLoading(false);
      }
    };

    fetchContacts();
    fetchBoards();
    fetchRoles();
  }, [props.show, props.data]);

  // Initialize per-contact role selections when contacts or selected indexes change.
  // If props.data.contactPersons had roles, map them.
  useEffect(() => {
    const newContactRoles: Record<number, string[]> = {};
    selectedContactIndexes.forEach((idx) => {
      // Try to find matching contact in props.data to carry over existing roles
      const contact = availableContacts[idx];
      let rolesFromProps: string[] | undefined = undefined;
      if (props.data?.contactPersons?.length) {
        const match = (props.data.contactPersons as ContactPerson[]).find(
          (ic) =>
            (ic.id && contact?.id && ic.id === contact.id) ||
            (ic.email && contact?.email && ic.email === contact.email)
        );
        rolesFromProps = match?.roles;
      }
      newContactRoles[idx] = rolesFromProps && Array.isArray(rolesFromProps) ? rolesFromProps : [];
    });
    setContactRoles((prev) => ({ ...newContactRoles, ...prev }));
    // Reset dropdown open states for safety
    setOpenRoleDropdowns({});
  }, [availableContacts, selectedContactIndexes, props.data]);

  const toggleContactSelection = (index: number) => {
    setSelectedContactIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );

    // If deselecting, also clean up roles & dropdown
    setContactRoles((prev) => {
      const copy = { ...prev };
      if (copy[index]) delete copy[index];
      return copy;
    });
    setOpenRoleDropdowns((prev) => {
      const copy = { ...prev };
      if (copy[index]) delete copy[index];
      return copy;
    });
  };

  const isContactSelected = (index: number) => selectedContactIndexes.includes(index);

  const toggleBoardSelection = (index: number) => {
    setSelectedBoardIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const isBoardSelected = (index: number) => selectedBoardIndexes.includes(index);

  const openRoleDropdownFor = (index: number) => {
    setOpenRoleDropdowns((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const setRoleForContact = (contactIndex: number, role: string, checked: boolean) => {
    setContactRoles((prev) => {
      const current = prev[contactIndex] ?? [];
      if (checked) {
        // add if not present
        if (!current.includes(role)) {
          return { ...prev, [contactIndex]: [...current, role] };
        }
        return prev;
      } else {
        // remove
        return { ...prev, [contactIndex]: current.filter((r) => r !== role) };
      }
    });
  };

  const removeRoleFromContact = (contactIndex: number, role: string) => {
    setContactRoles((prev) => {
      const current = prev[contactIndex] ?? [];
      return { ...prev, [contactIndex]: current.filter((r) => r !== role) };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!props.data) {
      props.onHide();
      return;
    }

    // Build selected contacts and attach roles per contact (if any)
    const selectedContacts = selectedContactIndexes.map((i) => {
      const contact = availableContacts[i];
      const roles = contactRoles[i] ?? [];
      return {
        ...contact,
        roles,
      } as ContactPerson;
    });

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

  // Step 2 enabled only after Step 1 has at least one selection
  const isStep2Enabled = selectedContactIndexes.length > 0;

  return (
    <Modal
      show={props.show}
      onHide={() => props.onHide()}
      centered
      className="college-modal"
      dialogClassName="college-modal-dialog"
      aria-labelledby="college-info-modal-title"
    >
      {/* Inline styles to control modal width and prevent horizontal scroll */}
      <style>{`
        /* Make the modal wider and responsive */
        .college-modal .modal-dialog {
          max-width: 1200px;      /* increase as needed */
          width: 95vw;
        }
        /* Ensure modal body doesn't force horizontal scroll */
        .college-modal .modal-body {
          overflow-x: hidden;
        }

        /* Let tables auto-layout and wrap cells instead of creating horizontal scroll */
        .college-modal .table-responsive {
          overflow-x: visible !important;
        }
        .college-modal table {
          table-layout: auto;
          width: 100%;
        }
        .college-modal th, .college-modal td {
          white-space: normal;
          word-wrap: break-word;
          vertical-align: middle;
        }

        /* Make role badges wrap to next line when space is insufficient */
        .college-modal .badge {
          white-space: nowrap;
          margin-bottom: 4px;
        }

        /* Ensure the per-contact dropdown doesn't push layout horizontally */
        .college-modal .card.position-absolute {
          left: 0;
          right: auto;
          max-width: 420px;
        }

        /* Small screens fallback */
        @media (max-width: 768px) {
          .college-modal .modal-dialog {
            max-width: 100%;
            width: 98vw;
          }
        }
      `}</style>

      <Modal.Header className="border-0 pb-0">
        <div className="d-flex flex-column">
          <h3 id="college-info-modal-title" className="mb-1 fw-bold">
            Assign Roles
          </h3>
          <span className="text-muted small">Assign roles to the selected contact person</span>
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
                    <h5 className="mb-0">Selected Contact Person</h5>
                    <small className="text-muted">
                      Choose one or more roles associated with the contact person.
                    </small>
                  </div>
                </div>

                {/* Contacts list (checkboxes to select contacts) */}
                <div className="mt-3">
                  {availableContacts.length === 0 ? (
                    <div className="text-muted small">No contacts available</div>
                  ) : (
                    <div className="list-group">
                      {availableContacts.map((contact, idx) => (
                        <label
                          key={idx}
                          className={`list-group-item d-flex justify-content-between align-items-center ${
                            isContactSelected(idx) ? "active" : ""
                          }`}
                          style={{ cursor: "pointer" }}
                        >
                          <div className="form-check">
                            <input
                              className="form-check-input me-2"
                              type="checkbox"
                              checked={isContactSelected(idx)}
                              onChange={() => toggleContactSelection(idx)}
                            />
                            <span className="fw-semibold">
                              {contact.name ?? contact.email ?? contact.phone ?? "Unnamed"}
                            </span>
                            <div className="small text-muted">
                              {contact.designation ? `${contact.designation} • ` : ""}
                              {contact.email ?? contact.phone}
                            </div>
                          </div>

                          <div>
                            {/* Open per-contact role dropdown only for selected contacts */}
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                if (!isContactSelected(idx)) {
                                  // automatically select contact if opening roles
                                  toggleContactSelection(idx);
                                }
                                openRoleDropdownFor(idx);
                              }}
                            >
                              Roles
                            </button>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* ===== Table Listing Selected Contacts with roles dropdown & badges ===== */}
                <div className="mt-4">
                  <h6 className="mb-2">Selected Contacts & Roles</h6>

                  {selectedContactIndexes.length === 0 ? (
                    <div className="text-muted small">No contact selected yet.</div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover align-middle">
                        <thead>
                          <tr>
                            <th style={{ width: "35%" }}>Contact</th>
                            <th style={{ width: "50%" }}>Assigned Roles</th>
                            <th style={{ width: "15%" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedContactIndexes.map((ci) => {
                            const contact = availableContacts[ci];
                            const roles = contactRoles[ci] ?? [];
                            const dropdownOpen = !!openRoleDropdowns[ci];
                            return (
                              <tr key={ci}>
                                <td>
                                  <div className="fw-semibold">
                                    {contact.name ?? contact.email ?? contact.phone ?? "Unnamed"}
                                  </div>
                                  <div className="small text-muted">
                                    {contact.designation ?? ""}
                                    {contact.email ? ` • ${contact.email}` : ""}
                                  </div>
                                </td>

                                <td>
                                  {/* badges for selected roles */}
                                  <div className="d-flex flex-wrap gap-2">
                                    {roles.length === 0 ? (
                                      <span className="small text-muted">No roles assigned</span>
                                    ) : (
                                      roles.map((r) => (
                                        <span
                                          key={r}
                                          className="badge bg-light text-dark border d-inline-flex align-items-center"
                                          style={{ padding: "0.45rem 0.6rem" }}
                                        >
                                          <span className="me-2 small">{r}</span>
                                          <button
                                            type="button"
                                            aria-label={`Remove ${r}`}
                                            className="btn btn-sm btn-icon btn-light btn-xs"
                                            onClick={() => removeRoleFromContact(ci, r)}
                                            style={{
                                              border: "none",
                                              padding: "0",
                                              margin: "0",
                                              lineHeight: 1,
                                              cursor: "pointer",
                                            }}
                                          >
                                            <span style={{ fontSize: 14, marginLeft: 4 }}>×</span>
                                          </button>
                                        </span>
                                      ))
                                    )}
                                  </div>

                                  {/* role dropdown (checkbox list) */}
                                  <div className="position-relative mt-2">
                                    {dropdownOpen && (
                                      <div
                                        className="card shadow-sm position-absolute"
                                        style={{
                                          zIndex: 1200,
                                          left: 0,
                                          top: 0,
                                          minWidth: 260,
                                          padding: 12,
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="fw-semibold mb-2">Select Roles</div>

                                        {rolesLoading ? (
                                          <div className="small text-muted">Loading roles...</div>
                                        ) : (
                                          <div className="roles-list" style={{ maxHeight: 220, overflow: "auto" }}>
                                            {roleOptions.map((role) => {
                                              const checked = (contactRoles[ci] ?? []).includes(role);
                                              return (
                                                <div key={role} className="form-check mb-1">
                                                  <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    id={`contact-${ci}-role-${role}`}
                                                    checked={checked}
                                                    onChange={(ev) =>
                                                      setRoleForContact(ci, role, ev.target.checked)
                                                    }
                                                  />
                                                  <label
                                                    className="form-check-label ms-2"
                                                    htmlFor={`contact-${ci}-role-${role}`}
                                                    style={{ cursor: "pointer" }}
                                                  >
                                                    {role}
                                                  </label>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}

                                        <div className="d-flex justify-content-end mt-2">
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-secondary me-2"
                                            onClick={() =>
                                              setOpenRoleDropdowns((prev) => ({ ...prev, [ci]: false }))
                                            }
                                          >
                                            Done
                                          </button>
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger"
                                            onClick={() =>
                                              setContactRoles((prev) => ({ ...prev, [ci]: [] }))
                                            }
                                          >
                                            Clear
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>

                                <td>
                                  <div className="d-flex gap-2">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-primary"
                                      onClick={() => openRoleDropdownFor(ci)}
                                    >
                                      {dropdownOpen ? "Close" : "Edit"}
                                    </button>

                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() => toggleContactSelection(ci)}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ====== You can keep existing / additional steps below (Step 2 or Boards) ====== */}
            {/* ... For brevity I haven't rearranged the rest of your modal — preserved original footer logic below */}
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
                  loading || (availableContacts.length === 0 && availableBoards.length === 0)
                }
              >
                {!loading && <span className="indicator-label">Save Selection</span>}
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

export default CollegeAssignRoleModal;
