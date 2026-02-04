// CollegeAssignRolePage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
// NOTE: removed the menu animation button per your request (no menu button by heading)
import { UpdateCollegeData } from "../../College/API/College_APIs";
import { ReadBoardData } from "../../Board/API/Board_APIs";
import { ReadContactInformationData } from "../../ContactPerson/API/Contact_Person_APIs";
import { readRoleData } from "../../../modules/role_roleGroup/components/core/Role_RoleGroup_APIs";

type ContactPerson = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  designation?: string;
  roles?: string[]; // optional roles field
  status?: "active" | "pending" | "deleted" | string;
  avatarUrl?: string;
};

type Board = {
  id?: string | number;
  boardName?: string;
  name?: string;
  [key: string]: any;
};

type CollegeDataForPage = {
  instituteCode?: string;
  contactPersons?: ContactPerson[];
  maxClass?: number | string;
  [key: string]: any;
};

// fallback roles
const FALLBACK_ROLE_OPTIONS = [
  "Principal",
  "Administrator",
  "Coordinator",
  "Teacher",
  "Accountant",
  "Counselor",
];

export default function Users() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const initialData: CollegeDataForPage | undefined = (state as any)?.data;

  const [data, setData] = useState<CollegeDataForPage | undefined>(initialData);
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

  // UI state
  const [query, setQuery] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  // Fetch initial data
  useEffect(() => {
    // Contacts
    const fetchContacts = async () => {
      try {
        const res = await ReadContactInformationData();
        const rawContacts: any[] =
          (res as any)?.data?.data ??
          (res as any)?.data?.contacts ??
          (res as any)?.data ??
          [];

        // normalize contacts; add status/avatar fallbacks if missing
        const contacts: ContactPerson[] = (rawContacts || [])
          .filter((c) => c && (c.name || c.email || c.phone || c.designation))
          .map((c: any) => ({
            id: c.id ?? c._id ?? c.email ?? undefined,
            name: c.name,
            email: c.email,
            phone: c.phone,
            designation: c.designation,
            roles: c.roles ?? [],
            status: c.status ?? "active",
            avatarUrl: c.avatarUrl ?? c.avatar ?? undefined,
          }));

        setAvailableContacts(contacts);

        // pre-select if data provided
        const instituteContacts = data?.contactPersons ?? [];
        const preSelected: number[] = [];

        contacts.forEach((contact, index) => {
          const match = instituteContacts.find(
            (ic: any) =>
              (ic.id && contact.id && ic.id === contact.id) ||
              (ic.email && contact.email && ic.email === contact.email)
          );
          if (match) preSelected.push(index);
        });

        setSelectedContactIndexes(preSelected);
      } catch (err) {
        console.error("Failed to load contacts:", err);
        setAvailableContacts([]);
        setSelectedContactIndexes([]);
      }
    };

    // Boards
    const fetchBoards = async () => {
      try {
        const res = await ReadBoardData();
        const rawBoards: any[] =
          (res as any)?.data?.data ??
          (res as any)?.data?.boards ??
          (res as any)?.data ??
          [];
        const boards: Board[] = (rawBoards || []).filter(Boolean);
        setAvailableBoards(boards);
      } catch (err) {
        console.error("Failed to load boards:", err);
        setAvailableBoards([]);
      }
    };

    // Roles
    const fetchRoles = async () => {
      setRolesLoading(true);
      try {
        const res = await readRoleData();
        const rawRoles: any[] =
          (res as any)?.data?.data ??
          (res as any)?.data?.roles ??
          (res as any)?.data ??
          [];
        const roles: string[] = (rawRoles || [])
          .map((r: any) => {
            if (!r && r !== 0) return null;
            if (typeof r === "string") return r;
            if (typeof r === "object") {
              return r.role ?? r.name ?? r.roleName ?? r.title ?? r.label ?? null;
            }
            return null;
          })
          .filter(Boolean) as string[];
        if (roles.length > 0) setRoleOptions(roles);
        else setRoleOptions(FALLBACK_ROLE_OPTIONS);
      } catch (err) {
        console.error("Failed to load roles:", err);
        setRoleOptions(FALLBACK_ROLE_OPTIONS);
      } finally {
        setRolesLoading(false);
      }
    };

    fetchContacts();
    fetchBoards();
    fetchRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Initialize per-contact roles if provided in data
  useEffect(() => {
    const newContactRoles: Record<number, string[]> = {};
    selectedContactIndexes.forEach((idx) => {
      const contact = availableContacts[idx];
      let rolesFromProps: string[] | undefined = undefined;
      if (data?.contactPersons?.length) {
        const match = (data.contactPersons as ContactPerson[]).find(
          (ic) =>
            (ic.id && contact?.id && ic.id === contact.id) ||
            (ic.email && contact?.email && ic.email === contact.email)
        );
        rolesFromProps = match?.roles;
      }
      newContactRoles[idx] = rolesFromProps && Array.isArray(rolesFromProps) ? rolesFromProps : [];
    });
    setContactRoles((prev) => ({ ...newContactRoles, ...prev }));
    setOpenRoleDropdowns({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableContacts, selectedContactIndexes]);

  // helpers
  const toggleContactSelection = (index: number) => {
    setSelectedContactIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
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
        if (!current.includes(role)) return { ...prev, [contactIndex]: [...current, role] };
        return prev;
      } else {
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!data) {
      // if no data, just reload page as requested earlier
      window.location.reload();
      return;
    }

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
        ...data,
        contactPersons: selectedContacts,
      };
      if (selectedBoards.length > 0) payload.boards = selectedBoards;

      await UpdateCollegeData(payload);
      // refresh page after success to reflect updates
      window.location.reload();
    } catch (error) {
      console.error("UpdateCollegeData failed", error);
      window.location.replace("/error");
    } finally {
      setLoading(false);
    }
  };

  const getBoardLabel = (board: Board) =>
    board.boardName ?? board.name ?? (board.id !== undefined ? String(board.id) : "Board");

  // filter & search contacts for listing
  const filteredContacts = availableContacts.filter((c) => {
    if (showActiveOnly && (c.status ?? "active") !== "active") return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (c.name ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.designation ?? "").toLowerCase().includes(q)
    );
  });

  // Layout render
  return (
    <div className="container-fluid py-4">
      <style>{`
        /* Page layout mimic Metronic list with extra spacing adjustments */
        .team-page .card { border-radius: 10px; overflow: hidden; }
        .team-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding: 8px 6px; }
        .member-avatar { width:40px; height:40px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:#fff; font-weight:600; }

        /* increased padding for headings and cells so content doesn't hug the container edges */
        .team-page .card-body { padding: 12px 20px !important; } /* ensure card body has padding */

        /* METRONIC-LIKE TABLE STYLES */
        .metronic-table table {
          border-collapse: separate;
          border-spacing: 0;
          width: 100%;
        }

        .metronic-table thead th {
          font-weight: 600;
          padding: 16px 24px;
          font-size: 14px;
          color: #3f4254;
          background: #fafafb;
          border-bottom: 1px solid #eff2f5;
          text-align: left;
        }

        .metronic-table tbody td {
          padding: 16px 24px;
          vertical-align: middle;
          border-bottom: 1px solid #eff2f5;
        }

        /* First column spacing */
        .metronic-table thead th:first-child,
        .metronic-table tbody td:first-child {
          padding-left: 32px;
        }

        /* Roles badges */
        .role-badge {
          background: #f5f8fa;
          padding: 5px 10px;
          border-radius: 12px;
          font-size: 12px;
          margin-right: 6px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        /* Status pills same as Metronic */
        .status-pill {
          padding: 5px 10px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 12px;
        }

        .status-active {
          background: #e8fff3;
          color: #0bb783;
        }

        .status-pending {
          background: #fff8dd;
          color: #ffa800;
        }

        .status-deleted {
          background: #f8d7da;
          color: #d33;
        }

        /* Actions center alignment */
        .actions-cell {
          display: flex;
          justify-content: center;
          gap: 8px;
        }

        .search-input { max-width:360px; }
        .top-actions { display:flex; gap:8px; align-items:center; }

        /* make sure role dropdown won't push layout to the right */
        .role-dropdown { left: auto; right: 24px !important; }

        @media (max-width: 768px) {
          .search-input { max-width:100%; width:100%; }
          .metronic-table thead th:first-child,
          .metronic-table tbody td:first-child { padding-left: 18px; }
        }
      `}</style>

      <div className="team-page">
        {/* header (menu button removed per request) */}
        <div className="team-header mb-4">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div>
              <h3 className="mb-0">Team Members</h3>
              <small className="text-muted">Overview of all team members and roles.</small>
            </div>
          </div>
        </div>

        {/* search + filter row */}
        <div className="d-flex align-items-center justify-content-between mb-3 gap-3">
          <div className="d-flex align-items-center gap-2">
            <input
              className="form-control form-control-sm search-input"
              placeholder="Search users"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="form-check form-switch ms-2">
              <input
                className="form-check-input"
                type="checkbox"
                id="activeOnly"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
              />
              <label className="form-check-label small text-muted" htmlFor="activeOnly">
                Active Users
              </label>
            </div>
          </div>

          <div className="text-muted small">Showing {filteredContacts.length} members</div>
        </div>

        {/* main card */}
        <div className="card shadow-sm mb-4">
          <div className="card-body p-0">
            <div className="table-responsive metronic-table">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th style={{ width: "40%" }}>Member</th>
                    <th style={{ width: "35%" }}>Roles</th>
                    <th style={{ width: "15%" }}>Status</th>
                    <th style={{ width: "10%", textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map((contact, idx) => {
                    // determine display index and selected state
                    // we want to operate over original indexes in availableContacts
                    const originalIndex = availableContacts.findIndex(
                      (c) => c.id === contact.id && c.email === contact.email
                    );
                    const ci = originalIndex === -1 ? idx : originalIndex;
                    const isSelected = isContactSelected(ci);
                    const roles = contactRoles[ci] ?? contact.roles ?? [];
                    const dropdownOpen = !!openRoleDropdowns[ci];

                    const initials = (contact.name ?? contact.email ?? "U")
                      .split(" ")
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();

                    // status display
                    const st = (contact.status ?? "active").toLowerCase();

                    return (
                      <tr key={ci}>
                        {/* MEMBER */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            {contact.avatarUrl ? (
                              <img
                                src={contact.avatarUrl}
                                alt={contact.name}
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: "50%",
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              <div
                                className="member-avatar"
                                style={{ background: "#7c3aed", width: 40, height: 40 }}
                              >
                                {initials}
                              </div>
                            )}

                            <div>
                              <div className="fw-semibold">{contact.name ?? contact.email}</div>
                              <div className="small text-muted">
                                {contact.designation ?? contact.email ?? contact.phone}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* ROLES */}
                        <td>
                          <div className="d-flex flex-wrap align-items-center" style={{ gap: 8 }}>
                            {roles.length === 0 ? (
                              <span className="small text-muted">No roles assigned</span>
                            ) : (
                              roles.map((r) => (
                                <div key={r} className="role-badge">
                                  <span style={{ fontSize: 13 }}>{r}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeRoleFromContact(ci, r)}
                                    style={{
                                      border: "none",
                                      background: "transparent",
                                      cursor: "pointer",
                                      fontWeight: 700,
                                    }}
                                    aria-label={`remove ${r}`}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))
                            )}
                          </div>

                          {/* role dropdown */}
                          <div style={{ position: "relative", marginTop: 8 }}>
                            {dropdownOpen && (
                              <div
                                className="card shadow-sm position-absolute role-dropdown"
                                style={{
                                  zIndex: 1200,
                                  left: 0,
                                  top: 0,
                                  minWidth: 280,
                                  padding: 12,
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="fw-semibold mb-2">Select Roles</div>
                                {rolesLoading ? (
                                  <div className="small text-muted">Loading roles...</div>
                                ) : (
                                  <div style={{ maxHeight: 220, overflow: "auto" }}>
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

                                <div className="d-flex justify-content-end mt-2 gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => setOpenRoleDropdowns((p) => ({ ...p, [ci]: false }))}
                                  >
                                    Done
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => setContactRoles((p) => ({ ...p, [ci]: [] }))}
                                  >
                                    Clear
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* STATUS */}
                        <td>
                          <div>
                            {st === "active" && <span className="status-pill status-active">Active</span>}
                            {st === "pending" && <span className="status-pill status-pending">Pending</span>}
                            {st === "deleted" && <span className="status-pill status-deleted">Deleted</span>}
                            {!["active", "pending", "deleted"].includes(st) && (
                              <span className="status-pill">{st}</span>
                            )}
                          </div>
                        </td>

                        {/* ACTIONS - centered */}
                        <td style={{ width: "140px" }}>
                          <div className="actions-cell">
                            <button
                              type="button"
                              className={`btn btn-sm ${dropdownOpen ? "btn-primary" : "btn-outline-primary"}`}
                              onClick={() => {
                                if (!isSelected) toggleContactSelection(ci);
                                openRoleDropdownFor(ci);
                              }}
                            >
                              Edit
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

                  {filteredContacts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-4">
                        No members found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* bottom action bar */}
        <div className="d-flex justify-content-end gap-2 mt-3">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => window.location.reload()}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => handleSubmit()}
            disabled={loading || (availableContacts.length === 0 && availableBoards.length === 0)}
          >
            {!loading ? "Save Selection" : "Saving..."}
          </button>
        </div>
      </div>
    </div>
  );
}
