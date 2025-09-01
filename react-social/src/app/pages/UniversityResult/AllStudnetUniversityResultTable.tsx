import React, { useEffect, useState } from "react";
import MUIDataTable from "mui-datatables";
import _ from "underscore";
export default function AllStudnetUniversityResultTable(props: {
  tableData: any,tableCol:any
}) {
  const options = {
    filterType: "checkbox",
    setRowProps: (rowData) => {
      return {
        style: {
          backgroundColor: rowData[6] === "SU" ? "#FFF8DD" : "#ffffff",
        },
      };
    },
  };
  var columns =props.tableCol;

  return (
    <div className="card mb-8">
      <div className="card-header border-0 pt-6">
        <div className="card-title">Total Student Data</div>
      </div>
      <div className="card-body pt-9 pb-0">
        <MUIDataTable
          className="p-8 mb-10 mt-5"
          title={"Registrations List"}
          data={props.tableData}
          columns={columns}
          options={options}
        />
      </div>
    </div>
  );
}
