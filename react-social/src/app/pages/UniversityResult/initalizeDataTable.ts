export var initDataTable = {
    columns: [
      {
        label: "Name",
        field: "name",
        width: 150,
        attributes: {
          "aria-controls": "DataTable",
          "aria-label": "Name",
        },
      },
      {
        label: "Course",
        field: "course",
        width: 270,
      },
      {
        label: "Branch",
        field: "branch",
        width: 200,
      },
      {
        label: "Roll No.",
        field: "rollno",
        sort: "asc",
        width: 100,
      },
      {
        label: "No. Of Semester",
        field: "semester",
        sort: "asc",
        width: 100,
      },
      {
        label: "Total SGPA",
        field: "sgpa",
        sort: "asc",
        width: 100,
      },

      {
        label: "View Result",
        field: "result",
        sort: "disabled",
        width: 100,
      },
    ],

    rows: [
      {
        name: "Loading...",
        course: "Loading...",
        branch: "Loading...",
        rollno: "Loading...",
        semester: "Loading...",
        marks: "Loading...",
        result: "<></>",
      },
    ],
  }

export var InitFilterData=
  [
    {
      name: "(04) B.TECH",
      branch: [
        {
          name: "(10) COMPUTER SCIENCE AND ENGINEERING",
          session: [
            {
              name: "Session : 2018-19(REGULAR)",
              semester: [
                {
                  name: "1",
                },
                {
                  name: "2",
                },
              ],
            },
            {
              name: "Session : 2019-20(REGULAR)",
              semester: [
                {
                  name: "1",
                },
                {
                  name: "2",
                },
                {
                  name: "3",
                },
                {
                  name: "4",
                },
                {
                  name: "5",
                },
                {
                  name: "6",
                },
                {
                  name: "7",
                },
                {
                  name: "8",
                },
              ],
            },
            {
              name: "Session : 2020-21(REGULAR)",
              semester: [
                {
                  name: "1",
                },
                {
                  name: "2",
                },
                {
                  name: "3",
                },
                {
                  name: "4",
                },
                {
                  name: "5",
                },
                {
                  name: "6",
                },
                {
                  name: "7",
                },
                {
                  name: "8",
                },
              ],
            },
            {
              name: "Session : 2021-22(REGULAR)",
              semester: [
                {
                  name: "1",
                },
                {
                  name: "2",
                },
                {
                  name: "3",
                },
                {
                  name: "4",
                },
                {
                  name: "5",
                },
                {
                  name: "6",
                },
                {
                  name: "7",
                },
                {
                  name: "8",
                },
              ],
            },
          ],
        },
      ],
    },
  ]