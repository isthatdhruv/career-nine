import React, { useMemo, useState } from "react";

type Student = {
  id: string;
  name: string;
  class: string;
  assessment: "Subject Navigator" | "Career Navigator" | "Insight Navigator";
  status: "completed" | "pending" | "not-done";
  avatar: string;
};

type GroupedStudent = {
  id: string;
  name: string;
  class: string;
  groupName: string;
  assessment: string;
  status: string;
  avatar: string;
};

export default function Users() {
  const [query, setQuery] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  
  // Group management states
  const [selectedGroup, setSelectedGroup] = useState("");
  const [checkedStudents, setCheckedStudents] = useState<string[]>([]);
  const [groupedStudents, setGroupedStudents] = useState<GroupedStudent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [customGroups, setCustomGroups] = useState<string[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customGroupName, setCustomGroupName] = useState("");

  const allStudents: Student[] = [
    {
      id: "1",
      name: "Aarav Sharma",
      class: "Class 10A",
      assessment: "Career Navigator",
      status: "completed",
      avatar: "AS",
    },
    {
      id: "2",
      name: "Priya Verma",
      class: "Class 10B",
      assessment: "Insight Navigator",
      status: "pending",
      avatar: "PV",
    },
    {
      id: "3",
      name: "Rohit Mehta",
      class: "Class 10A",
      assessment: "Subject Navigator",
      status: "completed",
      avatar: "RM",
    },
    {
      id: "4",
      name: "Sneha Kapoor",
      class: "Class 11C",
      assessment: "Career Navigator",
      status: "not-done",
      avatar: "SK",
    },
    {
      id: "5",
      name: "Karan Singh",
      class: "Class 10B",
      assessment: "Insight Navigator",
      status: "completed",
      avatar: "KS",
    },
    {
      id: "6",
      name: "Ananya Patel",
      class: "Class 11A",
      assessment: "Career Navigator",
      status: "pending",
      avatar: "AP",
    },
    {
      id: "7",
      name: "Vikram Reddy",
      class: "Class 10C",
      assessment: "Subject Navigator",
      status: "completed",
      avatar: "VR",
    },
  ];

  // Get unique group names from existing grouped students
  const groupNames = useMemo(() => {
    const existingGroups = Array.from(new Set(groupedStudents.map(s => s.groupName))).sort();
    return [...existingGroups, ...customGroups.filter(g => !existingGroups.includes(g))];
  }, [groupedStudents, customGroups]);

  // Get ungrouped students (not in groupedStudents)
  const ungroupedStudents = useMemo(() => {
    const groupedIds = new Set(groupedStudents.map(s => s.id));
    return allStudents.filter(s => !groupedIds.has(s.id));
  }, [groupedStudents]);

  // Handle checkbox toggle for students in the table
  const handleCheckboxToggle = (studentId: string) => {
    setCheckedStudents(prev => {
      if (prev.includes(studentId)) {
        return prev.filter(id => id !== studentId);
      } else {
        return [...prev, studentId];
      }
    });
  };

  // Handle group selection change
  const handleGroupChange = (value: string) => {
    if (value === "others") {
      setShowCustomInput(true);
      setSelectedGroup("");
    } else {
      setShowCustomInput(false);
      setSelectedGroup(value);
      setCustomGroupName("");
    }
  };

  // Open modal when Add Group is clicked
  const handleOpenModal = () => {
    if (checkedStudents.length === 0) {
      alert("Please select at least one student from the table");
      return;
    }
    setShowModal(true);
  };

  // Submit grouping
  const handleSubmitGrouping = () => {
    let finalGroupName = selectedGroup;

    // If custom input is shown, use the custom group name
    if (showCustomInput) {
      if (!customGroupName.trim()) {
        alert("Please enter a group name");
        return;
      }
      finalGroupName = customGroupName.trim();
      
      // Add to custom groups if not already exists
      if (!customGroups.includes(finalGroupName) && !groupNames.includes(finalGroupName)) {
        setCustomGroups(prev => [...prev, finalGroupName]);
      }
    } else if (!selectedGroup) {
      alert("Please select a group");
      return;
    }

    const newGroupedStudents = allStudents
      .filter(s => checkedStudents.includes(s.id))
      .map(s => ({
        id: s.id,
        name: s.name,
        class: s.class,
        groupName: finalGroupName,
        assessment: s.assessment,
        status: s.status,
        avatar: s.avatar,
      }));
    
    setGroupedStudents(prev => [...prev, ...newGroupedStudents]);
    
    // Reset states
    setSelectedGroup("");
    setCustomGroupName("");
    setShowCustomInput(false);
    setCheckedStudents([]);
    setShowModal(false);
  };

  const filteredStudents = useMemo(() => {
    return ungroupedStudents.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.class.toLowerCase().includes(query.toLowerCase());

      const matchesStatus = showActiveOnly
        ? s.status === "completed"
        : true;

      return matchesSearch && matchesStatus;
    });
  }, [ungroupedStudents, query, showActiveOnly]);

  // Get checked students details for display in modal
  const checkedStudentsDetails = useMemo(() => {
    return ungroupedStudents.filter(s => checkedStudents.includes(s.id));
  }, [checkedStudents, ungroupedStudents]);

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

        .form-check-input {
          border: 2px solid #3f4254 !important;
          cursor: pointer;
        }

        .form-check-input:checked {
          background-color: #3699ff !important;
          border-color: #3699ff !important;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1050;
        }

        .modal-content-custom {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 600px;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }

        .modal-header-custom {
          padding: 20px 24px;
          border-bottom: 1px solid #eff2f5;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .modal-body-custom {
          padding: 24px;
        }

        .modal-footer-custom {
          padding: 16px 24px;
          border-top: 1px solid #eff2f5;
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #7e8299;
          line-height: 1;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }

        .close-btn:hover {
          background: #f5f8fa;
          color: #181c32;
        }

        .selected-student-item {
          padding: 12px;
          background: #f9fafb;
          border: 1px solid #eff2f5;
          border-radius: 8px;
          margin-bottom: 8px;
        }

        .btn {
          padding: 8px 16px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-success {
          background: #50cd89;
          color: white;
        }

        .btn-success:hover {
          background: #47be7d;
        }

        .btn-primary {
          background: #3699ff;
          color: white;
        }

        .btn-primary:hover {
          background: #187de4;
        }

        .btn-light {
          background: #f5f8fa;
          color: #7e8299;
        }

        .btn-light:hover {
          background: #e4e6ef;
        }

        .btn-light-primary {
          background: #e1f0ff;
          color: #3699ff;
        }

        .btn-light-primary:hover {
          background: #c9e5ff;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 13px;
        }

        .form-select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e4e6ef;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
        }

        .form-select:focus {
          outline: none;
          border-color: #3699ff;
          box-shadow: 0 0 0 3px rgba(54, 153, 255, 0.1);
        }

        .form-control {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e4e6ef;
          border-radius: 6px;
          font-size: 14px;
        }

        .form-control:focus {
          outline: none;
          border-color: #3699ff;
          box-shadow: 0 0 0 3px rgba(54, 153, 255, 0.1);
        }

        .form-label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          color: #181c32;
        }

        .fw-semibold {
          font-weight: 600;
        }

        .badge {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
        }

        .bg-light {
          background: #f5f8fa !important;
        }

        .text-dark {
          color: #181c32 !important;
        }

        .text-muted {
          color: #7e8299;
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
              onClick={handleOpenModal}
            >
              + Add Group
            </button>
          </div>
        </div>

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
                      <th>Allotted Assessment</th>
                      <th className="text-center">Status</th>
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
                        <td>{student.assessment}</td>
                        <td className="text-center">
                          <span className={`status-pill status-${student.status}`}>
                            {student.status.replace("-", " ").toUpperCase()}
                          </span>
                        </td>
                        <td className="text-center">
                          <button className="btn btn-sm btn-light-primary">
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
              style={{
                padding: '8px 12px',
                border: '1px solid #e4e6ef',
                borderRadius: '6px',
                fontSize: '14px',
                width: '300px'
              }}
            />
          </div>
        </div>

        {/* UNGROUPED STUDENTS TABLE */}
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
                    <th>Allotted Assessment</th>
                    <th className="text-center">Status</th>
                    <th className="text-center">Dashboard</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((student) => (
                      <tr key={student.id}>
                        <td>
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={checkedStudents.includes(student.id)}
                            onChange={() => handleCheckboxToggle(student.id)}
                          />
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-3">
                            <div className="member-avatar">{student.avatar}</div>
                            <span className="fw-semibold">{student.name}</span>
                          </div>
                        </td>
                        <td>{student.assessment}</td>
                        <td className="text-center">
                          <span className={`status-pill status-${student.status}`}>
                            {student.status.replace("-", " ").toUpperCase()}
                          </span>
                        </td>
                        <td className="text-center">
                          <button className="btn btn-sm btn-light-primary">
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center text-muted" style={{ padding: '40px' }}>
                        {ungroupedStudents.length === 0 
                          ? "All students have been grouped" 
                          : "No students found matching your search"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content-custom" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-custom">
              <h5 className="mb-0">Add Students to Group</h5>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            
            <div className="modal-body-custom">
              {/* Group Selection Dropdown */}
              <div className="mb-4">
                <label className="form-label fw-semibold">Group Name</label>
                <select
                  className="form-select"
                  value={showCustomInput ? "others" : selectedGroup}
                  onChange={(e) => handleGroupChange(e.target.value)}
                >
                  <option value="">Choose a group...</option>
                  {groupNames.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                  <option value="others">Others</option>
                </select>
              </div>

              {/* Custom Group Name Input */}
              {showCustomInput && (
                <div className="mb-4">
                  <label className="form-label fw-semibold">Enter Group Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter custom group name..."
                    value={customGroupName}
                    onChange={(e) => setCustomGroupName(e.target.value)}
                    autoFocus
                  />
                </div>
              )}

              {/* Selected Students */}
              <div>
                <label className="form-label fw-semibold">
                  Selected Students ({checkedStudentsDetails.length})
                </label>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {checkedStudentsDetails.map((student) => (
                    <div key={student.id} className="selected-student-item">
                      <div className="d-flex align-items-center gap-3">
                        <div className="member-avatar" style={{ width: '36px', height: '36px', fontSize: '13px' }}>
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
            </div>

            <div className="modal-footer-custom">
              <button
                className="btn btn-light"
                onClick={() => {
                  setShowModal(false);
                  setSelectedGroup("");
                  setCustomGroupName("");
                  setShowCustomInput(false);
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmitGrouping}
              >
                Submit Grouping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}