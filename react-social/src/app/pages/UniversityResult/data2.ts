export {};

// import * as _ from "underscore";
// import { average, median, mode, range } from "statistics.ts";

// export var student_data = (data, filter) => {
//   console.log("Student Data");

//   data = filter_new(data, filter);

//   var col = [
//     {
//       name: "name",
//       label: "Name",
//       options: {
//         filter: false,
//         sort: true,
//       },
//     },
//     {
//       name: "SGPA",
//       label: "sgpa",
//       options: {
//         filter: false,
//         sort: true,
//       },
//     },
//     {
//       name: "total_marks_obt",
//       label: "Total Marks Obt",
//       options: {
//         filter: false,
//         sort: true,
//       },
//     },
//     {
//       name: "number_fail",
//       label: "Total Number of Subject Failed",
//       options: {
//         filter: true,
//         sort: true,
//       },
//     },
//   ];

//   var marks_array = _.flatten(_.pluck(data, "marks"));
//   var marks_name_array = _.unique(_.pluck(marks_array, "name"));
//   _.each(marks_name_array, (data) => {
//     var insert_col_heading_internal = {
//       name:
//         data
//           .toLowerCase()
//           .replace(/[^\w\s\d]/g, "-")
//           .replace(" ", "-") + "-internal",
//       label: data + " Internal Makrs",
//       options: {
//         filter: false,
//         sort: true,
//       },
//     };
//     var insert_col_heading_external = {
//       name:
//         data
//           .toLowerCase()
//           .replace(/[^\w\s\d]/g, "-")
//           .replace(" ", "-") + "-external",
//       label: data + " External Makrs",
//       options: {
//         filter: false,
//         sort: true,
//       },
//     };
//     var insert_col_heading_total = {
//       name:
//         data
//           .toLowerCase()
//           .replace(/[^\w\s\d]/g, "-")
//           .replace(" ", "-") + "-total",
//       label: data + " total Makrs",
//       options: {
//         filter: false,
//         sort: true,
//       },
//     };
//     col.push(
//       insert_col_heading_internal,
//       insert_col_heading_external,
//       insert_col_heading_total
//     );
//   });
//   console.log(data);

//   return { data: data, col_data: col };
// };
// export var names = (data) => {
//   return _.each(data, (list) => {
//     // var abr = {name:list.name}
//     _.each(list.result, (data1) => {
//       data1.name = list.name;
//       data1.course = list.course;
//       data1.branch = list.branch;
//       data1.gender = list.gender;
//       data1.rollno = list.rollno;
//       var number_fail = 0;
//       _.each(data1.marks, (data2) => {
//         data2.student_name = list.name;
//         data2.course = list.course;
//         data2.branch = list.branch;
//         data2.gender = list.gender;
//         data2.rollno = list.rollno;
//         data1[
//           "" +
//             data2.name
//               .toLowerCase()
//               .replace(/[^\w\s\d]/g, "-")
//               .replace(" ", "-") +
//             "-internal"
//         ] = data2.internal;
//         data1[
//           "" +
//             data2.name
//               .toLowerCase()
//               .replace(/[^\w\s\d]/g, "-")
//               .replace(" ", "-") +
//             "-external"
//         ] = data2.external;
//         data1[
//           "" +
//             data2.name
//               .toLowerCase()
//               .replace(/[^\w\s\d]/g, "-")
//               .replace(" ", "-") +
//             "-total"
//         ] =
//           parseInt(data2.internal) +
//           (!isNaN(data2.external) ? parseInt(data2.external) : 0);
//         data2.totalMarks = parseInt(data2.internal) + parseInt(data2.external);
//         if (data2.grade.match("F")) {
//           number_fail += 1;
//         }
//       });
//       data1.number_fail = number_fail;
//     });
//     return list;
//   });
// };
// // //console.log(names[0].result);

// export var courses = (data) => {
//   return _.unique(
//     _.map(data, (list) => {
//       // //console.log(list);
//       return list.course;
//     })
//   );
// };

// export var branches = (data) => {
//   var data = _.unique(
//     _.map(data, (list) => {
//       // //console.log(list);
//       return list.branch;
//     })
//   );
//   data.push("All");
//   return data;
// };

// export var session = (data) => {
//   return _.unique(
//     _.flatten(
//       _.map(data, (list) => {
//         // const session = [];
//         var session = _.map(list.result, (dataResult) => {
//           return dataResult.session;
//         });

//         return session;
//       })
//     )
//   );
// };

// export var semesters = (data) => {
//   return _.unique(
//     _.flatten(
//       _.map(data, (list) => {
//         // const session = [];
//         var semester = _.map(list.result, (dataResult) => {
//           return dataResult.semester;
//         });

//         return semester;
//       })
//     )
//   );
// };
// // //console.log(semesters)
// export var data_end = (courses1, branch1, session1, semester1) => {
//   // //console.log(courses1, branch1, session1, semester1)
//   return _.map(courses1, (course) => {
//     return {
//       name: course,
//       branch: _.map(branch1, (branch) => {
//         return {
//           name: branch,
//           session: _.map(session1, (session) => {
//             return {
//               name: session,
//               semester: _.map(semester1, (semester) => {
//                 return {
//                   name: semester,
//                 };
//               }),
//             };
//           }),
//         };
//       }),
//     };
//   });
// };
// //   //console.log(_where(_.where(data, {"course": "(04) B.TECH"},{"rw"})))
// // //console.log(_.map(data,(list)=>{return list.result}))

// export var filter_new = (data, filer) => {
//   data = names(data);
//   // //console.log(data);
//   var te = _.flatten(
//     _.map(data, (list) => {
//       return list.result;
//     })
//   );

//   var sem_result: any[] = [];
//   if (filer.branch_many) {
//     _.each(filer.branch_many, (data) => {
//      delete filer.branch_many;
//       filer.branch = data;
//       sem_result.push(_.where(te, filer));
//       sem_result = _.flatten(sem_result);
//     });
//   } else {
//     sem_result = _.where(te, filer);
//   }
//   var total_students = sem_result.length;
//   var studnetData = []; // //console.log(pass_percent(0));\

//   return sem_result;
// };

// export var filter = (data, filer, cp) => {
//   data = names(data);
//   // //console.log(data);
//   var te = _.flatten(
//     _.map(data, (list) => {
//       return list.result;
//     })
//   );

