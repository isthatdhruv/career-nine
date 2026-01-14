import React, { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

type Student = {
  id: string;
  name: string;
  class: string;
  groupName: string;
  assessment: "Subject Navigator" | "Career Navigator" | "Insight Navigator";
  status: "completed" | "pending" | "not-done";
  avatar: string;
};

type GroupedStudent = {
  id: string;
  name: string;
  class: string;
  groupName: string;
  avatar: string;
};

export default function Users() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const [query, setQuery] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  
  // Group management states
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [groupedStudents, setGroupedStudents] = useState<GroupedStudent[]>([]);
  const [showGroupForm, setShowGroupForm] = useState(false);

  const students: Student[] = [
    {
      id: "1",
      name: "Aarav Sharma",
      class: "Class 10A",
      groupName: "Group A",
      assessment: "Career Navigator",
      status: "completed",
      avatar: "AS",
    },
    {
      id: "2",
      name: "Priya Verma",
      class: "Class 10B",
      groupName: "Group B",
      assessment: "Insight Navigator",
      status: "pending",
      avatar: "PV",
    },
    {
      id: "3",
      name: "Rohit Mehta",
      class: "Class 10A",
      groupName: "Group A",
      assessment: "Subject Navigator",
      status: "completed",
      avatar: "RM",
    },
    {
      id: "4",
      name: "Sneha Kapoor",
      class: "Class 11C",
      groupName: "Group C",
      assessment: "Career Navigator",
      status: "not-done",
      avatar: "SK",
    },
    {
      id: "5",
      name: "Karan Singh",
      class: "Class 10B",
      groupName: "Group B",
      assessment: "Insight Navigator",
      status: "completed",
      avatar: "KS",
    },
    {
      id: "6",
      name: "Ananya Patel",
      class: "Class 11A",
      groupName: "Group A",
      assessment: "Career Navigator",
      status: "pending",
      avatar: "AP",
    },
    {
      id: "7",
      name: "Vikram Reddy",
      class: "Class 10C",
      groupName: "Group C",
      assessment: "Subject Navigator",
      status: "completed",
      avatar: "VR",
    },
  ];

  // Get unique group names
  const groupNames = useMemo(() => {
    return Array.from(new Set(students.map(s => s.groupName))).sort();
  }, []);

  // Get students for selected group
  const availableStudents = useMemo(() => {
    if (!selectedGroup) return [];
    return students.filter(s => s.groupName === selectedGroup);
  }, [selectedGroup]);

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudents(prev => {
      if (prev.includes(studentId)) {
        return prev.filter(id => id !== studentId);
      } else {
        return [...prev, studentId];
      }
    });
  };

  const handleAddGroup = () => {
    if (selectedGroup && selectedStudents.length > 0) {
      const newGroupedStudents = students
        .filter(s => selectedStudents.includes(s.id))
        .map(s => ({
          id: s.id,
          name: s.name,
          class: s.class,
          groupName: selectedGroup,
          avatar: s.avatar,
        }));
      
      setGroupedStudents(prev => [...prev, ...newGroupedStudents]);
      setSelectedGroup("");
      setSelectedStudents([]);
      setShowGroupForm(false);
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.groupName.toLowerCase().includes(query.toLowerCase());

      const matchesStatus = showActiveOnly
        ? s.status === "completed"
        : true;

      return matchesSearch && matchesStatus;
    });
  }, [query, showActiveOnly]);

  return (
    <div className="container-fluid py-4">
      <style>{`
        .team-page .card { border-radius: 10px; overflow: hidden; }

        .team-header {
          display:flex;
          align-items:center;
          justify-content: space-between;
          gap:12px;
        }

        .member-avatar {
          width:40px;
          height:40px;
          border-radius:50%;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          color:#fff;
          font-weight:600;
          background:#3699ff;
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

        .status-pill {
          padding: 5px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .status-completed { background: #e8fff3; color: #0bb783; }
        .status-pending { background: #fff8dd; color: #ffa800; }
        .status-not-done { background: #f8d7da; color: #d33; }

        .group-form-card {
          background: #f9fafb;
          border: 1px solid #eff2f5;
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .student-checkbox-item {
          padding: 10px;
          border: 1px solid #eff2f5;
          border-radius: 6px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .student-checkbox-item:hover {
          background: #f9fafb;
        }

        .student-checkbox-item.selected {
          background: #e1f0ff;
          border-color: #3699ff;
        }

        .form-check-input {
          border: 2px solid #3f4254 !important;
        }

        .form-check-input:checked {
          background-color: #3699ff !important;
          border-color: #3699ff !important;
        }
      `}</style>

      <div className="team-page">
        {/* HEADER */}
        <div className="team-header mb-4">
          <div>
            <h3 className="mb-0">Students List</h3>
            <small className="text-muted">
              Overview of all students enrolled in it.
            </small>
          </div>

          {/* GROUP BUTTONS */}
          <div className="d-flex gap-2">
            <button
              className="btn btn-sm btn-success"
              onClick={() => setShowGroupForm(!showGroupForm)}
            >
              + Add Group
            </button>
          </div>
        </div>

        {/* GROUP FORM */}
        {showGroupForm && (
          <div className="group-form-card">
            <h5 className="mb-3">Add Students to Group</h5>
            
            {/* Group Selection Dropdown */}
            <div className="mb-3">
              <label className="form-label fw-semibold">Select Group</label>
              <select
                className="form-select"
                value={selectedGroup}
                onChange={(e) => {
                  setSelectedGroup(e.target.value);
                  setSelectedStudents([]);
                }}
              >
                <option value="">Choose a group...</option>
                {groupNames.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </div>

            {/* Student Selection */}
            {selectedGroup && (
              <div className="mb-3">
                <label className="form-label fw-semibold">Select Students</label>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {availableStudents.map((student) => (
                    <div
                      key={student.id}
                      className={`student-checkbox-item ${
                        selectedStudents.includes(student.id) ? 'selected' : ''
                      }`}
                      onClick={() => handleStudentToggle(student.id)}
                    >
                      <div className="d-flex align-items-center gap-3">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={selectedStudents.includes(student.id)}
                          onChange={() => handleStudentToggle(student.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="member-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                          {student.avatar}
                        </div>
                        <div>
                          <div className="fw-semibold">{student.name}</div>
                          <small className="text-muted">{student.class}</small>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Button */}
            {selectedGroup && selectedStudents.length > 0 && (
              <div className="d-flex justify-content-end gap-2">
                <button
                  className="btn btn-sm btn-light"
                  onClick={() => {
                    setShowGroupForm(false);
                    setSelectedGroup("");
                    setSelectedStudents([]);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={handleAddGroup}
                >
                  Add ({selectedStudents.length} student{selectedStudents.length > 1 ? 's' : ''})
                </button>
              </div>
            )}
          </div>
        )}

        {/* GROUPED STUDENTS TABLE */}
        {groupedStudents.length > 0 && (
          <div className="card shadow-sm mb-4">
            <div className="card-header bg-light">
              <h5 className="mb-0">Grouped Students</h5>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive metronic-table">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Class</th>
                      <th>Group Name</th>
                      <th className="text-center">Dashboard</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedStudents.map((student) => (
                      <tr key={student.id}>
                        <td>
                          <div className="d-flex align-items-center gap-3">
                            <div className="member-avatar">{student.avatar}</div>
                            <span className="fw-semibold">{student.name}</span>
                          </div>
                        </td>
                        <td>{student.class}</td>
                        <td>
                          <span className="badge bg-light text-dark">
                            {student.groupName}
                          </span>
                        </td>
                        <td className="text-center">
                          <button
                            className="btn btn-sm btn-light-primary"
                            onClick={() =>
                              navigate(`/students/${student.id}/dashboard`)
                            }
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="d-flex align-items-center justify-content-between mb-3 gap-3">
          <div className="d-flex align-items-center gap-2">
            <input
              className="form-control form-control-sm"
              placeholder="Search students"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* ALL STUDENTS TABLE */}
        <div className="card shadow-sm">
          <div className="card-header bg-light">
            <h5 className="mb-0 px-2">All Students</h5>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive metronic-table">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}></th>
                    <th>Student Name</th>
                    <th>Group Name</th>
                    <th>Allotted Assessment</th>
                    <th className="text-center">Status</th>
                    <th className="text-center">Dashboard</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <input
                          type="checkbox"
                          className="form-check-input"
                        />
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-3">
                          <div className="member-avatar">{student.avatar}</div>
                          <span className="fw-semibold">{student.name}</span>
                        </div>
                      </td>
                      <td>{student.groupName}</td>
                      <td>{student.assessment}</td>
                      <td className="text-center">
                        <span className={`status-pill status-${student.status}`}>
                          {student.status.replace("-", " ").toUpperCase()}
                        </span>
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-sm btn-light-primary"
                          onClick={() =>
                            navigate(`/students/${student.id}/dashboard`)
                          }
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}