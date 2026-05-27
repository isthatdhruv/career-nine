import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "react-query";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { useMeasuredQualityTypes, lookupKeys } from "../../lib/queries/lookups";
import { ReadMeasuredQualitiesData } from "../MeasuredQualities/API/Measured_Qualities_APIs";
import { MeasuredQualityTypesTable } from "./components";
import MeasuredQualityTypesRecycleBinModal from "./components/MeasuredQualityTypesRecycleBinModal";
import PageHeader from "../../components/PageHeader";

const MeasuredQualityTypesPage = () => {
  const { data: measuredQualityTypesData = [], isLoading: loading } = useMeasuredQualityTypes<any>();
  const queryClient = useQueryClient();
  const [measuredQualities, setMeasuredQualities] = useState<any[]>([]);
  const [selectedQualityFilter, setSelectedQualityFilter] = useState<string>("");
  const [pageLoading, setPageLoading] = useState(["false"]);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMeasuredQualities = async () => {
      try {
        const response = await ReadMeasuredQualitiesData();
        setMeasuredQualities(response.data);
      } catch (error) {
        console.error("Error fetching measured qualities:", error);
      }
    };
    fetchMeasuredQualities();
  }, []);

  useEffect(() => {
    if (pageLoading[0] === "true") {
      queryClient.invalidateQueries(lookupKeys.measuredQualityTypes);
      setPageLoading(["false"]);
    }
  }, [pageLoading, queryClient]);

  const filteredData = useMemo(() => {
    if (!selectedQualityFilter) return measuredQualityTypesData;
    if (selectedQualityFilter === "unassigned") {
      return measuredQualityTypesData.filter((item: any) => !item.measuredQuality);
    }
    return measuredQualityTypesData.filter(
      (item: any) =>
        item.measuredQuality &&
        String(item.measuredQuality.measuredQualityId) === selectedQualityFilter
    );
  }, [measuredQualityTypesData, selectedQualityFilter]);

  return (
    <div className="ph-page">
      <PageHeader
        icon={<i className='bi bi-bookmarks' />}
        title="Measured Quality Types"
        subtitle={<><strong>{filteredData.length}</strong> quality types</>}
        actions={[
          {
            label: "Add Quality Type",
            iconClass: "bi-plus-lg",
            onClick: () => navigate("/measured-quality-types/create"),
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
          <div className="card-header border-0 pt-6">
            <div className="card-toolbar ms-auto">
              <FormControl sx={{ minWidth: 220 }} size="small">
                <InputLabel id="quality-filter-label">Filter by Measured Quality</InputLabel>
                <Select
                  labelId="quality-filter-label"
                  value={selectedQualityFilter}
                  onChange={(e) => setSelectedQualityFilter(e.target.value)}
                  label="Filter by Measured Quality"
                >
                  <MenuItem value="">
                    <em>All</em>
                  </MenuItem>
                  <MenuItem value="unassigned">
                    <em>Unassigned</em>
                  </MenuItem>
                  {measuredQualities.map((quality: any) => (
                    <MenuItem key={quality.measuredQualityId} value={String(quality.measuredQualityId)}>
                      {quality.measuredQualityName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          </div>
        )}

        {!loading && (
          <div className="card-body pt-5">
            <MeasuredQualityTypesTable
              data={filteredData}
              setLoading={setLoading}
              setPageLoading={setPageLoading}
            />
          </div>
        )}
      </div>

      <MeasuredQualityTypesRecycleBinModal
        show={showRecycleBin}
        onHide={() => setShowRecycleBin(false)}
        onRestoreComplete={() => {
          queryClient.invalidateQueries(lookupKeys.measuredQualityTypes);
        }}
      />
    </div>
  );
};

export default MeasuredQualityTypesPage;
