import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReadMeasuredQualitiesData } from "./API/Measured_Qualities_APIs";
import { MeasuredQualitiesTable } from "./components";
import MeasuredQualitiesRecycleBinModal from "./components/MeasuredQualitiesRecycleBinModal";
import PageHeader from "../../components/PageHeader";

const MeasuredQualitiesPage = () => {
  const [measuredQualitiesData, setMeasuredQualitiesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(["false"]);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const navigate = useNavigate();

  const fetchMeasuredQualities = async () => {
    setLoading(true);
    try {
      const response = await ReadMeasuredQualitiesData();
      setMeasuredQualitiesData(response.data);
    } catch (error) {
      console.error("Failed to fetch measured qualities:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
      const fetchSections = async () => {
        setLoading(true);
        try {
          const response = await ReadMeasuredQualitiesData();
          setSections(response.data);
        } catch (error) {
          console.error("Error fetching sections:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchSections();
    }, []);

  useEffect(() => {
    fetchMeasuredQualities();

    if (pageLoading[0] === "true") {
      setPageLoading(["false"]);
    }
  }, [pageLoading[0]]);


  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className='bi bi-shield-check' />}
        title="Measured Qualities"
        subtitle={<><strong>{measuredQualitiesData.length}</strong> qualities</>}
        actions={[
          {
            label: "Add Measured Quality",
            iconClass: "bi-plus-lg",
            onClick: () => navigate("/measured-qualities/create"),
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
            <MeasuredQualitiesTable
              data={measuredQualitiesData}
              setLoading={setLoading}
              setPageLoading={setPageLoading}
            />
          </div>
        )}
      </div>

      <MeasuredQualitiesRecycleBinModal
        show={showRecycleBin}
        onHide={() => setShowRecycleBin(false)}
        onRestoreComplete={() => {
          fetchMeasuredQualities();
        }}
      />
    </div>
  );
};

export default MeasuredQualitiesPage;