//   var sem_result: any[] = [];
//   if (filer.branch_many) {
//     _.each(filer.branch_many, (data) => {
//      delete filer.branch_many;
//       filer.branch = data;
//       sem_result.push(_.where(te, filer));
//       sem_result = _.flatten(sem_result);
//     });
//   } else {
//     sem_result = _.where(te, filer);
//   }

//   // global_sem_result=sem_result;

//   // var carry_paper = [0, 0, 0, 0, 0, 0, 0];
//   // _.map(sem_result, (list) => {
//   //   var count = 0;
//   //   _.map(list.marks, (mark) => {
//   //     if (mark.grade == "F") count++;
//   //   });
//   //   carry_paper[count]++;
//   // });

//   const sumSGPA = sem_result.reduce((total, list) => total + parseFloat(list.SGPA), 0);
//   const sgpa = [0.0, ...sem_result.map(list => parseFloat(list.SGPA))];

//   const carry_paper = sem_result.reduce((carryPaper, list) => {
//     const count = list.marks.filter(mark => mark.grade === "F").length;
//     carryPaper[count]++;
//     return carryPaper;
//   }, [0, 0, 0, 0, 0, 0, 0]);

// //   const carry_paper = sem_result.reduce((carryPaper, result) => {
// //   const count = result.marks.filter(mark => mark === "F").length;
// //   carryPaper[count] = (carryPaper[count] || 0) + 1;
// //   return carryPaper;
// // }, {});

// console.log(carry_paper);

//   // global_carry_paper=carry_paper;

//   var total_students = sem_result.length;
//   var studnetData = []; // //console.log(pass_percent(0));\

//   // // Box Data
//   //  var all_cleared_percent=(carry_paper[0]/total_students)*100;
//   //  var fail_percent= ((total_students-carry_paper[0])/total_students)*100;
//   //  var more_than_three_backs = ((carry_paper[4]+carry_paper[5]+carry_paper[6])/total_students)*100;

//   return {
//     total_students: total_students,
//     carry_paper: carry_paper[cp],
//     total_pass_percentage: (carry_paper[cp] / total_students) * 100,
//     total_number_of_failed_students: total_students - carry_paper[cp],
//     carry_papers: carry_paper,
//     studnet_data: sem_result,
//   };
// };

// // export var pass_percent = (cp) => {
// //     return { "total students ": total_students, "total pass students ": carry_paper[cp], "total pass percentage ": (carry_paper[cp] / total_students) * 100 };
// // }
// // var global_sem_result;
// // var global_carry_paper;
// export var boxes_data = (data, filer1) => {
//   data = names(data);
//   // //console.log(data);
//   var te = _.flatten(
//     _.map(data, (list) => {
//       return list.result;
//     })
//   );
//   var sem_result: any[] = [];
//   console.log("box_data")
//   console.log("Here it is supposed to be filer 2")
//   console.log(filer1)
//   if (filer1.branch_many && filer1.branch_many.length > 0) {
//     console.log("I am here")
//     var temp = filer1.branch_many
//     _.each(temp, (data) => {
//      delete filer1.branch_many;
//       filer1.branch = data;
//       sem_result.push(_.where(te, filer1));
//       sem_result = _.flatten(sem_result);
//     });
//   } else {
//     sem_result = _.where(te, filer1);
//   }

//   // var sum = 0.0;
//   // var carry_paper = [0, 0, 0, 0, 0, 0, 0];
//   // var sgpa = [0.0];
//   // _.map(sem_result, (list) => {
//   //   var count = 0;
//   //   sum = sum + parseFloat(list.SGPA);
//   //   sgpa.push(parseFloat(list.SGPA));
//   //   _.map(list.marks, (mark) => {
//   //     if (mark.grade == "F") count++;
//   //   });
//   //   carry_paper[count]++;
//   // });

//   const sum = sem_result.reduce((total, list) => total + parseFloat(list.SGPA), 0);
//   const sgpa = [0.0, ...sem_result.map(list => parseFloat(list.SGPA))];

//   const carry_paper = sem_result.reduce((carryPaper, list) => {
//     const count = list.marks.filter(mark => mark.grade === "F").length;
//     carryPaper[count]++;
//     return carryPaper;
//   }, [0, 0, 0, 0, 0, 0, 0]);

//   // global_carry_paper=carry_paper;
//   console.log('sem result');
//   console.log(sem_result);
//   var total_students = sem_result.length;
//   var means = sum / total_students;
//   var mean = means.toFixed(2);
//   var median1 = 0.0;
//   var mode1 = 0.0;

//   sgpa.sort(function (a, b) {
//     return a - b;
//   });

//   var highest = _.sortBy(sgpa, function (num) {
//     return num;
//   })[sgpa.length - 1];
//   var lowest = _.sortBy(sgpa, function (num) {
//     return num;
//   })[0];

//   var sem_result_sorted_sgpa = _.sortBy(sem_result, (data) => {
//     return sgpa;
//   });
//   console.log("sem_result_sorted_sgpa");

//   console.log(sem_result_sorted_sgpa)
//   var lowest_name = sem_result_sorted_sgpa[0].name;
//   var highest_name = sem_result_sorted_sgpa[sem_result_sorted_sgpa.length - 1].name;

//   sgpa.shift();

//   //console.log('sort',)
//   if (sgpa.length == 0) median1 = 0.0;
//   else if (sgpa.length <= 2) median1 = sgpa[0];
//   else {
//     median1 =
//       sgpa.length % 2 == 0
//         ? (sgpa[sgpa.length / 2] + sgpa[sgpa.length / 2 - 1]) / 2
//         : sgpa[Math.floor(sgpa.length / 2)];
//   }
//   var mode_sgpa = _.map(sgpa, (value) => {
//     return Math.trunc(value.toFixed(2));
//   });
//   var frequencyMap = {};

//   // Count the frequency of each element
//   for (var i = 0; i < mode_sgpa.length; i++) {
//     var element = mode_sgpa[i];
//     if (frequencyMap[element]) {
//       frequencyMap[element]++;
//     } else {
//       frequencyMap[element] = 1;
//     }
//   }
//   var maxFrequency = 0;
//   var mostFrequentElement = frequencyMap[0];

