import { Checkbox, FormControl, InputLabel, ListItemText, MenuItem, OutlinedInput, Select } from "@mui/material";
import { MDBDataTableV5 } from "mdbreact";
import { useEffect, useState } from "react";
import { AiFillEdit } from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { AssignToolToQuality, DeleteMeasuredQualitiesData, GetToolsForQuality, ReadToolsData, RemoveToolFromQuality } from "../API/Measured_Qualities_APIs";

// Define your API base URL here or import it from your config

const MeasuredQualitiesTable = (props: {
  data: any;
  setLoading: any;
  setPageLoading: any;
}) => {
  const navigate = useNavigate();
  const [selectedToolsByQuality, setSelectedToolsByQuality] = useState<{ [key: number]: any[] }>({});
  const [tools, setTools] = useState<any[]>([]);

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const response = await ReadToolsData();
        setTools(response.data);
      } catch (error) {
        console.error("Error fetching tools:", error);
      }
    };
    fetchTools();
  }, []);

  // Load existing tool selections when component mounts
  useEffect(() => {
    const loadExistingSelections = async () => {
      const newSelections: {[key: number]: any[]} = {};
      
      for (const quality of props.data) {
        try {
          const response = await GetToolsForQuality(quality.measuredQualityId);
          newSelections[quality.measuredQualityId] = response.data.map((tool: any) => tool.toolId);
        } catch (error) {
          console.error(`Error loading tools for quality ${quality.measuredQualityId}:`, error);
          newSelections[quality.measuredQualityId] = [];
        }
      }
      
      setSelectedToolsByQuality(newSelections);
    };
    
    if (props.data && props.data.length > 0) {
      loadExistingSelections();
    }
  }, [props.data]);

  // Handle tool selection changes with real-time API calls
  const handleToolSelectionChange = async (qualityId: number, newValue: any[]) => {
    const currentValue = selectedToolsByQuality[qualityId] || [];
    
    // Find newly selected tools
    const newlySelected = newValue.filter(toolId => !currentValue.includes(toolId));
    
    // Find deselected tools
    const deselected = currentValue.filter(toolId => !newValue.includes(toolId));
    
    try {
      // Assign new tools
      for (const toolId of newlySelected) {
        await AssignToolToQuality(toolId, qualityId);
        console.log(`Tool ${toolId} assigned to quality ${qualityId}`);
      }
      
      // Remove deselected tools
      for (const toolId of deselected) {
        await RemoveToolFromQuality(toolId, qualityId);
        console.log(`Tool ${toolId} removed from quality ${qualityId}`);
      }
      
      // Update state only after successful API calls
      setSelectedToolsByQuality(prev => ({
        ...prev,
        [qualityId]: newValue
      }));
      
    } catch (error) {
      console.error('Error updating tool assignments:', error);
      alert('Failed to update tool assignments. Please try again.');
      
      // Revert to previous state on error
      setSelectedToolsByQuality(prev => ({
        ...prev,
        [qualityId]: currentValue
      }));
    }
  };

  // const assignToolToQuality = async (toolId: number, qualityId: number) => {
  //   try {
  //     const response = await AssignToolToQuality(toolId, qualityId);
  //     console.log('Tool assigned successfully:', response.data);
  //   } catch (error) {
  //     console.error('Error assigning tool:', error);
  //   }
  // };

  const datatable = {
    columns: [
      {
        label: "Quality Name",
        field: "measuredQualityName",
        width: 200,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Quality Name",
          className: "",
        },
      },
      {
        label: "Quality Description",
        field: "measuredQualityDescription",
        sort: "asc",
        width: 150,
        attributes: {
          className: "",
        },
      },
      {
        label: "Display Name",
        field: "qualityDisplayName",
        sort: "asc",
        width: 150,
        attributes: {
          className: "",
        },
      },
      {
        label: "Actions",
        field: "actions",
        sort: "disabled",
        width: 150,
        attributes: {
          className: "",
        },
      },
      {
        label: "Tools",
        field: "Tools",
        sort: "disabled",
        width: 150,
        attributes: {
          className: "",
        },
      },
    ],

    rows: props.data.map((data: any) => ({
      measuredQualityName: <div className="">{data.measuredQualityName}</div>,
      measuredQualityDescription: <div className="">{data.measuredQualityDescription}</div>,
      qualityDisplayName: <div className="">{data.qualityDisplayName}</div>,
      actions: (
        <div className="">
          <button
            onClick={() => {
              navigate(`/measured-qualities/edit/${data.measuredQualityId}`, {
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
                console.log(data);
                await DeleteMeasuredQualitiesData(data.measuredQualityId);
                props.setPageLoading(["true"]);
              } catch (error) {
                console.error("Delete failed:", error);
                alert("Failed to delete measured quality. Please try again.");
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
        </div>
      ),
      Tools: (
        <div className="">
          <FormControl sx={{ m: 1, width: 200 }} size="small">
            <InputLabel id={`multi-select-tools-label-${data.measuredQualityId}`}>Select Tools</InputLabel>
            <Select
              labelId={`multi-select-tools-label-${data.measuredQualityId}`}
              multiple
              value={selectedToolsByQuality[data.measuredQualityId] || []}
              onChange={async (e) => {
                const newValue = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                await handleToolSelectionChange(data.measuredQualityId, newValue);
              }}
              input={<OutlinedInput label="Select Tools" />}
              renderValue={(selected) =>
                (selected as any[]).map(toolId =>
                  tools.find(t => t.toolId === toolId)?.name
                ).join(', ')
              }
            >
              {tools.map((tool) => (
                <MenuItem key={tool.toolId} value={tool.toolId}>
                  <Checkbox
                    checked={(selectedToolsByQuality[data.measuredQualityId] || []).includes(tool.toolId)}
                  />
                  <ListItemText primary={tool.name} />
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
      {/* <MeasuredQualitiesModal
        show={modalShow}
        onHide={() => setModalShow(false)}
        data={modalData}
        setPageLoading={props.setPageLoading}
      /> */}
    </>
  );
};

export default MeasuredQualitiesTable;
