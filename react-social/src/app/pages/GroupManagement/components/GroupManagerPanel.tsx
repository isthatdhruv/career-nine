import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Form, Spinner } from "react-bootstrap";
import { showErrorToast, showSuccessToast } from "../../../utils/toast";
import { useAuth, useCan } from "../../../modules/auth";
import { Scope } from "../../../modules/auth/core/_models";
import {
  getStudentsWithMappingByInstituteId,
  getContactPersonsByInstitute,
} from "../../StudentInformation/StudentInfo_APIs";
import {
  addContactPersons,
  addMembers,
  BulkResult,
  createGroup,
  deactivateGroup,
  getGroup,
  groupErrorMessage,
  listGroups,
  removeContactPersons,
  removeMembers,
  StudentGroupDetail,
  StudentGroupSummary,
  updateGroup,
} from "../../College/API/StudentGroup_APIs";

export interface GroupManagerPanelProps {
  instituteCode: number;
  /** Height of the group list scroll region. */
  listMaxHeight?: number;
  /** Height of the member / contact-person scroll region. */
  rowsMaxHeight?: number;
}

/** A candidate for the "add" pickers — students and contact persons share this shape. */
interface Candidate {
  id: number;
  primary: string;
  secondary: string;
}

type Tab = "students" | "contacts";

/**
 * Manage the named student groups of one institute.
 *
 * <p>Two panes: the institute's groups on the left, the selected group's
 * students and contact persons on the right. Both attachments are many-to-many
 * and the server is idempotent on both, so the two tabs are deliberately the
 * same shape — pick from the institute, add in bulk, remove in bulk.
 *
 * <p>Groups are independent of session, class and section; the class shown
 * beside a student is informational only and never filters membership.
 *
 * <p>This is the single implementation behind both surfaces: the Groups action
 * on the institute list (InstituteGroupsModal) and the standalone Group
 * Management page. It holds no per-surface chrome — the caller supplies the
 * institute and the modal/page frame.
 *
 * <p><b>Authorization.</b> Every mutating control is gated on the same
 * permission the backing endpoint enforces (see StudentGroupController):
 * create/update/delete on the group itself, {@code member.manage} for students,
 * {@code contact.assign} for contact persons — each checked against the ABAC
 * institute scope. The server re-checks all of it; this only keeps the UI
 * honest about what the user can actually do.
 */