//   // Find the element with the highest frequency
//   for (var key in frequencyMap) {
//     if (frequencyMap[key] > maxFrequency) {
//       maxFrequency = frequencyMap[key];
//       mostFrequentElement = key;
//     }
//   }
//   mode1 = mostFrequentElement;
//   var boxsubject: any[] = [];
//   var box1: any = {
//     heading: "Over All Result",
//     table_total_students: total_students,
//     table_pass_percent:
//       Math.trunc((carry_paper[0] / total_students) * 100) + "%",
//     table_pass_number: carry_paper[0],
//     table_fail_percent:
//       Math.trunc(((total_students - carry_paper[0]) / total_students) * 100) +
//       "%",
//     table_fail_number: total_students - carry_paper[0],
//     table_mean: mean,
//     table_higest_sgpa:
//       _.sortBy(sgpa, function (num) {
//         return num;
//       })[sgpa.length - 1] + "",
//     table_higest_sgpa_student_name: highest_name,
//     table_lowest_sgpa:
//       _.sortBy(sgpa, function (num) {
//         return num;
//       })[0] + "",
//     table_lowest_sgpa_student_name: lowest_name,
//     box_data: [
//       {
//         header: "All Cleared %",
//         body: Math.trunc((carry_paper[0] / total_students) * 100) + "%",
//         footer: carry_paper[0] + "/" + total_students,
//       },
//       {
//         header: "Fail %",
//         body:
//           Math.trunc(
//             ((total_students - carry_paper[0]) / total_students) * 100
//           ) + "%",
//         footer: total_students - carry_paper[0] + "/" + total_students,
//       },
//       {
//         header: "More than 3 backs %",
//         body:
//           Math.trunc(
//             ((carry_paper[4] + carry_paper[5] + carry_paper[6]) /
//               total_students) *
//               100
//           ) + "%",
//         footer:
//           carry_paper[4] +
//           carry_paper[5] +
//           carry_paper[6] +
//           "/" +
//           total_students,
//       },
//       {
//         header: "Mean",
//         body: mean + "",
//         footer: "",
//       },
//       {
//         header: "Median",
//         body: parseFloat(median1 + "").toFixed(2) + "",
//         footer: "",
//       },
//       {
//         header: "Mode",
//         body: parseFloat(mode1 + "").toFixed(2),
//         footer: "",
//       },
//       {
//         header: "Highest SGPA",
//         body:
//           _.sortBy(sgpa, function (num) {
//             return num;
//           })[sgpa.length - 1] + "",
//         footer: highest_name,
//       },
//       {
//         header: "Lowest SGPA",
//         body:
//           _.sortBy(sgpa, function (num) {
//             return num;
//           })[0] + "",
//         footer: lowest_name,
//       },
//     ],
//   };
//   boxsubject.push(box1);
//   // var subjects=[""];
//   var subjects = _.unique(
//     _.pluck(_.flatten(_.pluck(sem_result, "marks")), "name")
//   );
//   _.each(subjects, (dataSubject) => {
//     var subjectMarksRawData = _.where(_.flatten(_.pluck(sem_result, "marks")), {
//       name: dataSubject,
//     });

//     // console.log()

//     var studnets_fail = _.filter(subjectMarksRawData, (data) => {
//       return data.grade == "F";
//     });
//     var studnets_pass = _.filter(subjectMarksRawData, (data) => {
//       return data.grade != "F";
//     });
//     var total_marks_array = _.pluck(subjectMarksRawData, "totalMarks");
//     var external_marks_array = _.map(subjectMarksRawData, (data) => {
//       return parseInt(data.external);
//     });
//     var sgpa_array = _.map(subjectMarksRawData, (data) => {
//       return parseInt(data.sgpa);
//     });
//     var total_marks_sorted = _.sortBy(
//       subjectMarksRawData,
//       function (totalMarks) {
//         return totalMarks;
//       }
//     );
//     var external_marks_sorted = _.sortBy(
//       subjectMarksRawData,
//       function (external) {
//         return external;
//       }
//     );
//     var sgpa_sorted = _.sortBy(subjectMarksRawData, function (sgpa) {
//       return sgpa;
//     });
//     // console.log(dataSubject)
//     // console.log(subjectMarksRawData)
//     // console.log( "external_marks_array",external_marks_array);
//     var boxSubjects = {};
//     // _.each(subjectMarksRawData, (data1) => {
//     boxSubjects = {
//       heading:
//         "Result for " + dataSubject + " (" + subjectMarksRawData[0].type + ")",
//       table_total_students: subjectMarksRawData.length,
//       table_pass_percent:
//         ((studnets_pass.length / subjectMarksRawData.length) * 100).toFixed(2) +
//         "%",
//       table_pass_number: studnets_pass.length,
//       table_fail_percent:
//         ((studnets_fail.length / subjectMarksRawData.length) * 100).toFixed(2) +
//         "%",
//       table_fail_number: studnets_fail.length,
//       table_mean_total_marks: parseFloat(
//         average(total_marks_array) + ""
//       ).toPrecision(2),
//       table_higest_total_marks:
//         total_marks_sorted[total_marks_sorted.length - 1].totalMarks + "",
//       table_higest_total_marks_studnet_name:
//         total_marks_sorted[total_marks_sorted.length - 1].student_name,
//       table_lowest_total_marks: total_marks_sorted[0].totalMarks + "",
//       table_lowest_total_marks_student_name: total_marks_sorted[0].student_name,
//       table_higest_external_marks:
//         external_marks_sorted[external_marks_sorted.length - 1].external + "",
//       table_higest_external_marks_studnet_name:
//         external_marks_sorted[external_marks_sorted.length - 1].student_name,
//       table_lowest_external_marks: external_marks_sorted[0].external + "",
//       table_lowest_total_external_student_name:
//         external_marks_sorted[0].student_name,

