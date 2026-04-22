import { useEffect, useState } from "react";
import { ReadCollegeData } from "./API/College_APIs";
import CollegeCreateModal from "./components/CollegeCreateModal";
import CollegeTable from "./components/CollegeTable";
import StudentUploadModal from "./components/StudentUploadModal";
import InstituteRecycleBinModal from "./components/InstituteRecycleBinModal";
import PageHeader from "../../components/PageHeader";

const CollegePage = () => {
  const [modalShowCreate, setModalShowCreate] = useState(false);
  const [collegeData, setCollegeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(["false"]);
  const [showStudentUpload, setShowStudentUpload] = useState(false);
  const [selectedCollegeForUpload, setSelectedCollegeForUpload] = useState<any>(null);
  const [showRecycleBin, setShowRecycleBin] = useState(false);

  useEffect(() => {
    setLoading(true);
    try {
      ReadCollegeData().then((data) => {
        setCollegeData(data.data);
        setLoading(false);
      });
    } catch (error) {
      console.error(error);
      // window.location.replace("/error");
    }
  }, [pageLoading]);

  const openUploadForCollege = (college: any) => {
    setSelectedCollegeForUpload(college);
    setShowStudentUpload(true);
  };

  const onUploadComplete = () => {
    // trigger refresh
    setShowStudentUpload(false);
    setSelectedCollegeForUpload(null);
    setPageLoading([String(Date.now())]);
  };

  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className='bi bi-buildings' />}
        title="Institutes List"
        subtitle={<><strong>{collegeData.length}</strong> institutes</>}
        actions={[
          {
            label: "Add Institute",
            iconClass: "bi-plus-lg",
            onClick: () => setModalShowCreate(true),
            variant: "primary",
          },
          {
            label: "Recycle Bin",
            iconClass: "bi-trash",
            onClick: () => setShowRecycleBin(true),
            variant: "danger",
          },
        ]}
      />

      <div className="card">
        {loading && (
          <span className="indicator-progress m-5" style={{ display: "block" }}>
            Please wait...{" "}
            <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
          </span>
        )}

        {!loading && (
          <div className="card-body pt-5">
            <CollegeTable
              data={collegeData}
              setLoading={setLoading}
              setPageLoading={setPageLoading}
              onUploadClick={openUploadForCollege}
            />
          </div>
        )}
      </div>

      <CollegeCreateModal
        setPageLoading={setPageLoading}
        show={modalShowCreate}
        onHide={() => setModalShowCreate(false)}
      />

      <StudentUploadModal
        show={showStudentUpload}
        onHide={() => setShowStudentUpload(false)}
        college={selectedCollegeForUpload}
        onUploaded={onUploadComplete}
      />

      <InstituteRecycleBinModal
        show={showRecycleBin}
        onHide={() => setShowRecycleBin(false)}
        onRestoreComplete={() => setPageLoading([String(Date.now())])}
      />
    </div>
  );
};

export default CollegePage;
