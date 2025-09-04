import React, { useEffect, useState } from "react";
import MUIDataTable from "mui-datatables";
import _ from "underscore";
export default function SubjectUniversityResultTable(props: {
  tableData: any;
}) {
  console.log(props.tableData);
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
  var columns = [
    {
      name: "heading",
      label: "Result",
      options: {
        filter: true,
        sort: true,
      },
      setCellProps: () => ({
        style: {
          whiteSpace: "nowrap",
          position: "sticky",
          left: "0",
          background: "red",
          zIndex: 100,
        },
      }),
      setCellHeaderProps: () => ({
        style: {
          whiteSpace: "nowrap",
          position: "sticky",
          left: 0,
          background: "white",
          zIndex: 101,
        },
      }),
    },
    {
      name: "table_total_students",
      label: "Total Student",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "table_pass_number",
      label: "Student Pass Number",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "table_pass_percent",
      label: "Student Pass Persentage",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "table_fail_number",
      label: "Student Fail Number",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "table_fail_percent",
      label: "Student Fail Persentage",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "table_mean_total_marks",
      label: "Mean Total Marks",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "table_higest_total_marks",
      label: "Heightest Total Marks",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "table_higest_total_marks_studnet_name",
      label: "Heightest Total Marks Student Name",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "table_lowest_total_marks",
      label: "Lowest Total Marks",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "table_lowest_total_marks_student_name",
      label: "Lowest Total Marks Student Name",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "table_mean_external_marks",
      label: "Mean External Marks",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "table_higest_external_marks",
      label: "Heightest External Marks",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "table_higest_external_marks_studnet_name",
      label: "Heightest External Marks Student Name",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "table_lowest_external_marks",
      label: "Lowest External Marks",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "table_lowest_total_external_student_name",
      label: "Lowest External Marks Student Name",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "table_lowest_internal_marks",
      label: "Lowest Internal Marks",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "table_lowest_total_enternal_student_name",
      label: "Lowest Internal Marks Student Name",
      options: {
        filter: false,
        sort: true,
      },
    },
  ];

  return (
    <div className="card mb-8">
      <div className="card-header border-0 pt-6">
        <div className="card-title">Total Student Data</div>
      </div>
      <div className="card-body pt-9 pb-0">
        <MUIDataTable
          className="p-8 mb-10 mt-5"
          title={"Subject Complied Data"}
          data={props.tableData}
          columns={columns}
          options={options}
        />
      </div>
    </div>
  );
}