//       box_data: [
//         {
//           header: "All Cleared %",
//           body:
//             ((studnets_pass.length / subjectMarksRawData.length) * 100).toFixed(
//               2
//             ) + "%",
//           footer: studnets_pass.length + "/" + subjectMarksRawData.length,
//         },
//         {
//           header: "Fail %",
//           body:
//             ((studnets_fail.length / subjectMarksRawData.length) * 100).toFixed(
//               2
//             ) + "%",
//           footer: studnets_fail.length + "/" + subjectMarksRawData.length,
//         },
//         // {
//         //   header: "More than 3 backs %",
//         //   body: Math.trunc(((carry_paper[4] + carry_paper[5] + carry_paper[6]) / total_students) * 100) + "%",
//         //   footer: carry_paper[4] + carry_paper[5] + carry_paper[6] + "/" + total_students
//         // },
//         {
//           header: "Mean (Total Marks = Internal+External)",
//           body: parseFloat(average(total_marks_array) + "").toPrecision(2),
//           footer: "",
//         },
//         {
//           header: "Mean (External)",
//           body: parseFloat(median(external_marks_array) + "").toFixed(2),
//           footer: "",
//         },
//         {
//           header: "Mean (SGPA)",
//           body: parseFloat(mode(sgpa_array) + "").toFixed(2),
//           footer: "",
//         },
//         {
//           header: "Highest Marks (Total Marks = Internal+External)",
//           body:
//             total_marks_sorted[total_marks_sorted.length - 1].totalMarks + "",
//           footer:
//             total_marks_sorted[total_marks_sorted.length - 1].student_name,
//         },
//         {
//           header: "Lowest Marks (Total Marks = Internal+External)",
//           body: total_marks_sorted[0].totalMarks + "",
//           footer: total_marks_sorted[0].student_name,
//         },
//         {
//           header: "Highest Marks (External)",
//           body:
//             external_marks_sorted[external_marks_sorted.length - 1].external +
//             "",
//           footer:
//             external_marks_sorted[external_marks_sorted.length - 1]
//               .student_name,
//         },
//         {
//           header: "Lowest Marks (External)",
//           body: external_marks_sorted[0].external + "",
//           footer: external_marks_sorted[0].student_name,
//         },
//       ],
//     };
//     boxsubject.push(boxSubjects);

//     // })
//   });
//   //console.log(boxsubject)

//   return {
//     boxs_data: boxsubject,
//   };
// };

// export var table_data = (data, filer) => {
//   var te = _.flatten(
//     _.map(data, (list) => {
//       return list.result;
//     })
//   );
//   var sem_result = _.where(te, filer);

//   var subjects = _.unique(
//     _.pluck(_.flatten(_.pluck(sem_result, "marks")), "name")
//   );
//   _.each(subjects, (dataSubject) => {
//     var subjectMarksRawData = _.where(_.flatten(_.pluck(sem_result, "marks")), {
//       name: dataSubject,
//     });

//     // console.log()

//     var studnets_fail = _.filter(subjectMarksRawData, (data) => {
//       return data.grade == "F";
//     });
//     var studnets_pass = _.filter(subjectMarksRawData, (data) => {
//       return data.grade != "F";
//     });
//     var total_marks_array = _.pluck(subjectMarksRawData, "totalMarks");
//     var external_marks_array = _.map(subjectMarksRawData, (data) => {
//       return parseInt(data.external);
//     });
//     var total_marks_sorted = _.sortBy(
//       subjectMarksRawData,
//       function (totalMarks) {
//         return totalMarks;
//       }
//     );
//     var external_marks_sorted = _.sortBy(
//       subjectMarksRawData,
//       function (external) {
//         return external;
//       }
//     );
//     // console.log(dataSubject)
//     // console.log(subjectMarksRawData)
//     // console.log( "external_marks_array",external_marks_array);
//     // var boxSubjects = {};
//     // _.each(subjectMarksRawData, (data1) => {
//     var boxSubjects = {
//       heading:
//         "Result for " + dataSubject + " (" + subjectMarksRawData[0].type + ")",
//       box_data: [
//         {
//           header: "All Cleared %",
//           body:
//             ((studnets_pass.length / subjectMarksRawData.length) * 100).toFixed(
//               2
//             ) + "%",
//           footer: studnets_pass.length + "/" + subjectMarksRawData.length,
//         },
//         {
//           header: "Fail %",
//           body:
//             ((studnets_fail.length / subjectMarksRawData.length) * 100).toFixed(
//               2
//             ) + "%",
//           footer: studnets_fail.length + "/" + subjectMarksRawData.length,
//         },
//         // {
//         //   header: "More than 3 backs %",
//         //   body: Math.trunc(((carry_paper[4] + carry_paper[5] + carry_paper[6]) / total_students) * 100) + "%",
//         //   footer: carry_paper[4] + carry_paper[5] + carry_paper[6] + "/" + total_students
//         // },
//         {
//           header: "Mean (Total Marks = Internal+External)",
//           body: parseFloat(average(total_marks_array) + "").toPrecision(2),
//           footer: "",
//         },
//         {
//           header: "Median (Total Marks = Internal+External)",
//           body: parseFloat(median(total_marks_array) + "").toFixed(2),
//           footer: "",
//         },
//         {
//           header: "Mode (Total Marks = Internal+External)",
//           body: parseFloat(mode(total_marks_array) + "").toFixed(2),
//           footer: "",
//         },
//         {
//           header: "Highest Marks (Total Marks = Internal+External)",
//           body:
//             total_marks_sorted[total_marks_sorted.length - 1].totalMarks + "",
//           footer:
//             total_marks_sorted[total_marks_sorted.length - 1].student_name,
//         },
//         {
//           header: "Lowest Marks (Total Marks = Internal+External)",
//           body: total_marks_sorted[0].totalMarks + "",
//           footer: total_marks_sorted[0].student_name,
//         },
//         {
//           header: "Mean (External)",
//           body: parseFloat(average(total_marks_array) + "").toPrecision(2),
//           footer: "",
//         },
//         {
//           header: "Median (External)",
//           body: parseFloat(median(external_marks_array) + "").toFixed(2),
//           footer: "",import * as _ from "underscore";
//           import { average, median, mode, range } from "statistics.ts";
          
//           export var student_data = (data, filter) => {
//             console.log("Student Data");
          
//             data = filter_new(data, filter);
          
//             var col = [
//               {
//                 name: "name",
//                 label: "Name",
//                 options: {
//                   filter: false,
//                   sort: true,
//                 },
//               },
//               {
//                 name: "SGPA",
//                 label: "sgpa",
//                 options: {
//                   filter: false,
//                   sort: true,
//                 },
//               },
//               {
//                 name: "total_marks_obt",
//                 label: "Total Marks Obt",
//                 options: {
//                   filter: false,
//                   sort: true,
//                 },
//               },
//               {
//                 name: "number_fail",
//                 label: "Total Number of Subject Failed",
//                 options: {
//                   filter: true,
//                   sort: true,
//                 },
//               },
//             ];
          
