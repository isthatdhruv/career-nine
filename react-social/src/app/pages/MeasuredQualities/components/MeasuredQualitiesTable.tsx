import { Checkbox, FormControl, InputLabel, ListItemText, MenuItem, OutlinedInput, Select } from "@mui/material";
import { MDBDataTableV5 } from "mdbreact";
import { useEffect, useState } from "react";
import { AiFillEdit } from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { DeleteMeasuredQualitiesData, ReadToolsData } from "../API/Measured_Qualities_APIs";

const MeasuredQualitiesTable = (props: {
  data: any;
  setLoading: any;
  setPageLoading: any;
}) => {
  const navigate = useNavigate();
  const [modalShow, setModalShow] = useState(false);
  const [modalData, setModalData] = useState<any>(null);
  const [selectedToolsByQuality, setSelectedToolsByQuality] = useState<{[key: number]: any[]}>({});
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
  
  
  const datatable = {
    columns: [
      {
        label: "Quality Name",
        field: "measuredQualityName",
        width: 200,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Quality Name",
          className: "text-center",
        },
      },
      {
        label: "Quality Description",
        field: "measuredQualityDescription",
        sort: "asc",
        width: 150,
        attributes: {
          className: "text-center",
        },
      },
      {
        label: "Display Name",
        field: "qualityDisplayName",
        sort: "asc",
        width: 150,
        attributes: {
          className: "text-center",
        },
      },
      {
        label: "Actions",
        field: "actions",
        sort: "disabled",
        width: 150,
        attributes: {
          className: "text-center",
        },
      },
      {
        label: "Tools",
        field: "Tools",
        sort: "disabled",
        width: 150,
        attributes: {
          className: "text-center",
        },
      },
    ],

    rows: props.data.map((data: any) => ({
      measuredQualityName: <div className="text-center">{data.measuredQualityName}</div>,
      measuredQualityDescription: <div className="text-center">{data.measuredQualityDescription}</div>,
      qualityDisplayName: <div className="text-center">{data.qualityDisplayName}</div>,
      actions: (
        <div className="text-center">
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
        <div className="text-center">
          <FormControl sx={{ m: 1, width: 200 }} size="small">
            <InputLabel id={`multi-select-tools-label-${data.measuredQualityId}`}>Select Tools</InputLabel>
            <Select
              labelId={`multi-select-tools-label-${data.measuredQualityId}`}
              multiple
              value={selectedToolsByQuality[data.measuredQualityId] || []}
              onChange={e => {
                const newValue = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                setSelectedToolsByQuality(prev => ({
                  ...prev,
                  [data.measuredQualityId]: newValue
                }));
                // TODO: Call API to save the relationship
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
