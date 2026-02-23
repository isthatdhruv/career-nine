// CollegeAssignRolePage.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type Group = {
  id: string;
  groupName: string;
  assessmentName:
    | "Insight Navigator"
    | "Career Navigator"
    | "Subject Navigator";
  startDate: string;
  endDate: string;
  students: string[];
  admin: string;
};

export default function Users() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  /* -------------------- DUMMY DATA -------------------- */
  const groups: Group[] = [
    {
      id: "g1",
      groupName: "Group A",
      assessmentName: "Insight Navigator",
      startDate: "01 Aug 2024",
      endDate: "30 Aug 2024",
      students: ["Aarav Sharma", "Rohit Mehta", "Karan Singh"],
      admin: "Rahul Verma",
    },
    {
      id: "g2",
      groupName: "Group B",
      assessmentName: "Career Navigator",
      startDate: "05 Aug 2024",
      endDate: "05 Sep 2024",
      students: ["Priya Verma", "Ananya Gupta"],
      admin: "Neha Sharma",
    },
    {
      id: "g3",
      groupName: "Group C",
      assessmentName: "Subject Navigator",
      startDate: "10 Aug 2024",
      endDate: "10 Sep 2024",
      students: ["Sneha Kapoor", "Rohan Malhotra"],
      admin: "Amit Khanna",
    },
  ];

  const filteredGroups = useMemo(() => {
    return groups.filter((group) =>
      group.groupName.toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

  return (
    <div className="container-fluid py-4">
      <style>{`
        .team-page .card { border-radius: 10px; overflow: hidden; }
        .team-header {
          display:flex;
          align-items:center;
          justify-content: space-between;
          gap:12px;
          padding: 8px 6px;
        }

        .metronic-table thead th {
          font-weight: 600;
          padding: 16px 24px;
          font-size: 14px;
          background: #fafafb;
          border-bottom: 1px solid #eff2f5;
        }

        .metronic-table tbody td {
          padding: 16px 24px;
          border-bottom: 1px solid #eff2f5;
        }

        .metronic-table thead th:first-child,
        .metronic-table tbody td:first-child {
          padding-left: 28px !important;
        }

        @media (max-width: 576px) {
          .metronic-table thead th:first-child,
          .metronic-table tbody td:first-child {
            padding-left: 20px !important;
          }
        }

        /* Assessment badge */
        .assessment-badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .assessment-insight {
          background: #e7f1ff;
          color: #3699ff;
        }

        .assessment-career {
          background: #e8fff3;
          color: #0bb783;
        }

        .assessment-subject {
          background: #f3f0ff;
          color: #8950fc;
        }
      `}</style>

      <div className="team-page">
        {/* Header with ADD GROUP button */}
        <div className="team-header mb-4">
          <div>
            <h3 className="mb-0">Group Information</h3>
            <small className="text-muted">
              Overview of all groups with the students included in it.
            </small>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => navigate("/school/group/create")}
          >
            + Add Group
          </button>
        </div>

        {/* Search */}
        <div className="d-flex align-items-center mb-3">
          <input
            className="form-control form-control-sm"
            placeholder="Search groups"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="card shadow-sm">
          <div className="card-body p-0">
            <div className="table-responsive metronic-table">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Group Name</th>
                    <th>Assessment name</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Student List</th>
                    <th>Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.map((group) => (
                    <tr key={group.id}>
                      <td className="fw-semibold">{group.groupName}</td>

                      {/* Assessment badge */}
                      <td>
                        <span
                          className={`assessment-badge ${
                            group.assessmentName === "Insight Navigator"
                              ? "assessment-insight"
                              : group.assessmentName === "Career Navigator"
                              ? "assessment-career"
                              : "assessment-subject"
                          }`}
                        >
                          {group.assessmentName}
                        </span>
                      </td>

                      <td>{group.startDate}</td>
                      <td>{group.endDate}</td>

                      {/* Student list (view-only dropdown) */}
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value=""
                          onChange={() => {}}
                        >
                          <option value="" disabled>
                            View students
                          </option>
                          {group.students.map((student, index) => (
                            <option key={index} disabled>
                              {student}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Admin */}
                      <td className="fw-semibold text-gray-700">
                        {group.admin}
                      </td>
                    </tr>
                  ))}

                  {filteredGroups.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-4">
                        No groups found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
