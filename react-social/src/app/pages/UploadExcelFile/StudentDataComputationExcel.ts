import { SchoolOMRData, SchoolOMRRow } from "./DataStructure";

export const setData = (excelData: any) => {
    var data:SchoolOMRRow[] = [];
  // Implementation for setting the data
    for (let i = 0; i < excelData.length; i++) {
        data[i] = {
            studentName: excelData[i]["Student Name"] || "",
            rollNumber: excelData[i]["Roll Number"] || "",
            class: excelData[i]["Class"] || "",
            section: excelData[i]["Section"] || "",
            mobile: excelData[i]["Mobile 1"] || "",
            Dob: excelData[i]["DOB"] || "",
            totalMarks: excelData[i]["Total Marks"] || null,
            obtainedMarks: excelData[i]["Obtained Marks"] || null,
            answers: [],
            measuredQualityFinalScore: []
        };


    }    console.log("Data set:", data);
    return data;
}