//             var marks_array = _.flatten(_.pluck(data, "marks"));
//             var marks_name_array = _.unique(_.pluck(marks_array, "name"));
//             _.each(marks_name_array, (data) => {
//               var insert_col_heading_internal = {
//                 name:
//                   data
//                     .toLowerCase()
//                     .replace(/[^\w\s\d]/g, "-")
//                     .replace(" ", "-") + "-internal",
//                 label: data + " Internal Makrs",
//                 options: {
//                   filter: false,
//                   sort: true,
//                 },
//               };
//               var insert_col_heading_external = {
//                 name:
//                   data
//                     .toLowerCase()
//                     .replace(/[^\w\s\d]/g, "-")
//                     .replace(" ", "-") + "-external",
//                 label: data + " External Makrs",
//                 options: {
//                   filter: false,
//                   sort: true,
//                 },
//               };
//               var insert_col_heading_total = {
//                 name:
//                   data
//                     .toLowerCase()
//                     .replace(/[^\w\s\d]/g, "-")
//                     .replace(" ", "-") + "-total",
//                 label: data + " total Makrs",
//                 options: {
//                   filter: false,
//                   sort: true,
//                 },
//               };
//               col.push(
//                 insert_col_heading_internal,
//                 insert_col_heading_external,
//                 insert_col_heading_total
//               );
//             });
//             console.log(data);
          
//             return { data: data, col_data: col };
//           };
//           export var names = (data) => {
//             return _.each(data, (list) => {
//               // var abr = {name:list.name}
//               _.each(list.result, (data1) => {
//                 data1.name = list.name;
//                 data1.course = list.course;
//                 data1.branch = list.branch;
//                 data1.gender = list.gender;
//                 data1.rollno = list.rollno;
//                 var number_fail = 0;
//                 _.each(data1.marks, (data2) => {
//                   data2.student_name = list.name;
//                   data2.course = list.course;
//                   data2.branch = list.branch;
//                   data2.gender = list.gender;
//                   data2.rollno = list.rollno;
//                   data1[
//                     "" +
//                       data2.name
//                         .toLowerCase()
//                         .replace(/[^\w\s\d]/g, "-")
//                         .replace(" ", "-") +
//                       "-internal"
//                   ] = data2.internal;
//                   data1[
//                     "" +
//                       data2.name
//                         .toLowerCase()
//                         .replace(/[^\w\s\d]/g, "-")
//                         .replace(" ", "-") +
//                       "-external"
//                   ] = data2.external;
//                   data1[
//                     "" +
//                       data2.name
//                         .toLowerCase()
//                         .replace(/[^\w\s\d]/g, "-")
//                         .replace(" ", "-") +
//                       "-total"
//                   ] =
//                     parseInt(data2.internal) +
//                     (!isNaN(data2.external) ? parseInt(data2.external) : 0);
//                   data2.totalMarks = parseInt(data2.internal) + parseInt(data2.external);
//                   if (data2.grade.match("F")) {
//                     number_fail += 1;
//                   }
//                 });
//                 data1.number_fail = number_fail;
//               });
//               return list;
//             });
//           };
//           // //console.log(names[0].result);
          
//           export var courses = (data) => {
//             return _.unique(
//               _.map(data, (list) => {
//                 // //console.log(list);
//                 return list.course;
//               })
//             );
//           };
          
//           export var branches = (data) => {
//             var data = _.unique(
//               _.map(data, (list) => {
//                 // //console.log(list);
//                 return list.branch;
//               })
//             );
//             data.push("All");
//             return data;
//           };
          
//           export var session = (data) => {
//             return _.unique(
//               _.flatten(
//                 _.map(data, (list) => {
//                   // const session = [];
//                   var session = _.map(list.result, (dataResult) => {
//                     return dataResult.session;
//                   });
          
//                   return session;
//                 })
//               )
//             );
//           };
          
//           export var semesters = (data) => {
//             return _.unique(
//               _.flatten(
//                 _.map(data, (list) => {
//                   // const session = [];
//                   var semester = _.map(list.result, (dataResult) => {
//                     return dataResult.semester;
//                   });
          
//                   return semester;
//                 })
//               )
//             );
//           };
//           // //console.log(semesters)
//           export var data_end = (courses1, branch1, session1, semester1) => {
//             // //console.log(courses1, branch1, session1, semester1)
//             return _.map(courses1, (course) => {
//               return {
//                 name: course,
//                 branch: _.map(branch1, (branch) => {
//                   return {
//                     name: branch,
//                     session: _.map(session1, (session) => {
//                       return {
//                         name: session,
//                         semester: _.map(semester1, (semester) => {
//                           return {
//                             name: semester,
//                           };
//                         }),
//                       };
//                     }),
//                   };
//                 }),
//               };
//             });
//           };
//           //   //console.log(_where(_.where(data, {"course": "(04) B.TECH"},{"rw"})))
//           // //console.log(_.map(data,(list)=>{return list.result}))
          
//           export var filter_new = (data, filer) => {
//             data = names(data);
//             // //console.log(data);
//             var te = _.flatten(
//               _.map(data, (list) => {
//                 return list.result;
//               })
//             );
          
//             var sem_result: any[] = [];
//             if (filer.branch_many) {
//               _.each(filer.branch_many, (data) => {
//                delete filer.branch_many;
//                 filer.branch = data;
//                 sem_result.push(_.where(te, filer));
//                 sem_result = _.flatten(sem_result);
//               });
//             } else {
//               sem_result = _.where(te, filer);
//             }
//             var total_students = sem_result.length;
//             var studnetData = []; // //console.log(pass_percent(0));\
          
//             return sem_result;
//           };
          
//           export var filter = (data, filer, cp) => {
//             data = names(data);
//             // //console.log(data);
//             var te = _.flatten(
//               _.map(data, (list) => {
//                 return list.result;
//               })
//             );
          
//             var sem_result: any[] = [];
//             if (filer.branch_many) {
//               _.each(filer.branch_many, (data) => {
//                delete filer.branch_many;
//                 filer.branch = data;
//                 sem_result.push(_.where(te, filer));
//                 sem_result = _.flatten(sem_result);
//               });
//             } else {
//               sem_result = _.where(te, filer);
//             }
          
//             // global_sem_result=sem_result;
          
//             // var carry_paper = [0, 0, 0, 0, 0, 0, 0];
//             // _.map(sem_result, (list) => {
//             //   var count = 0;
//             //   _.map(list.marks, (mark) => {
//             //     if (mark.grade == "F") count++;
//             //   });
//             //   carry_paper[count]++;
//             // });
          
//             const sumSGPA = sem_result.reduce((total, list) => total + parseFloat(list.SGPA), 0);
//             const sgpa = [0.0, ...sem_result.map(list => parseFloat(list.SGPA))];
          
