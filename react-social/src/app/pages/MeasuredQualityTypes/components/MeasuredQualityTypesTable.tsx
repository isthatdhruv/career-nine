import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { MDBDataTableV5 } from "mdbreact";
import { useEffect, useState } from "react";
import { AiFillEdit } from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { ReadMeasuredQualitiesData } from "../../MeasuredQualities/API/Measured_Qualities_APIs";
import { DeleteMeasuredQualityTypesData } from "../API/Measured_Quality_Types_APIs";

const MeasuredQualityTypesTable = (props: {
  data: any;
  setLoading: any;
  setPageLoading: any;
}) => {
  const navigate = useNavigate();
  const [measuredQualities, setMeasuredQualities] = useState<any[]>([]);
  const [selectedQualityByType, setSelectedQualityByType] = useState<{ [key: number]: any }>({});

  useEffect(() => {
    const fetchMeasuredQualities = async () => {
      try {
        const response = await ReadMeasuredQualitiesData();
        setMeasuredQualities(response.data);
      } catch (error) {
        console.error("Error fetching MeasuredQualities:", error);
      }
    };
    fetchMeasuredQualities();
  }, []);

  // Load existing quality assignments for each type
  useEffect(() => {
    const loadExistingSelections = async () => {
      const newSelections: { [key: number]: any } = {};
      for (const type of props.data) {
        // Load the foreign key value from the backend response
        newSelections[type.measuredQualityTypeId] = type.fk_measured_qualities || '';
      }
      setSelectedQualityByType(newSelections);
    };
    if (props.data && props.data.length > 0) {
      loadExistingSelections();
    }
  }, [props.data]);

  const handleQualitySelectionChange = async (typeId: number, qualityId: any) => {
    try {
      if (qualityId) {
        // Assign the type to a quality
        // await AssignMeasuredQualityTypeToQuality(typeId, qualityId);
        console.log(`Assigned type ${typeId} to quality ${qualityId}`);
      } else {
        // Remove the type from quality (set foreign key to null)
        // await RemoveMeasuredQualityTypeFromQuality(typeId);
        console.log(`Removed type ${typeId} from its assigned quality`);
      }

      setSelectedQualityByType(prev => ({ ...prev, [typeId]: qualityId }));

    } catch (error) {
      alert('Failed to update quality assignment. Please try again.');
      // Revert the change
      setSelectedQualityByType(prev => ({ ...prev, [typeId]: selectedQualityByType[typeId] }));
    }
  };

  const datatable = {
    columns: [
      {
        label: "Quality Type Name",
        field: "measuredQualityTypeName",
        width: 300,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Quality Type Name",
        },
      },
      {
        label: "Description",
        field: "measuredQualityTypeDescription",
        sort: "asc",
        width: 150,
      },
      {
        label: "Display Name",
        field: "measuredQualityTypeDisplayName",
        sort: "asc",
        width: 150,
      },
      {
        label: "Measured Quality",
        field: "measuredQuality",
        sort: "disabled",
        width: 200,
      },
      {
        label: "Actions",
        field: "actions",
        sort: "disabled",
        width: 150,
      },
    ],

    rows: props.data.map((data: any) => ({
      measuredQualityTypeName: data.measuredQualityTypeName,
      measuredQualityTypeDescription: data.measuredQualityTypeDescription,
      measuredQualityTypeDisplayName: data.measuredQualityTypeDisplayName,
      measuredQuality: (
        <div className="text-center">
          <FormControl sx={{ m: 1, width: 200 }} size="small">
            <InputLabel id={`quality-select-label-${data.measuredQualityTypeId}`}>Select Quality</InputLabel>
            <Select
              labelId={`quality-select-label-${data.measuredQualityTypeId}`}
              value={selectedQualityByType[data.measuredQualityTypeId] || ''}
              onChange={async (e) => {
                await handleQualitySelectionChange(data.measuredQualityTypeId, e.target.value);
              }}
              label="Select Quality"
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {measuredQualities.map((quality) => (
                <MenuItem key={quality.measuredQualityId} value={quality.measuredQualityId}>
                  {quality.measuredQualityName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
      ),
      actions: (
        <>
          <button
            onClick={() => {
              navigate(`/measured-quality-types/edit/${data.measuredQualityTypeId}`, {
                state: { data },
              });
            }}
            className="btn btn-icon btn-primary btn-sm me-3"
          >
            <AiFillEdit size={16} />
          </button>
          <button
            onClick={async () => {
              props.setLoading(true);
              try {
                await DeleteMeasuredQualityTypesData(data.measuredQualityTypeId);
                props.setPageLoading(["true"]);
              } catch (error) {
                console.error("Delete failed:", error);
                alert("Failed to delete measured quality type. Please try again.");
              } finally {
                props.setLoading(false);
              }
            }}
            className="btn btn-icon btn-danger btn-sm me-3"
          >
            <UseAnimations
              animation={trash}
              size={22}
              strokeColor={"#EFF8FE"}
            />
          </button>
        </>
      ),
    })),
  };

  return (
    <>
      <MDBDataTableV5
        hover
        scrollY
        maxHeight="160vh"
        entriesOptions={[5, 20, 25]}
        entries={25}
        pagesAmount={4}
        data={datatable}
      />
    </>
  );
};

export default MeasuredQualityTypesTable;
