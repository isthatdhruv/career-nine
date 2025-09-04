import { average, median, mode } from "statistics.ts";
import * as _ from "underscore";

export var data_end = (courses1, branch1, session1, semester1) => {
  // //console.log(courses1, branch1, session1, semester1)
  return _.map(courses1, (course) => {
    return {
      name: course,
      branch: _.map(branch1, (branch) => {
        return {
          name: branch,
          session: _.map(session1, (session) => {
            return {
              name: session,
              semester: _.map(semester1, (semester) => {
                return {
                  name: semester,
                };
              }),
            };
          }),
        };
      }),
    };
  });
};

export var courses = (data) => {
  return _.unique(
    _.map(data, (list) => {
      // //console.log(list);
      return list.course;
    })
  );
};

export var branches = (data: any[]) => {
  var data = _.unique(
    _.map(data, (list) => {
      // //console.log(list);
      return list.branch;
    })
  );
  data.push("All");
  return data;
};

export var session = (data) => {
  return _.unique(
    _.flatten(
      _.map(data, (list) => {
        // const session = [];
        var session = _.map(list.result, (dataResult) => {
          return dataResult.session;
        });

        return session;
      })
    )
  );
};

export var semesters = (data) => {
  return _.unique(
    _.flatten(
      _.map(data, (list) => {
        // const session = [];
        var semester = _.map(list.result, (dataResult) => {
          return dataResult.semester;
        });

        return semester;
      })
    )
  );
};

export var names = (data) => {
  return _.each(data, (list) => {
    // var abr = {name:list.name}
    _.each(list.result, (data1) => {
      data1.name = list.name;
      data1.course = list.course;
      data1.branch = list.branch;
      data1.gender = list.gender;
      data1.rollno = list.rollno;
      var number_fail = 0;
      _.each(data1.marks, (data2) => {
        data2.student_name = list.name;
        data2.course = list.course;
        data2.branch = list.branch;
        data2.gender = list.gender;
        data2.rollno = list.rollno;
        data1[
          "" +
            data2.name
              .toLowerCase()
              .replace(/[^\w\s\d]/g, "-")
              .replace(" ", "-") +
            "-internal"
        ] = data2.internal;
        data1[
          "" +
            data2.name
              .toLowerCase()
              .replace(/[^\w\s\d]/g, "-")
              .replace(" ", "-") +
            "-external"
        ] = data2.external;
        data1[
          "" +
            data2.name
              .toLowerCase()
              .replace(/[^\w\s\d]/g, "-")
              .replace(" ", "-") +
            "-total"
        ] =
          parseInt(data2.internal) +
          (!isNaN(data2.external) ? parseInt(data2.external) : 0);
        data2.totalMarks = parseInt(data2.internal) + parseInt(data2.external);
        if (data2.grade.match("F")) {
          number_fail += 1;
        }
      });
      data1.number_fail = number_fail;
    });
    return list;
  });
};

var pass_array_function = (sem_result, cp) => {
  return _.where(sem_result, { number_fail: cp });
};