//             const carry_paper = sem_result.reduce((carryPaper, list) => {
//               const count = list.marks.filter(mark => mark.grade === "F").length;
//               carryPaper[count]++;
//               return carryPaper;
//             }, [0, 0, 0, 0, 0, 0, 0]);
          
//           //   const carry_paper = sem_result.reduce((carryPaper, result) => {
//           //   const count = result.marks.filter(mark => mark === "F").length;
//           //   carryPaper[count] = (carryPaper[count] || 0) + 1;
//           //   return carryPaper;
//           // }, {});
          
//           console.log(carry_paper);
          
//             // global_carry_paper=carry_paper;
          
//             var total_students = sem_result.length;
//             var studnetData = []; // //console.log(pass_percent(0));\
          
//             // // Box Data
//             //  var all_cleared_percent=(carry_paper[0]/total_students)*100;
//             //  var fail_percent= ((total_students-carry_paper[0])/total_students)*100;
//             //  var more_than_three_backs = ((carry_paper[4]+carry_paper[5]+carry_paper[6])/total_students)*100;
          
//             return {
//               total_students: total_students,
//               carry_paper: carry_paper[cp],
//               total_pass_percentage: (carry_paper[cp] / total_students) * 100,
//               total_number_of_failed_students: total_students - carry_paper[cp],
//               carry_papers: carry_paper,
//               studnet_data: sem_result,
//             };
//           };
          
//           // export var pass_percent = (cp) => {
//           //     return { "total students ": total_students, "total pass students ": carry_paper[cp], "total pass percentage ": (carry_paper[cp] / total_students) * 100 };
//           // }
//           // var global_sem_result;
//           // var global_carry_paper;
//           export var boxes_data = (data, filer1) => {
//             data = names(data);
//             // //console.log(data);
//             var te = _.flatten(
//               _.map(data, (list) => {
//                 return list.result;
//               })
//             );
//             var sem_result: any[] = [];
//             console.log("box_data")
//             console.log("Here it is supposed to be filer 2")
//             console.log(filer1)
//             if (filer1.branch_many && filer1.branch_many.length > 0) {
//               console.log("I am here")
//               var temp = filer1.branch_many
//               _.each(temp, (data) => {
//                delete filer1.branch_many;
//                 filer1.branch = data;
//                 sem_result.push(_.where(te, filer1));
//                 sem_result = _.flatten(sem_result);
//               });
//             } else {
//               sem_result = _.where(te, filer1);
//             }
          
//             // var sum = 0.0;
//             // var carry_paper = [0, 0, 0, 0, 0, 0, 0];
//             // var sgpa = [0.0];
//             // _.map(sem_result, (list) => {
//             //   var count = 0;
//             //   sum = sum + parseFloat(list.SGPA);
//             //   sgpa.push(parseFloat(list.SGPA));
//             //   _.map(list.marks, (mark) => {
//             //     if (mark.grade == "F") count++;
//             //   });
//             //   carry_paper[count]++;
//             // });
          
//             const sum = sem_result.reduce((total, list) => total + parseFloat(list.SGPA), 0);
//             const sgpa = [0.0, ...sem_result.map(list => parseFloat(list.SGPA))];
          
//             const carry_paper = sem_result.reduce((carryPaper, list) => {
//               const count = list.marks.filter(mark => mark.grade === "F").length;
//               carryPaper[count]++;
//               return carryPaper;
//             }, [0, 0, 0, 0, 0, 0, 0]);
          
//             // global_carry_paper=carry_paper;
//             console.log('sem result');
//             console.log(sem_result);
//             var total_students = sem_result.length;
//             var means = sum / total_students;
//             var mean = means.toFixed(2);
//             var median1 = 0.0;
//             var mode1 = 0.0;
          
//             sgpa.sort(function (a, b) {
//               return a - b;
//             });
          
//             var highest = _.sortBy(sgpa, function (num) {
//               return num;
//             })[sgpa.length - 1];
//             var lowest = _.sortBy(sgpa, function (num) {
//               return num;
//             })[0];
          
//             var sem_result_sorted_sgpa = _.sortBy(sem_result, (data) => {
//               return sgpa;
//             });
//             console.log("sem_result_sorted_sgpa");
          
//             console.log(sem_result_sorted_sgpa)
//             var lowest_name = sem_result_sorted_sgpa[0].name;
//             var highest_name = sem_result_sorted_sgpa[sem_result_sorted_sgpa.length - 1].name;
          
//             sgpa.shift();
          
//             //console.log('sort',)
//             if (sgpa.length == 0) median1 = 0.0;
//             else if (sgpa.length <= 2) median1 = sgpa[0];
//             else {
//               median1 =
//                 sgpa.length % 2 == 0
//                   ? (sgpa[sgpa.length / 2] + sgpa[sgpa.length / 2 - 1]) / 2
//                   : sgpa[Math.floor(sgpa.length / 2)];
//             }
//             var mode_sgpa = _.map(sgpa, (value) => {
//               return Math.trunc(value.toFixed(2));
//             });
//             var frequencyMap = {};
          
//             // Count the frequency of each element
//             for (var i = 0; i < mode_sgpa.length; i++) {
//               var element = mode_sgpa[i];
//               if (frequencyMap[element]) {
//                 frequencyMap[element]++;
//               } else {
//                 frequencyMap[element] = 1;
//               }
//             }
//             var maxFrequency = 0;
//             var mostFrequentElement = frequencyMap[0];
          
