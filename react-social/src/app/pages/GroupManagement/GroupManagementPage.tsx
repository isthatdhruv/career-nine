import { useEffect, useMemo, useState } from "react";
import { Form, Spinner } from "react-bootstrap";
import PageHeader from "../../components/PageHeader";
import { useAuth } from "../../modules/auth";
import { Scope } from "../../modules/auth/core/_models";
import { useInstitutes } from "../../lib/queries/lookups";
import GroupManagerPanel from "./components/GroupManagerPanel";

/**
 * Group Management — the institute list's "Groups" action as a page of its own.
 *
 * <p>The manager itself is {@link GroupManagerPanel}, shared verbatim with
 * InstituteGroupsModal. The only thing this page adds is the institute picker
 * the modal doesn't need: launched from an institute row, the modal already
 * knows its school; reached from the aside menu, the user has to choose one.
 *
 * <p><b>Authorization.</b> The route is gated on {@code student_group.read} by
 * {@code RequirePermission} (which also enforces the role's URL whitelist), the
 * per-action permissions live in the panel, and the institute dropdown is
 * narrowed to the user's ABAC institute scopes so a school-scoped admin can
 * only ever point the manager at their own school. The server re-checks
 * everything — this is UI honesty, not the security boundary.
 */
const GroupManagementPage = () => {
  const { currentUser } = useAuth();
  // Stable reference — `currentUser` is a fresh object on every provider update
  // but `currentUser.scopes` is not, so the memo below doesn't re-fire.
  const userScopes: Scope[] = useMemo(() => currentUser?.scopes ?? [], [currentUser]);
  const isSuperAdmin = currentUser?.superAdmin === true;

  /**
   * null = no restriction: super-admin, an unscoped session (no rows at all —
   * legacy staff token), or at least one institute-wildcard row. Same reading
   * the Reports Hub applies to its own institute filter.
   */
  const allowedInstituteIds = useMemo<Set<number> | null>(() => {
    if (isSuperAdmin) return null;
    if (!userScopes.length) return null;
    if (userScopes.some((s) => s.i == null)) return null;
    return new Set(userScopes.map((s) => s.i as number));
  }, [isSuperAdmin, userScopes]);

  const { data: allInstitutes = [], isLoading } = useInstitutes<any>();
  const institutes = useMemo(
    () =>
      allowedInstituteIds == null
        ? allInstitutes
        : allInstitutes.filter((inst: any) => allowedInstituteIds.has(Number(inst.instituteCode))),
    [allInstitutes, allowedInstituteIds]
  );

  const [selectedInstitute, setSelectedInstitute] = useState<number | "">("");

  // A user scoped to exactly one school shouldn't have to pick from a
  // single-item dropdown.
  useEffect(() => {
    if (institutes.length === 1 && selectedInstitute === "") {
      setSelectedInstitute(Number(institutes[0].instituteCode));
    }
  }, [institutes, selectedInstitute]);

  const selectedName = useMemo(
    () =>
      institutes.find((i: any) => Number(i.instituteCode) === Number(selectedInstitute))
        ?.instituteName || "",
    [institutes, selectedInstitute]
  );

  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className="bi bi-people" />}
        title="Group Management"
        subtitle={
          selectedInstitute !== "" ? (
            <>Named student groups in <strong>{selectedName}</strong></>
          ) : (
            <><strong>{institutes.length}</strong> institutes available</>
          )
        }
      />

      <div className="card mb-4">
        <div className="card-body">
          <div style={{ maxWidth: 460 }}>
            <Form.Label className="fw-bold text-uppercase text-muted" style={{ fontSize: "0.72rem", letterSpacing: "0.06em" }}>
              Institute
            </Form.Label>
            <Form.Select
              value={selectedInstitute}
              onChange={(e) => setSelectedInstitute(e.target.value === "" ? "" : Number(e.target.value))}
              disabled={isLoading || institutes.length === 0}
            >
              <option value="">
                {isLoading ? "Loading institutes…" : "Select an institute…"}
              </option>
              {institutes.map((inst: any) => (
                <option key={inst.instituteCode} value={inst.instituteCode}>
                  {inst.instituteName}
                </option>
              ))}
            </Form.Select>
            {!isLoading && institutes.length === 0 && (
              <div className="text-muted mt-2" style={{ fontSize: "0.82rem" }}>
                No institute is in your scope. Ask an administrator to allot you one.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ minHeight: 460 }}>
          {isLoading && (
            <div className="text-center py-5"><Spinner animation="border" /></div>
          )}

          {!isLoading && selectedInstitute === "" && (
            <div className="text-muted text-center py-5">
              <i className="bi bi-people fs-1 mb-2 opacity-50 d-block" />
              Pick an institute above to manage its groups.
              <div className="mt-1" style={{ fontSize: "0.82rem" }}>
                A group can mix any classes and sections — it is independent of them.
              </div>
            </div>
          )}

          {!isLoading && selectedInstitute !== "" && (
            <GroupManagerPanel
              key={selectedInstitute}
              instituteCode={Number(selectedInstitute)}
              listMaxHeight={520}
              rowsMaxHeight={440}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupManagementPage;