const GroupManagerPanel = ({
  instituteCode,
  listMaxHeight = 380,
  rowsMaxHeight = 300,
}: GroupManagerPanelProps) => {
  const [groups, setGroups] = useState<StudentGroupSummary[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [groupQuery, setGroupQuery] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<StudentGroupDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [tab, setTab] = useState<Tab>("students");
  const [picking, setPicking] = useState(false);
  const [pickQuery, setPickQuery] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());

  // Institute-wide pools, fetched once per institute and reused by both pickers.
  const [students, setStudents] = useState<Candidate[]>([]);
  const [contacts, setContacts] = useState<Candidate[]>([]);
  const [loadingPool, setLoadingPool] = useState(false);

  // ── authorization ────────────────────────────────────────────────────

  const can = useCan();
  const { currentUser } = useAuth();
  const isSuperAdmin = currentUser?.superAdmin === true;
  // Stable reference — `currentUser` is a fresh object on every provider update
  // but `currentUser.scopes` is not, so downstream memos don't re-fire.
  const userScopes: Scope[] = useMemo(() => currentUser?.scopes ?? [], [currentUser]);

  // Handing `can()` a scope makes `allows()` demand a matching scope row, so a
  // user who holds the permission but has NO rows at all (legacy / unscoped
  // staff session) would be denied every action. Read "no rows" as unscoped and
  // check the permission alone — matching backend
  // `allowed(user, perm, null, null, null, null)` and the same reading the
  // Reports Hub applies to its institute filter.
  const scope: Scope | undefined = useMemo(
    () => (userScopes.length ? { i: instituteCode } : undefined),
    [userScopes, instituteCode]
  );

  const canCreate = can("student_group.create", scope);
  const canUpdate = can("student_group.update", scope);
  const canDelete = can("student_group.delete", scope);
  const canManageMembers = can("student_group.member.manage", scope);
  const canAssignContacts = can("student_group.contact.assign", scope);

  // Deactivating hits DELETE /student-groups/{id} (student_group.delete);
  // reactivating is a PUT with {active:true} (student_group.update).
  const canToggleActive = detail?.active ? canDelete : canUpdate;
  // Whichever attachment the open tab manages.
  const canMutateTab = tab === "students" ? canManageMembers : canAssignContacts;

  /**
   * ABAC group narrowing. A scope row that binds `g` restricts the holder to
   * that group; a row without `g` places no group restriction at all, so the
   * filter applies only when EVERY row binds one — the same rule the backend
   * documents for group-scoped grants. null = no restriction.
   */
  const allowedGroupIds = useMemo<Set<number> | null>(() => {
    if (isSuperAdmin) return null;
    if (!userScopes.length) return null;
    if (userScopes.some((s) => s.g == null)) return null;
    return new Set(userScopes.map((s) => s.g as number));
  }, [isSuperAdmin, userScopes]);

  // ── loading ──────────────────────────────────────────────────────────

  const loadGroups = useCallback(async () => {
    if (!instituteCode) return;
    setLoadingGroups(true);
    try {
      const res = await listGroups(instituteCode, includeInactive);
      setGroups(res.data || []);
    } catch (e: any) {
      showErrorToast(groupErrorMessage(e, "Could not load groups"));
    } finally {
      setLoadingGroups(false);
    }
  }, [instituteCode, includeInactive]);

  const loadDetail = useCallback(async (groupId: number) => {
    setLoadingDetail(true);
    try {
      const res = await getGroup(groupId);
      setDetail(res.data);
    } catch (e: any) {
      setDetail(null);
      showErrorToast(groupErrorMessage(e, "Could not load that group"));
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const loadPools = useCallback(async () => {
    if (!instituteCode) return;
    setLoadingPool(true);
    try {
      const [studentRes, contactRes] = await Promise.all([
        getStudentsWithMappingByInstituteId(instituteCode),
        getContactPersonsByInstitute(instituteCode),
      ]);
      setStudents(
        (studentRes.data || []).map((s: any) => ({
          id: s.userStudentId,
          primary: s.name || `Student #${s.userStudentId}`,
          secondary: [s.schoolRollNumber, s.studentClass ? `Class ${s.studentClass}` : null, s.username]
            .filter(Boolean)
            .join(" · "),
        }))
      );
      setContacts(
        (contactRes.data || []).map((c: any) => ({
          id: c.id,
          primary: c.name || `Contact #${c.id}`,
          secondary: [c.designation, c.email].filter(Boolean).join(" · "),
        }))
      );
    } catch (e: any) {
      showErrorToast(groupErrorMessage(e, "Could not load this institute's people"));
    } finally {
      setLoadingPool(false);
    }
  }, [instituteCode]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    loadPools();
  }, [loadPools]);

  // Reset per-institute state so a previously selected group never bleeds
  // across when the panel is pointed at a different school.
  useEffect(() => {
    setSelectedId(null);
    setDetail(null);
    setCreating(false);
    setEditing(false);
    setPicking(false);
    setGroupQuery("");
    setNewName("");
    setNewDescription("");
  }, [instituteCode]);

  useEffect(() => {
    setPicking(false);
    setPicked(new Set());
    setPickQuery("");
    setEditing(false);
    setTab("students");
  }, [selectedId]);

  const select = (groupId: number) => {
    setSelectedId(groupId);
    loadDetail(groupId);
  };

  const refreshBoth = async () => {
    await loadGroups();
    if (selectedId) await loadDetail(selectedId);
  };

  // ── mutations ────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!canCreate) return;
    const name = newName.trim();
    if (!name) {
      showErrorToast("Give the group a name");
      return;
    }
    setBusy(true);
    try {
      const res = await createGroup(instituteCode, name, newDescription.trim() || undefined);
      showSuccessToast(`Group "${res.data.name}" created`);
      setNewName("");
      setNewDescription("");
      setCreating(false);
      await loadGroups();
      select(res.data.id);
    } catch (e: any) {
      showErrorToast(groupErrorMessage(e, "Could not create the group"));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!detail || !canUpdate) return;
    const name = editName.trim();
    if (!name) {
      showErrorToast("Give the group a name");
      return;
    }
    setBusy(true);
    try {
      await updateGroup(detail.id, { name, description: editDescription.trim() });
      showSuccessToast("Group updated");
      setEditing(false);
      await refreshBoth();
    } catch (e: any) {
      showErrorToast(groupErrorMessage(e, "Could not update the group"));
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async () => {
    if (!detail || !canToggleActive) return;
    setBusy(true);
    try {
      if (detail.active) {
        await deactivateGroup(detail.id);
        showSuccessToast(`"${detail.name}" deactivated`);
      } else {
        await updateGroup(detail.id, { active: true });
        showSuccessToast(`"${detail.name}" reactivated`);
      }
      await refreshBoth();
    } catch (e: any) {
      showErrorToast(groupErrorMessage(e, "Could not change the group's status"));
    } finally {
      setBusy(false);
    }
  };

  /** Reports what actually changed — the server skips anything already attached. */
  const reportBulk = (r: BulkResult, noun: string) => {
    const bits: string[] = [];
    if (r.added) bits.push(`${r.added} ${noun} added`);
    if (r.alreadyPresent) bits.push(`${r.alreadyPresent} already in the group`);
    if (r.removed) bits.push(`${r.removed} ${noun} removed`);
    if (r.notPresent) bits.push(`${r.notPresent} were not in the group`);
    showSuccessToast(bits.length ? bits.join(", ") : "Nothing changed");
  };

  const handleAddPicked = async () => {
    if (!detail || picked.size === 0 || !canMutateTab) return;
    const ids = Array.from(picked);
    setBusy(true);
    try {
      const res = tab === "students"
        ? await addMembers(detail.id, ids)
        : await addContactPersons(detail.id, ids);
      reportBulk(res.data, tab === "students" ? "student(s)" : "contact person(s)");
      setPicked(new Set());
      setPicking(false);
      await refreshBoth();
    } catch (e: any) {
      showErrorToast(groupErrorMessage(e, "Could not add to the group"));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (id: number, label: string) => {
    if (!detail || !canMutateTab) return;
    if (!window.confirm(`Remove ${label} from "${detail.name}"?`)) return;
    setBusy(true);
    try {
      const res = tab === "students"
        ? await removeMembers(detail.id, [id])
        : await removeContactPersons(detail.id, [id]);
      reportBulk(res.data, tab === "students" ? "student(s)" : "contact person(s)");
      await refreshBoth();
    } catch (e: any) {
      showErrorToast(groupErrorMessage(e, "Could not remove from the group"));
    } finally {
      setBusy(false);
    }
  };

  // ── derived ──────────────────────────────────────────────────────────

  const scopedGroups = useMemo(
    () => (allowedGroupIds ? groups.filter((g) => allowedGroupIds.has(g.id)) : groups),
    [groups, allowedGroupIds]
  );

  const visibleGroups = useMemo(() => {
    const q = groupQuery.trim().toLowerCase();
    if (!q) return scopedGroups;
    return scopedGroups.filter((g) => g.name.toLowerCase().includes(q));
  }, [scopedGroups, groupQuery]);

  /** The pool minus whoever is already attached — you cannot pick a duplicate. */
  const pickCandidates = useMemo(() => {
    if (!detail) return [];
    const pool = tab === "students" ? students : contacts;
    const attached = new Set<number>(
      tab === "students"
        ? detail.students.map((s) => s.userStudentId)
        : detail.contactPersons.map((c) => c.id)
    );
    const q = pickQuery.trim().toLowerCase();
    return pool.filter(
      (c) =>
        !attached.has(c.id) &&
        (!q || c.primary.toLowerCase().includes(q) || c.secondary.toLowerCase().includes(q))
    );
  }, [detail, tab, students, contacts, pickQuery]);

  const attachedRows: Candidate[] = useMemo(() => {
    if (!detail) return [];
    return tab === "students"
      ? detail.students.map((s) => ({
          id: s.userStudentId,
          primary: s.name || `Student #${s.userStudentId}`,
          secondary: [
            s.schoolRollNumber,
            s.className || (s.studentClass ? `Class ${s.studentClass}` : null),
            s.sectionName,
            s.username,
          ]
            .filter(Boolean)
            .join(" · "),
        }))
      : detail.contactPersons.map((c) => ({
          id: c.id,
          primary: c.name || `Contact #${c.id}`,
          secondary: [c.designation, c.email].filter(Boolean).join(" · "),
        }));
  }, [detail, tab]);

  const togglePicked = (id: number) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── render ───────────────────────────────────────────────────────────

  return (
    <div className="d-flex gap-3 align-items-stretch flex-wrap flex-lg-nowrap">
      {/* ── Left: the institute's groups ── */}
      <div style={{ width: 300, flexShrink: 0 }}>
        <div className="d-flex align-items-center justify-content-between mb-2">
          <span className="fw-bold text-uppercase text-muted" style={{ fontSize: "0.72rem", letterSpacing: "0.06em" }}>
            Groups in this school
          </span>
          {canCreate && (
            <Button size="sm" variant="primary" onClick={() => setCreating((v) => !v)}>
              <i className="bi bi-plus-lg" />
            </Button>
          )}
        </div>

        {creating && canCreate && (
          <div className="border rounded p-2 mb-2 bg-light">
            <Form.Control
              size="sm"
              className="mb-2"
              placeholder="Group name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              autoFocus
            />
            <Form.Control
              size="sm"
              className="mb-2"
              placeholder="Description (optional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
            <div className="d-flex gap-2">
              <Button size="sm" variant="primary" onClick={handleCreate} disabled={busy}>
                Create
              </Button>
              <Button size="sm" variant="light" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <Form.Control
          size="sm"
          className="mb-2"
          placeholder="Search groups…"
          value={groupQuery}
          onChange={(e) => setGroupQuery(e.target.value)}
        />
        <Form.Check
          type="switch"
          id="grp-include-inactive"
          className="mb-2"
          label={<span className="text-muted" style={{ fontSize: "0.8rem" }}>Show deactivated</span>}
          checked={includeInactive}
          onChange={(e) => setIncludeInactive(e.target.checked)}
        />

        <div style={{ maxHeight: listMaxHeight, overflowY: "auto" }}>
          {loadingGroups && <div className="text-center py-4"><Spinner animation="border" size="sm" /></div>}
          {!loadingGroups && visibleGroups.length === 0 && (
            <div className="text-muted text-center py-4" style={{ fontSize: "0.85rem" }}>
              {scopedGroups.length === 0
                ? canCreate
                  ? "No groups yet. Create the first one."
                  : "No groups you can see in this school."
                : "No group matches that search."}
            </div>
          )}
          {!loadingGroups && visibleGroups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => select(g.id)}
              className={`btn btn-sm w-100 text-start mb-1 ${selectedId === g.id ? "btn-primary" : "btn-light"}`}
              style={{ opacity: g.active ? 1 : 0.6 }}
            >
              <div className="fw-bold d-flex align-items-center gap-2">
                <span className="text-truncate">{g.name}</span>
                {!g.active && <Badge bg="secondary">off</Badge>}
              </div>
              <div style={{ fontSize: "0.75rem", opacity: 0.85 }}>
                {g.memberCount ?? 0} student{g.memberCount === 1 ? "" : "s"} · {g.contactCount ?? 0} admin
                {g.contactCount === 1 ? "" : "s"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right: the selected group ── */}
      <div className="flex-grow-1 border-start ps-3" style={{ minWidth: 0 }}>
        {!selectedId && (
          <div className="text-muted text-center d-flex flex-column justify-content-center h-100 py-5">
            <i className="bi bi-people fs-1 mb-2 opacity-50" />
            {canCreate ? "Pick a group on the left, or create one." : "Pick a group on the left."}
            <div className="mt-1" style={{ fontSize: "0.82rem" }}>
              A group can mix any classes and sections — it is independent of them.
            </div>
          </div>
        )}

        {selectedId && loadingDetail && (
          <div className="text-center py-5"><Spinner animation="border" /></div>
        )}

        {selectedId && !loadingDetail && detail && (
          <>
            <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
              {editing ? (
                <div className="flex-grow-1">
                  <Form.Control
                    size="sm"
                    className="mb-2"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                  />
                  <Form.Control
                    size="sm"
                    className="mb-2"
                    placeholder="Description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                  <div className="d-flex gap-2">
                    <Button size="sm" variant="primary" onClick={handleSaveEdit} disabled={busy}>Save</Button>
                    <Button size="sm" variant="light" onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                  <div className="fs-5 fw-bold d-flex align-items-center gap-2">
                    <span className="text-truncate">{detail.name}</span>
                    {!detail.active && <Badge bg="secondary">Deactivated</Badge>}
                  </div>
                  {detail.description && (
                    <div className="text-muted" style={{ fontSize: "0.85rem" }}>{detail.description}</div>
                  )}
                </div>
              )}

              {!editing && (
                <div className="d-flex gap-2 flex-shrink-0">
                  {canUpdate && (
                    <Button
                      size="sm"
                      variant="light"
                      onClick={() => {
                        setEditName(detail.name);
                        setEditDescription(detail.description || "");
                        setEditing(true);
                      }}
                    >
                      <i className="bi bi-pencil" /> Edit
                    </Button>
                  )}
                  {canToggleActive && (
                    <Button
                      size="sm"
                      variant={detail.active ? "outline-danger" : "outline-success"}
                      onClick={handleToggleActive}
                      disabled={busy}
                    >
                      {detail.active ? "Deactivate" : "Reactivate"}
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="btn-group btn-group-sm mb-3" role="group">
              <button
                type="button"
                className={`btn ${tab === "students" ? "btn-primary" : "btn-light"}`}
                onClick={() => { setTab("students"); setPicking(false); setPicked(new Set()); }}
              >
                Students ({detail.students.length})
              </button>
              <button
                type="button"
                className={`btn ${tab === "contacts" ? "btn-primary" : "btn-light"}`}
                onClick={() => { setTab("contacts"); setPicking(false); setPicked(new Set()); }}
              >
                Contact persons ({detail.contactPersons.length})
              </button>
            </div>

            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted" style={{ fontSize: "0.8rem" }}>
                {tab === "students"
                  ? "Students in this group."
                  : "Contact persons who administer this group. All admins are equal; a group may have none."}
              </span>
              {canMutateTab && (
                <Button size="sm" variant="primary" onClick={() => { setPicking((v) => !v); setPicked(new Set()); }}>
                  <i className="bi bi-plus-lg" /> Add {tab === "students" ? "students" : "contact persons"}
                </Button>
              )}
            </div>

            {picking && canMutateTab && (
              <div className="border rounded p-2 mb-3 bg-light">
                <Form.Control
                  size="sm"
                  className="mb-2"
                  placeholder={`Search this school's ${tab === "students" ? "students" : "contact persons"}…`}
                  value={pickQuery}
                  onChange={(e) => setPickQuery(e.target.value)}
                  autoFocus
                />
                <div style={{ maxHeight: 200, overflowY: "auto" }} className="mb-2">
                  {loadingPool && <div className="text-center py-3"><Spinner animation="border" size="sm" /></div>}
                  {!loadingPool && pickCandidates.length === 0 && (
                    <div className="text-muted text-center py-3" style={{ fontSize: "0.85rem" }}>
                      Nobody left to add — everyone matching is already in this group.
                    </div>
                  )}
                  {!loadingPool && pickCandidates.map((c) => (
                    <Form.Check
                      key={c.id}
                      type="checkbox"
                      id={`pick-${tab}-${c.id}`}
                      checked={picked.has(c.id)}
                      onChange={() => togglePicked(c.id)}
                      label={
                        <span>
                          <span className="fw-semibold">{c.primary}</span>
                          {c.secondary && (
                            <span className="text-muted" style={{ fontSize: "0.78rem" }}> — {c.secondary}</span>
                          )}
                        </span>
                      }
                    />
                  ))}
                </div>
                <div className="d-flex gap-2 align-items-center">
                  <Button size="sm" variant="primary" onClick={handleAddPicked} disabled={busy || picked.size === 0}>
                    Add {picked.size > 0 ? `${picked.size} selected` : ""}
                  </Button>
                  <Button size="sm" variant="light" onClick={() => { setPicking(false); setPicked(new Set()); }}>
                    Cancel
                  </Button>
                  {pickCandidates.length > 0 && (
                    <Button
                      size="sm"
                      variant="link"
                      onClick={() => setPicked(new Set(pickCandidates.map((c) => c.id)))}
                    >
                      Select all {pickCandidates.length}
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div style={{ maxHeight: rowsMaxHeight, overflowY: "auto" }}>
              {attachedRows.length === 0 && (
                <div className="text-muted text-center py-4" style={{ fontSize: "0.85rem" }}>
                  {tab === "students"
                    ? "No students in this group yet."
                    : "No contact person on this group yet — nobody has group-scoped access to it."}
                </div>
              )}
              {attachedRows.map((r) => (
                <div
                  key={r.id}
                  className="d-flex align-items-center justify-content-between border-bottom py-2"
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="fw-semibold text-truncate">{r.primary}</div>
                    {r.secondary && (
                      <div className="text-muted text-truncate" style={{ fontSize: "0.78rem" }}>{r.secondary}</div>
                    )}
                  </div>
                  {canMutateTab && (
                    <Button
                      size="sm"
                      variant="outline-danger"
                      className="flex-shrink-0"
                      disabled={busy}
                      onClick={() => handleRemove(r.id, r.primary)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GroupManagerPanel;
