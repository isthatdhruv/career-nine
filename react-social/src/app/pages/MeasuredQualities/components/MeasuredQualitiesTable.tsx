import { MDBDataTableV5 } from "mdbreact";
import { AiFillAppstore, AiFillEdit, AiFillPlusSquare } from "react-icons/ai";
import { useNavigate } from "react-router-dom";
import UseAnimations from "react-useanimations";
import trash from "react-useanimations/lib/trash";
import { DeleteMeasuredQualitiesData } from "../API/Measured_Qualities_APIs";
import { GiTrafficLightsGreen } from "react-icons/gi";
import { useState } from "react";
import MeasuredQualitiesModal from "./MeasuredQualitiesModal";
import { Select, MenuItem, InputLabel, FormControl, Checkbox, ListItemText, OutlinedInput } from "@mui/material";

const MeasuredQualitiesTable = (props: {
  data: any;
  setLoading: any;
  setPageLoading: any;
}) => {
  const navigate = useNavigate();
  const [modalShow, setModalShow] = useState(false);
  const [modalData, setModalData] = useState<any>(null);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const cities = [
    { name: 'New York', code: 'NY' },
    { name: 'Rome', code: 'RM' },
    { name: 'London', code: 'LDN' },
    { name: 'Istanbul', code: 'IST' },
    { name: 'Paris', code: 'PRS' }
  ];
  const datatable = {
    columns: [
      {
        label: "Quality Name",
        field: "measuredQualityName",
        width: 300,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Quality Name",
        },
      },
      {
        label: "Quality Description",
        field: "measuredQualityDescription",
        sort: "asc",
        width: 150,
      },
      {
        label: "Display Name",
        field: "qualityDisplayName",
        sort: "asc",
        width: 150,
      },
      {
        label: "Actions",
        field: "actions",
        sort: "disabled",
        width: 150,
      },
      {
        label: "Tools",
        field: "Tools",
        sort: "disabled",
        width: 150,
      },
    ],

    rows: props.data.map((data: any) => ({
      measuredQualityName: data.measuredQualityName,
      measuredQualityDescription: data.measuredQualityDescription,
      qualityDisplayName: data.qualityDisplayName,
      actions: (
        <>
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
          <button
            onClick={() => {
              setModalData(data);
              setModalShow(true);
            }}
            className="btn btn-icon btn-success btn-sm me-3"
          >
            <AiFillAppstore size={16} />
          </button>
        </>
      ),
      Tools: (
        <FormControl sx={{ m: 1, width: 200 }} size="small">
          <InputLabel id="multi-select-cities-label">Select Cities</InputLabel>
          <Select
            labelId="multi-select-cities-label"
            multiple
            value={selectedCities}
            onChange={e => setSelectedCities(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
            input={<OutlinedInput label="Select Cities" />}
            renderValue={(selected) => (selected as string[]).map(code => cities.find(c => c.code === code)?.name).join(', ')}
          >
            {cities.map((city) => (
              <MenuItem key={city.code} value={city.code}>
                <Checkbox checked={selectedCities.indexOf(city.code) > -1} />
                <ListItemText primary={city.name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
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