export var boxes_data = (data, filer1) => {
  data = names(data);
  var te = _.flatten(
    _.map(data, (list) => {
      return list.result;
    })
  );
  var sem_result: any[] = [];
  if (filer1.branch_many && filer1.branch_many.length > 0) {
    var temp = filer1.branch_many;
    _.each(temp, (data) => {
      delete filer1.branch_many;
      filer1.branch = data;
      sem_result.push(_.where(te, filer1));
      sem_result = _.flatten(sem_result);
    });
  } else {
    sem_result = _.where(te, filer1);
  }

  //validation for empty sem_result
  var sgpa = sem_result
    .filter((list) => list.SGPA && !isNaN(parseFloat(list.SGPA)))
    .map((list) => ({
      name: list.student_name,
      sgpa: parseFloat(list.SGPA),
    }));
  sgpa = _.sortBy(sgpa, "sgpa");

  var totalPass = pass_array_function(sem_result, 0).length;
  var totalStudents = sem_result.length;

  //check totalStudents is zero to avoid division by zero
  var totalMarksArray = _.map(sem_result, (num) => {
    const marks = parseInt(num.total_marks_obt);
    return isNaN(marks) ? 0 : marks;
  }).filter(mark => mark > 0);

  //emptyarray check for totalMarksArray
  var totalMean = totalMarksArray.length > 0 
    ? parseFloat(average(totalMarksArray) + "").toFixed(2)
    : "0.00";

  //checking sgpa is a number and not NaN
    var validSgpaValues = sem_result.filter(list => 
    list.SGPA && !isNaN(parseFloat(list.SGPA))
  );
  var sum = validSgpaValues.reduce(
    (total, list) => total + parseFloat(list.SGPA),
    0
  );

  //validation for total_marks_obt
  var totalMarksSortedArray = _.sortBy(
    sem_result.filter(item => 
      item.total_marks_obt && !isNaN(parseInt(item.total_marks_obt))
    ), 
    item => parseInt(item.total_marks_obt)
  );

  var more_than_three_backs =
    pass_array_function(sem_result, 4).length +
    pass_array_function(sem_result, 5).length +
    pass_array_function(sem_result, 6).length;

  var boxsubject: any[] = [];
  var box1: any = {
    heading: "Over All Result",
    table_total_students: totalStudents,
    table_pass_percent: totalStudents > 0 ? Math.trunc((totalPass / totalStudents) * 100) + "%" : "0%",
    table_pass_number: totalPass,
    table_fail_percent: totalStudents > 0 ? Math.trunc(((totalStudents - totalPass) / totalStudents) * 100) + "%" : "0%",
    table_fail_number: totalStudents - totalPass,
    table_mean_total_marks: totalMean,
    table_sgpa_mean: validSgpaValues.length > 0 ? sum / validSgpaValues.length : 0,
    table_higest_total_marks: totalMarksSortedArray.length > 0 
      ? totalMarksSortedArray[totalMarksSortedArray.length - 1].total_marks_obt
      : "N/A",
    table_higest_total_marks_studnet_name: totalMarksSortedArray.length > 0 
      ? totalMarksSortedArray[totalMarksSortedArray.length - 1].name
      : "N/A",
    table_higest_sgpa: sgpa.length > 0 ? sgpa[sgpa.length - 1].sgpa : "N/A",
    table_highest_sgpa_student_name: sgpa.length > 0 ? sgpa[sgpa.length - 1].name : "N/A",
    table_lowest_sgpa: sgpa.length > 0 ? sgpa[0].sgpa : "N/A",
    table_lowest_sgpa_student_name: sgpa.length > 0 ? sgpa[0].name : "N/A",
    table_lowest_total_marks: totalMarksSortedArray.length > 0 
      ? totalMarksSortedArray[0].total_marks_obt
      : "N/A",
    table_lowest_total_marks_student_name: totalMarksSortedArray.length > 0 
      ? totalMarksSortedArray[0].name
      : "N/A",
    box_data: [
      {
        header: "All Cleared %",
        body: totalStudents > 0 ? Math.trunc((totalPass / totalStudents) * 100) + "%" : "0%",
        footer: totalPass + "/" + totalStudents,
      },
      {
        header: "Fail %",
        body: totalStudents > 0 ? Math.trunc(((totalStudents - totalPass) / totalStudents) * 100) + "%" : "0%",
        footer: totalStudents - totalPass + "/" + totalStudents,
      },
      {
        header: "More than 3 backs %",
        body: totalStudents > 0 ? Math.trunc((more_than_three_backs / totalStudents) * 100) + "%" : "0%",
        footer: more_than_three_backs + "/" + totalStudents,
      },
      {
        header: "Total Mean",
        body: totalMean,
        footer: "",
      },
      {
        header: "Sgpa Mean",
        body: validSgpaValues.length > 0 ? parseFloat(sum / validSgpaValues.length + "").toFixed(2) : "0.00",
        footer: "",
      },
      {
        header: "Highest SGPA",
        body: sgpa.length > 0 ? sgpa[sgpa.length - 1].sgpa : "N/A",
        footer: sgpa.length > 0 ? sgpa[sgpa.length - 1].name : "N/A",
      },
      {
        header: "Lowest SGPA",
        body: sgpa.length > 0 ? sgpa[0].sgpa + "" : "N/A",
        footer: sgpa.length > 0 ? sgpa[0].name : "N/A",
      },
    ],
  };
  boxsubject.push(box1);

  var subjects = _.unique(
    _.pluck(_.flatten(_.pluck(sem_result, "marks")), "name")
  );
  _.each(subjects, (dataSubject) => {
    var subjectMarksRawData = _.where(_.flatten(_.pluck(sem_result, "marks")), {
      name: dataSubject,
    });

    var studnets_fail = _.filter(subjectMarksRawData, (data) => {
      return data.grade == "F";
    });
    var studnets_pass = _.filter(subjectMarksRawData, (data) => {
      return data.grade != "F";
    });

    var total_marks_array = _.pluck(subjectMarksRawData, "totalMarks")
      .filter(mark => !isNaN(mark) && mark !== null && mark !== undefined);

    var external_marks_array = _.map(subjectMarksRawData, (data) => {
      const mark = parseInt(data.external);
      return isNaN(mark) ? 0 : mark;
    }).filter(mark => mark >= 0);

    var sgpa_array = _.map(subjectMarksRawData, (data) => {
      const sgpa = parseInt(data.sgpa);
      return isNaN(sgpa) ? 0 : sgpa;
    }).filter(sgpa => sgpa > 0);

    var total_marks_sorted = _.sortBy(
      subjectMarksRawData.filter(item => 
        !isNaN(item.totalMarks) && item.totalMarks !== null && item.totalMarks !== undefined
      ),
      function (totalMarks) {
        return totalMarks.totalMarks;
      }
    );

    var external_marks_sorted = _.sortBy(
      subjectMarksRawData.filter(item => 
        !isNaN(parseInt(item.external))
      ),
      function (external) {
        return parseInt(external.external);
      }
    );

    if (subjectMarksRawData.length > 0) {
      var boxSubjects = {
        heading: "Result for " + dataSubject + " (" + (subjectMarksRawData[0]?.type || "Unknown") + ")",
        table_total_students: subjectMarksRawData.length,
        table_pass_percent: subjectMarksRawData.length > 0 
          ? ((studnets_pass.length / subjectMarksRawData.length) * 100).toFixed(2) + "%"
          : "0%",
        table_pass_number: studnets_pass.length,
        table_fail_percent: subjectMarksRawData.length > 0 
          ? ((studnets_fail.length / subjectMarksRawData.length) * 100).toFixed(2) + "%"
          : "0%",
        table_fail_number: studnets_fail.length,
        table_mean_total_marks: total_marks_array.length > 0 
          ? parseFloat(average(total_marks_array) + "").toPrecision(2)
          : "0.00",
        table_higest_total_marks: total_marks_sorted.length > 0 
          ? total_marks_sorted[total_marks_sorted.length - 1].totalMarks + ""
          : "N/A",
        table_higest_total_marks_studnet_name: total_marks_sorted.length > 0 
          ? total_marks_sorted[total_marks_sorted.length - 1].student_name
          : "N/A",
        table_lowest_total_marks: total_marks_sorted.length > 0 
          ? total_marks_sorted[0].totalMarks + ""
          : "N/A",
        table_lowest_total_marks_student_name: total_marks_sorted.length > 0 
          ? total_marks_sorted[0].student_name
          : "N/A",
        table_higest_external_marks: external_marks_sorted.length > 0 
          ? external_marks_sorted[external_marks_sorted.length - 1].external + ""
          : "N/A",
        table_higest_external_marks_studnet_name: external_marks_sorted.length > 0 
          ? external_marks_sorted[external_marks_sorted.length - 1].student_name
          : "N/A",
        table_lowest_external_marks: external_marks_sorted.length > 0 
          ? external_marks_sorted[0].external + ""
          : "N/A",
        table_lowest_total_external_student_name: external_marks_sorted.length > 0 
          ? external_marks_sorted[0].student_name
          : "N/A",

        box_data: [
          {
            header: "All Cleared %",
            body: subjectMarksRawData.length > 0 
              ? ((studnets_pass.length / subjectMarksRawData.length) * 100).toFixed(2) + "%"
              : "0%",
            footer: studnets_pass.length + "/" + subjectMarksRawData.length,
          },
          {
            header: "Fail %",
            body: subjectMarksRawData.length > 0 
              ? ((studnets_fail.length / subjectMarksRawData.length) * 100).toFixed(2) + "%"
              : "0%",
            footer: studnets_fail.length + "/" + subjectMarksRawData.length,
          },
          {
            header: "Mean (Total Marks = Internal+External)",
            body: total_marks_array.length > 0 
              ? parseFloat(average(total_marks_array) + "").toPrecision(2)
              : "0.00",
            footer: "",
          },
          {
            header: "Mean (External)",
            body: external_marks_array.length > 0 
              ? parseFloat(average(external_marks_array) + "").toFixed(2)
              : "0.00",
            footer: "",
          },
          {
            header: "Mean (SGPA)",
            body: sgpa_array.length > 0 
              ? parseFloat(average(sgpa_array) + "").toFixed(2)
              : "0.00",
            footer: "",
          },
          {
            header: "Highest Marks (Total Marks = Internal+External)",
            body: total_marks_sorted.length > 0 
              ? total_marks_sorted[total_marks_sorted.length - 1].totalMarks + ""
              : "N/A",
            footer: total_marks_sorted.length > 0 
              ? total_marks_sorted[total_marks_sorted.length - 1].student_name
              : "N/A",
          },
          {
            header: "Lowest Marks (Total Marks = Internal+External)",
            body: total_marks_sorted.length > 0 
              ? total_marks_sorted[0].totalMarks + ""
              : "N/A",
            footer: total_marks_sorted.length > 0 
              ? total_marks_sorted[0].student_name
              : "N/A",
          },
          {
            header: "Highest Marks (External)",
            body: external_marks_sorted.length > 0 
              ? external_marks_sorted[external_marks_sorted.length - 1].external + ""
              : "N/A",
            footer: external_marks_sorted.length > 0 
              ? external_marks_sorted[external_marks_sorted.length - 1].student_name
              : "N/A",
          },
          {
            header: "Lowest Marks (External)",
            body: external_marks_sorted.length > 0 
              ? external_marks_sorted[0].external + ""
              : "N/A",
            footer: external_marks_sorted.length > 0 
              ? external_marks_sorted[0].student_name
              : "N/A",
          },
        ],
      };
      boxsubject.push(boxSubjects);
    }
  });

  var col = [
    {
      name: "rollno",
      label: "Roll No.",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "name",
      label: "Name",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "SGPA",
      label: "sgpa",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "total_marks_obt",
      label: "Total Marks Obt",
      options: {
        filter: false,
        sort: true,
      },
    },
    {
      name: "number_fail",
      label: "Total Number of Subject Failed",
      options: {
        filter: true,
        sort: true,
      },
    },
  ];

  var marks_array = _.flatten(_.pluck(sem_result, "marks"));
  var marks_name_array = _.unique(_.pluck(marks_array, "name"));
  _.each(marks_name_array, (data) => {
    var insert_col_heading_internal = {
      name: data.toLowerCase().replace(/[^\w\s\d]/g, "-").replace(" ", "-") + "-internal",
      label: data + " Internal Makrs",
      options: {
        filter: false,
        sort: true,
      },
    };
    var insert_col_heading_external = {
      name: data.toLowerCase().replace(/[^\w\s\d]/g, "-").replace(" ", "-") + "-external",
      label: data + " External Makrs",
      options: {
        filter: false,
        sort: true,
      },
    };
    var insert_col_heading_total = {
      name: data.toLowerCase().replace(/[^\w\s\d]/g, "-").replace(" ", "-") + "-total",
      label: data + " total Makrs",
      options: {
        filter: false,
        sort: true,
      },
    };
    col.push(insert_col_heading_internal, insert_col_heading_external, insert_col_heading_total);
  });

  number_of_back_table_data(sem_result);
  return {
    boxs_data: boxsubject,
    data: sem_result,
    col_data: col,
  };
};

export var number_of_back_table_data = (sem_result) => {};
