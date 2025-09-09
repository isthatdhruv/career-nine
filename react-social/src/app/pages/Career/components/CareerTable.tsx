import { Checkbox, FormControl, InputLabel, ListItemText, MenuItem, OutlinedInput, Select } from "@mui/material";
import { MDBDataTableV5 } from "mdbreact";
import { useEffect, useState } from "react";
import { AiFillEdit } from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import {
    AssignMeasuredQualityTypeToCareer,
    DeleteCareerData,
    GetMeasuredQualityTypesForCareer,
    ReadMeasuredQualityTypes,
    RemoveMeasuredQualityTypeFromCareer
} from "../API/Career_APIs";

const CareerTable = (props: { data: any; setLoading: any; setPageLoading: any; }) => {
  const navigate = useNavigate();
  const [selectedMeasuredQualityTypesByCareer, setSelectedMeasuredQualityTypesByCareer] = useState<{ [key: number]: any[] }>({});
  const [measuredQualityTypes, setMeasuredQualityTypes] = useState<any[]>([]);

  useEffect(() => {
    const fetchMeasuredQualityTypes = async () => {
      try {
        const response = await ReadMeasuredQualityTypes();
        setMeasuredQualityTypes(response.data);
      } catch (error) {
        console.error("Error fetching MeasuredQualityTypes:", error);
      }
    };
    fetchMeasuredQualityTypes();
  }, []);

  useEffect(() => {
    const loadExistingSelections = async () => {
      const newSelections: { [key: number]: any[] } = {};
      for (const career of props.data) {
        try {
          const response = await GetMeasuredQualityTypesForCareer(career.career_id);
          newSelections[career.career_id] = response.data.map((type: any) => type.measuredQualityTypeId);
        } catch (error) {
          // Handle 404 errors gracefully (career might have been deleted)
          if ((error as any)?.response?.status === 404) {
            console.log(`Career ${career.career_id} not found, skipping...`);
          } else {
            console.error(`Error loading quality types for career ${career.career_id}:`, error);
          }
          newSelections[career.career_id] = [];
        }
      }
      setSelectedMeasuredQualityTypesByCareer(newSelections);
    };
    if (props.data && props.data.length > 0) {
      loadExistingSelections();
    } else {
      // Clear selections if no data
      setSelectedMeasuredQualityTypesByCareer({});
    }
  }, [props.data]);

  const handleMeasuredQualityTypeSelectionChange = async (career_id: number, newValue: any[]) => {
    const currentValue = selectedMeasuredQualityTypesByCareer[career_id] || [];
    const newlySelected = newValue.filter(typeId => !currentValue.includes(typeId));
    const deselected = currentValue.filter(typeId => !newValue.includes(typeId));
    try {
      for (const typeId of newlySelected) {
        console.log('Assigning type to career_id:', career_id);
        await AssignMeasuredQualityTypeToCareer(typeId, career_id);
      }
      for (const typeId of deselected) {
        await RemoveMeasuredQualityTypeFromCareer(typeId, career_id);
      }
      setSelectedMeasuredQualityTypesByCareer(prev => ({ ...prev, [career_id]: newValue }));
    } catch (error) {
      alert('Failed to update MeasuredQualityType assignments. Please try again.');
      setSelectedMeasuredQualityTypesByCareer(prev => ({ ...prev, [career_id]: currentValue }));
    }
  };

  const datatable = {
    columns: [
      { label: "Title", field: "title", width: 200 },
      { label: "Description", field: "description", width: 200,  },
      { label: "Actions", field: "actions", width: 150,  },
      { label: "MeasuredQualityTypes", field: "MeasuredQualityTypes", width: 200,  },
    ],
    rows: props.data.map((data: any) => ({
      title: <div className="">{data.title}</div>,
      description: <div className="">{data.description}</div>,
      actions: (
        <div className="">
          <button
            onClick={() => navigate(`/career/edit/${data.career_id}`, { state: { data } })}
            className="btn btn-icon btn-primary btn-sm me-3"
          >
            <AiFillEdit size={16} />
          </button>
          <button
            onClick={async () => {
              props.setLoading(true);
              try {
                // Remove the career from local state immediately to prevent API calls
                setSelectedMeasuredQualityTypesByCareer(prev => {
                  const newState = {...prev};
                  delete newState[data.career_id];
                  return newState;
                });
                
                await DeleteCareerData(data.career_id);
                props.setPageLoading(["true"]);
              } catch (error) {
                alert("Failed to delete career. Please try again.");
              } finally {
                props.setLoading(false);
              }
            }}
            className="btn btn-icon btn-danger btn-sm me-3"
          >
            <UseAnimations animation={trash} size={22} strokeColor={"#EFF8FE"} />
          </button>
        </div>
      ),
      MeasuredQualityTypes: (
        <div className="">
          <FormControl sx={{ m: 1, width: 200 }} size="small">
            <InputLabel id={`multi-select-mqtypes-label-${data.career_id}`}>Select Quality Types</InputLabel>
            <Select
              labelId={`multi-select-mqtypes-label-${data.career_id}`}
              multiple
              value={selectedMeasuredQualityTypesByCareer[data.career_id] || []}
              onChange={async (e) => {
                const newValue = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                await handleMeasuredQualityTypeSelectionChange(data.career_id, newValue);
              }}
              input={<OutlinedInput label="Select Quality Types" />}
              renderValue={(selected) =>
                (selected as any[]).map(typeId =>
                  measuredQualityTypes.find(t => t.measuredQualityTypeId === typeId)?.measuredQualityTypeName
                ).join(', ')
              }
            >
              {measuredQualityTypes.map((type) => (
                <MenuItem key={type.measuredQualityTypeId} value={type.measuredQualityTypeId}>
                  <Checkbox
                    checked={(selectedMeasuredQualityTypesByCareer[data.career_id] || []).includes(type.measuredQualityTypeId)}
                  />
                  <ListItemText primary={type.measuredQualityTypeName} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
      )
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

export default CareerTable;
