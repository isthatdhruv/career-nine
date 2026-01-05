/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useState, useMemo } from "react";
import { KTSVG, toAbsoluteUrl } from "../../../../_metronic/helpers";
import StudentUploadModal from "./StudentUploadModal";

type Props = {
  className: string;
};

interface Student {
  id: number;
  name: string;
  role: string;
  skills: string;
  company: string;
  companyDesc: string;
  status: "Approved" | "In Progress" | "Success" | "Rejected";
  progress: number; // 0-100
  avatar: string;
}

const INITIAL_STUDENTS: Student[] = [
  {
    id: 1,
    name: "Brad Simmons",
    role: "Movie Creator",
    skills: "React, HTML",
    company: "Intertico",
    companyDesc: "Web, UI/UX Design",
    status: "Approved",
    progress: 50,
    avatar: "/media/svg/brand-logos/plurk.svg",
  },
  {
    id: 2,
    name: "Popular Authors",
    role: "Most Successful",
    skills: "Python, MySQL",
    company: "Agoda",
    companyDesc: "Houses & Hotels",
    status: "In Progress",
    progress: 70,
    avatar: "/media/svg/brand-logos/telegram.svg",
  },
  {
    id: 3,
    name: "New Users",
    role: "Awesome Users",
    skills: "Laravel, Metronic",
    company: "RoadGee",
    companyDesc: "Transportation",
    status: "Success",
    progress: 60,
    avatar: "/media/svg/brand-logos/vimeo.svg",
  },
  {
    id: 4,
    name: "Active Customers",
    role: "Movie Creator",
    skills: "AngularJS, C#",
    company: "The Hill",
    companyDesc: "Insurance",
    status: "Rejected",
    progress: 50,
    avatar: "/media/svg/brand-logos/bebo.svg",
  },
  {
    id: 5,
    name: "Bestseller Theme",
    role: "Best Customers",
    skills: "ReactJS, Ruby",
    company: "RoadGee",
    companyDesc: "Art Director",
    status: "In Progress",
    progress: 90,
    avatar: "/media/svg/brand-logos/kickstarter.svg",
  },
];

const StudentList: React.FC<Props> = ({ className }) => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Handle file upload adding new students (simple mapping for demo)
  const handleUpload = (rows: any[][]) => {
    // In a real app, parse columns here. For now, we just log it.
    console.log("Uploaded rows:", rows);
    setShowUploadModal(false);
  };

  // Filter students based on search
  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students;
    const lower = searchTerm.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(lower) ||
        s.role.toLowerCase().includes(lower) ||
        s.skills.toLowerCase().includes(lower)
    );
  }, [students, searchTerm]);

  // Checkbox Logic
  const allSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedIds.has(s.id));

  const isIndeterminate =
    filteredStudents.some((s) => selectedIds.has(s.id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      // Unselect all visible
      const newSet = new Set(selectedIds);
      filteredStudents.forEach((s) => newSet.delete(s.id));
      setSelectedIds(newSet);
    } else {
      // Select all visible
      const newSet = new Set(selectedIds);
      filteredStudents.forEach((s) => newSet.add(s.id));
      setSelectedIds(newSet);
    }
  };

  const toggleRow = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "badge-light-success";
      case "In Progress":
        return "badge-light-warning";
      case "Success":
        return "badge-light-primary";
      case "Rejected":
        return "badge-light-danger";
      default:
        return "badge-light-primary";
    }
  };

  return (
    <div className={`card ${className}`}>
      {/* begin::Header */}
      <div className="card-header border-0 pt-5">
        <h3 className="card-title align-items-start flex-column">
          <span className="card-label fw-bold fs-3 mb-1">Student List</span>
          <span className="text-muted mt-1 fw-semibold fs-7">
            {students.length} students total
          </span>
        </h3>
        <div className="card-toolbar d-flex gap-3">
          {/* Search Bar */}
          <div className="d-flex align-items-center position-relative my-1">
            <span className="svg-icon svg-icon-1 position-absolute ms-4">
              <KTSVG
                path="/media/icons/duotune/general/gen021.svg"
                className="svg-icon-1"
              />
            </span>
            <input
              type="text"
              data-kt-user-table-filter="search"
              className="form-control form-control-solid w-250px ps-14"
              placeholder="Search students"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn btn-sm btn-light-primary fw-bold"
            onClick={() => setShowUploadModal(true)}
          >
            <KTSVG
              path="/media/icons/duotune/arrows/arr075.svg"
              className="svg-icon-2"
            />
            Upload List
          </button>
        </div>
      </div>
      {/* end::Header */}

      {/* begin::Body */}
      <div className="card-body py-3">
        <div className="table-responsive">
          <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
            <thead>
              <tr className="fw-bold text-muted">
                <th className="w-25px">
                  <div className="form-check form-check-sm form-check-custom form-check-solid">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={allSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = isIndeterminate;
                      }}
                      onChange={toggleAll}
                    />
                  </div>
                </th>
                <th className="min-w-150px">Student Info</th>
                <th className="min-w-140px">Skillset</th>
                <th className="min-w-120px">Status</th>
                <th className="min-w-100px text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <div className="form-check form-check-sm form-check-custom form-check-solid">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={selectedIds.has(student.id)}
                          onChange={() => toggleRow(student.id)}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center">
                        <div className="symbol symbol-45px me-5">
                          <img src={toAbsoluteUrl(student.avatar)} alt="" />
                        </div>
                        <div className="d-flex justify-content-start flex-column">
                          <a
                            href="#"
                            className="text-dark fw-bold text-hover-primary fs-6"
                          >
                            {student.name}
                          </a>
                          <span className="text-muted fw-semibold text-muted d-block fs-7">
                            {student.role}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="text-dark fw-bold d-block fs-6">
                        {student.skills}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${statusColor(student.status)}`}>
                        {student.status}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex justify-content-end flex-shrink-0">
                        <a
                          href="#"
                          className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1"
                        >
                          <KTSVG
                            path="/media/icons/duotune/general/gen019.svg"
                            className="svg-icon-3"
                          />
                        </a>
                        <a
                          href="#"
                          className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1"
                        >
                          <KTSVG
                            path="/media/icons/duotune/art/art005.svg"
                            className="svg-icon-3"
                          />
                        </a>
                        <a
                          href="#"
                          className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm"
                        >
                          <KTSVG
                            path="/media/icons/duotune/general/gen027.svg"
                            className="svg-icon-3"
                          />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center">
                    No students found using filter "{searchTerm}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* end::Body */}

      <StudentUploadModal
        show={showUploadModal}
        onHide={() => setShowUploadModal(false)}
        onUpload={handleUpload}
      />
    </div>
  );
};

export { StudentList };