//             // Find the element with the highest frequency
//             for (var key in frequencyMap) {
//               if (frequencyMap[key] > maxFrequency) {
//                 maxFrequency = frequencyMap[key];
//                 mostFrequentElement = key;
//               }
//             }
//             mode1 = mostFrequentElement;
//             var boxsubject: any[] = [];
//             var box1: any = {
//               heading: "Over All Result",
//               table_total_students: total_students,
//               table_pass_percent:
//                 Math.trunc((carry_paper[0] / total_students) * 100) + "%",
//               table_pass_number: carry_paper[0],
//               table_fail_percent:
//                 Math.trunc(((total_students - carry_paper[0]) / total_students) * 100) +
//                 "%",
//               table_fail_number: total_students - carry_paper[0],
//               table_mean: mean,
//               table_higest_sgpa:
//                 _.sortBy(sgpa, function (num) {
//                   return num;
//                 })[sgpa.length - 1] + "",
//               table_higest_sgpa_student_name: highest_name,
//               table_lowest_sgpa:
//                 _.sortBy(sgpa, function (num) {
//                   return num;
//                 })[0] + "",
//               table_lowest_sgpa_student_name: lowest_name,
//               box_data: [
//                 {
//                   header: "All Cleared %",
//                   body: Math.trunc((carry_paper[0] / total_students) * 100) + "%",
//                   footer: carry_paper[0] + "/" + total_students,
//                 },
//                 {
//                   header: "Fail %",
//                   body:
//                     Math.trunc(
//                       ((total_students - carry_paper[0]) / total_students) * 100
//                     ) + "%",
//                   footer: total_students - carry_paper[0] + "/" + total_students,
//                 },
//                 {
//                   header: "More than 3 backs %",
//                   body:
//                     Math.trunc(
//                       ((carry_paper[4] + carry_paper[5] + carry_paper[6]) /
//                         total_students) *
//                         100
//                     ) + "%",
//                   footer:
//                     carry_paper[4] +
//                     carry_paper[5] +
//                     carry_paper[6] +
//                     "/" +
//                     total_students,
//                 },
//                 {
//                   header: "Mean",
//                   body: mean + "",
//                   footer: "",
//                 },
//                 {
//                   header: "Median",
//                   body: parseFloat(median1 + "").toFixed(2) + "",
//                   footer: "",
//                 },
//                 {
//                   header: "Mode",
//                   body: parseFloat(mode1 + "").toFixed(2),
//                   footer: "",
//                 },
//                 {
//                   header: "Highest SGPA",
//                   body:
//                     _.sortBy(sgpa, function (num) {
//                       return num;
//                     })[sgpa.length - 1] + "",
//                   footer: highest_name,
//                 },
//                 {
//                   header: "Lowest SGPA",
//                   body:
//                     _.sortBy(sgpa, function (num) {
//                       return num;
//                     })[0] + "",
//                   footer: lowest_name,
//                 },
//               ],
//             };
//             boxsubject.push(box1);
//             // var subjects=[""];
//             var subjects = _.unique(
//               _.pluck(_.flatten(_.pluck(sem_result, "marks")), "name")
//             );
//             _.each(subjects, (dataSubject) => {
//               var subjectMarksRawData = _.where(_.flatten(_.pluck(sem_result, "marks")), {
//                 name: dataSubject,
//               });
          
//               // console.log()
          
//               var studnets_fail = _.filter(subjectMarksRawData, (data) => {
//                 return data.grade == "F";
//               });
//               var studnets_pass = _.filter(subjectMarksRawData, (data) => {
//                 return data.grade != "F";
//               });
//               var total_marks_array = _.pluck(subjectMarksRawData, "totalMarks");
//               var external_marks_array = _.map(subjectMarksRawData, (data) => {
//                 return parseInt(data.external);
//               });
//               var sgpa_array = _.map(subjectMarksRawData, (data) => {
//                 return parseInt(data.sgpa);
//               });
//               var total_marks_sorted = _.sortBy(
//                 subjectMarksRawData,
//                 function (totalMarks) {
//                   return totalMarks;
//                 }
//               );
//               var external_marks_sorted = _.sortBy(
//                 subjectMarksRawData,
//                 function (external) {
//                   return external;
//                 }
//               );
//               var sgpa_sorted = _.sortBy(subjectMarksRawData, function (sgpa) {
//                 return sgpa;
//               });
//               // console.log(dataSubject)
//               // console.log(subjectMarksRawData)
//               // console.log( "external_marks_array",external_marks_array);
//               var boxSubjects = {};
//               // _.each(subjectMarksRawData, (data1) => {
//               boxSubjects = {
//                 heading:
//                   "Result for " + dataSubject + " (" + subjectMarksRawData[0].type + ")",
//                 table_total_students: subjectMarksRawData.length,
//                 table_pass_percent:
//                   ((studnets_pass.length / subjectMarksRawData.length) * 100).toFixed(2) +
//                   "%",
//                 table_pass_number: studnets_pass.length,
//                 table_fail_percent:
//                   ((studnets_fail.length / subjectMarksRawData.length) * 100).toFixed(2) +
//                   "%",
//                 table_fail_number: studnets_fail.length,
//                 table_mean_total_marks: parseFloat(
//                   average(total_marks_array) + ""
//                 ).toPrecision(2),
//                 table_higest_total_marks:
//                   total_marks_sorted[total_marks_sorted.length - 1].totalMarks + "",
//                 table_higest_total_marks_studnet_name:
//                   total_marks_sorted[total_marks_sorted.length - 1].student_name,
//                 table_lowest_total_marks: total_marks_sorted[0].totalMarks + "",
//                 table_lowest_total_marks_student_name: total_marks_sorted[0].student_name,
//                 table_higest_external_marks:
//                   external_marks_sorted[external_marks_sorted.length - 1].external + "",
//                 table_higest_external_marks_studnet_name:
//                   external_marks_sorted[external_marks_sorted.length - 1].student_name,
//                 table_lowest_external_marks: external_marks_sorted[0].external + "",
//                 table_lowest_total_external_student_name:
//                   external_marks_sorted[0].student_name,
          
//                 box_data: [
//                   {
//                     header: "All Cleared %",
//                     body:
//                       ((studnets_pass.length / subjectMarksRawData.length) * 100).toFixed(
//                         2
//                       ) + "%",
//                     footer: studnets_pass.length + "/" + subjectMarksRawData.length,
//                   },
//                   {
//                     header: "Fail %",
//                     body:
//                       ((studnets_fail.length / subjectMarksRawData.length) * 100).toFixed(
//                         2
//                       ) + "%",
//                     footer: studnets_fail.length + "/" + subjectMarksRawData.length,
//                   },
//                   // {
//                   //   header: "More than 3 backs %",
//                   //   body: Math.trunc(((carry_paper[4] + carry_paper[5] + carry_paper[6]) / total_students) * 100) + "%",
//                   //   footer: carry_paper[4] + carry_paper[5] + carry_paper[6] + "/" + total_students
//                   // },
//                   {
//                     header: "Mean (Total Marks = Internal+External)",
//                     body: parseFloat(average(total_marks_array) + "").toPrecision(2),
//                     footer: "",
//                   },
//                   {
//                     header: "Mean (External)",
//                     body: parseFloat(median(external_marks_array) + "").toFixed(2),
//                     footer: "",
//                   },
//                   {
//                     header: "Mean (SGPA)",
//                     body: parseFloat(mode(sgpa_array) + "").toFixed(2),
//                     footer: "",
//                   },
//                   {
//                     header: "Highest Marks (Total Marks = Internal+External)",
//                     body:
//                       total_marks_sorted[total_marks_sorted.length - 1].totalMarks + "",
//                     footer:
//                       total_marks_sorted[total_marks_sorted.length - 1].student_name,
//                   },
//                   {
//                     header: "Lowest Marks (Total Marks = Internal+External)",
//                     body: total_marks_sorted[0].totalMarks + "",
//                     footer: total_marks_sorted[0].student_name,
//                   },
//                   {
//                     header: "Highest Marks (External)",
//                     body:
//                       external_marks_sorted[external_marks_sorted.length - 1].external +
//                       "",
//                     footer:
//                       external_marks_sorted[external_marks_sorted.length - 1]
//                         .student_name,
//                   },
//                   {
//                     header: "Lowest Marks (External)",
//                     body: external_marks_sorted[0].external + "",
//                     footer: external_marks_sorted[0].student_name,
//                   },
//                 ],
//               };
//               boxsubject.push(boxSubjects);
          
//               // })
//             });
//             //console.log(boxsubject)
          
//             return {
//               boxs_data: boxsubject,
//             };
//           };
          
//           export var table_data = (data, filer) => {
//             var te = _.flatten(
//               _.map(data, (list) => {
//                 return list.result;
//               })
//             );
//             var sem_result = _.where(te, filer);
          
//             var subjects = _.unique(
//               _.pluck(_.flatten(_.pluck(sem_result, "marks")), "name")
//             );
//             _.each(subjects, (dataSubject) => {
//               var subjectMarksRawData = _.where(_.flatten(_.pluck(sem_result, "marks")), {
//                 name: dataSubject,
//               });
          
//               // console.log()
          
//               var studnets_fail = _.filter(subjectMarksRawData, (data) => {
//                 return data.grade == "F";
//               });
//               var studnets_pass = _.filter(subjectMarksRawData, (data) => {
//                 return data.grade != "F";
//               });
//               var total_marks_array = _.pluck(subjectMarksRawData, "totalMarks");
//               var external_marks_array = _.map(subjectMarksRawData, (data) => {
//                 return parseInt(data.external);
//               });
//               var total_marks_sorted = _.sortBy(
//                 subjectMarksRawData,
//                 function (totalMarks) {
//                   return totalMarks;
//                 }
//               );
//               var external_marks_sorted = _.sortBy(
//                 subjectMarksRawData,
//                 function (external) {
//                   return external;
//                 }
//               );
//               // console.log(dataSubject)
//               // console.log(subjectMarksRawData)
//               // console.log( "external_marks_array",external_marks_array);
//               // var boxSubjects = {};
//               // _.each(subjectMarksRawData, (data1) => {
//               var boxSubjects = {
//                 heading:
//                   "Result for " + dataSubject + " (" + subjectMarksRawData[0].type + ")",
//                 box_data: [
//                   {
//                     header: "All Cleared %",
//                     body:
//                       ((studnets_pass.length / subjectMarksRawData.length) * 100).toFixed(
//                         2
//                       ) + "%",
//                     footer: studnets_pass.length + "/" + subjectMarksRawData.length,
//                   },
//                   {
//                     header: "Fail %",
//                     body:
//                       ((studnets_fail.length / subjectMarksRawData.length) * 100).toFixed(
//                         2
//                       ) + "%",
//                     footer: studnets_fail.length + "/" + subjectMarksRawData.length,
//                   },
//                   // {
//                   //   header: "More than 3 backs %",
//                   //   body: Math.trunc(((carry_paper[4] + carry_paper[5] + carry_paper[6]) / total_students) * 100) + "%",
//                   //   footer: carry_paper[4] + carry_paper[5] + carry_paper[6] + "/" + total_students
//                   // },
//                   {
//                     header: "Mean (Total Marks = Internal+External)",
//                     body: parseFloat(average(total_marks_array) + "").toPrecision(2),
//                     footer: "",
//                   },
//                   {
//                     header: "Median (Total Marks = Internal+External)",
//                     body: parseFloat(median(total_marks_array) + "").toFixed(2),
//                     footer: "",
//                   },
//                   {
//                     header: "Mode (Total Marks = Internal+External)",
//                     body: parseFloat(mode(total_marks_array) + "").toFixed(2),
//                     footer: "",
//                   },
//                   {
//                     header: "Highest Marks (Total Marks = Internal+External)",
//                     body:
//                       total_marks_sorted[total_marks_sorted.length - 1].totalMarks + "",
//                     footer:
//                       total_marks_sorted[total_marks_sorted.length - 1].student_name,
//                   },
//                   {
//                     header: "Lowest Marks (Total Marks = Internal+External)",
//                     body: total_marks_sorted[0].totalMarks + "",
//                     footer: total_marks_sorted[0].student_name,
//                   },
//                   {
//                     header: "Mean (External)",
//                     body: parseFloat(average(total_marks_array) + "").toPrecision(2),
//                     footer: "",
//                   },
//                   {
//                     header: "Median (External)",
//                     body: parseFloat(median(external_marks_array) + "").toFixed(2),
//                     footer: "",
//                   },
//                   {
//                     header: "Mode (External)",
//                     body: parseFloat(mode(external_marks_array) + "").toFixed(2),
//                     footer: "",
//                   },
//                   {
//                     header: "Highest Marks (External)",
//                     body:
//                       external_marks_sorted[external_marks_sorted.length - 1].external +
//                       "",
//                     footer:
//                       external_marks_sorted[external_marks_sorted.length - 1]
//                         .student_name,
//                   },
//                   {
//                     header: "Lowest Marks (External)",
//                     body: external_marks_sorted[0].external + "",
//                     footer: external_marks_sorted[0].student_name,
//                   },
//                 ],
//               };
//             });
//           };
//           (2),
//           footer: "",
//         },
//         {
//           header: "Highest Marks (External)",
//           body:
//             external_marks_sorted[external_marks_sorted.length - 1].external +
//             "",
//           footer:
//             external_marks_sorted[external_marks_sorted.length - 1]
//               .student_name,
//         },
//         {
//           header: "Lowest Marks (External)",
//           body: external_marks_sorted[0].external + "",
//           footer: external_marks_sorted[0].student_name,
//         },
//       ],
//     };
//   });
// };
