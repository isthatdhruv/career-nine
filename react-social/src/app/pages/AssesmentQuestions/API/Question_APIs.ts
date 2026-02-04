import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL;

const readQuestions = `${API_URL}/assessment-questions/getAll`;
const readQuestionsList = `${API_URL}/assessment-questions/getAllList`;
const readQuestionById = `${API_URL}/assessment-questions/get/`;
const createQuestion = `${API_URL}/assessment-questions/create`;
const updateQuestion = `${API_URL}/assessment-questions/update`;
const deleteQuestion = `${API_URL}/assessment-questions/delete/`;
const readMeasuredQualityTypes = `${API_URL}/measured-quality-types/getAll`;
const updateOptionScore = `${API_URL}/option-scores/create`;

export function updateOptionScoreData(optionScores: any) {
  return axios.post(updateOptionScore, optionScores);
}

export function ReadQuestionsData() {
  return axios.get(readQuestions);
}

export function ReadQuestionsDataList() {
  return axios.get(readQuestionsList);
}
export function ReadMeasuredQualityTypes() {
  return axios.get(readMeasuredQualityTypes);
}
export function ReadQuestionByIdData(id: any) {
  return axios.get(readQuestionById + id);
}
export function AssignMeasuredQualityTypeToQuestion(typeId: any, questionId: any) {
  const assignTypeToQuestion = `${API_URL}/measured-quality-types/${typeId}/assessment-questions/${questionId}`;
  return axios.post(assignTypeToQuestion);
}

export function RemoveMeasuredQualityTypeFromQuestion(typeId: any, questionId: any) {
  const removeTypeFromQuestion = `${API_URL}/measured-quality-types/${typeId}/assessment-questions/${questionId}`;
  return axios.delete(removeTypeFromQuestion);
}

export function GetMeasuredQualityTypesForQuestion(questionId: any) {
  const getTypesForQuestion = `${API_URL}/assessment-questions/${questionId}/measured-quality-types`;
  return axios.get(getTypesForQuestion);
}
export function CreateQuestionData(values: any) {
  // Transform the data to match backend expectations
  // const requestData = {
  //   ...values,
  //   section: values.sectionId ? { sectionId: values.sectionId } : null,
  //   options: values.questionOptions 
  //     ? values.questionOptions
  //         .filter((option: string) => option.trim() !== '') // Remove empty options
  //         .map((option: string, index: number) => ({
  //           optionText: option,
  //           isCorrect: index === 0 // For now, make first option correct by default
  //         }))
  //     : []
  // };
  // delete requestData.sectionId; // Remove the flat sectionId
  // delete requestData.questionOptions; // Remove the original field
  // console.log("Sending to backend:", requestData);
  return axios.post(createQuestion, values);
}

export function UpdateQuestionData(id: any, values: any) {
  // Transform the data to match backend expectations
  const requestData = {
    ...values,
    section: values.sectionId ? { sectionId: values.sectionId } : null,
    options: values.questionOptions 
      ? values.questionOptions
          .filter((option: string) => option.trim() !== '') // Remove empty options
          .map((option: string, index: number) => ({
            optionText: option,
            isCorrect: index === 0 // For now, make first option correct by default
          }))
      : []
  };
  delete requestData.sectionId; // Remove the flat sectionId
  delete requestData.questionOptions; // Remove the original field
  console.log("Sending update to backend:", requestData);
  return axios.put(`${updateQuestion}/${id}`, requestData);
}

export function DeleteQuestionData(id: any) {
  return axios.delete(deleteQuestion + id);
}

/**
 * Export all assessment questions to Excel file
 *
 * This function calls the backend API endpoint to generate and download an Excel file
 * containing all assessment questions with their complete details including:
 * - Question information (ID, text, type, section, max options)
 * - All options for each question
 * - Measured quality type scores for each option
 *
 * The response is a binary Excel file that is automatically downloaded to the user's device
 * with a timestamped filename.
 *
 * @returns Promise that resolves when the download is complete
 */
export async function ExportQuestionsToExcel() {
  try {
    // API endpoint for Excel export
    const exportExcelUrl = `${API_URL}/assessment-questions/export-excel`;

    // Make GET request with responseType 'blob' to handle binary data
    // 'blob' tells axios to expect binary data instead of JSON
    const response = await axios.get(exportExcelUrl, {
      responseType: 'blob', // Important: handle binary data
    });

    // Create a blob from the response data
    // Blob represents the Excel file in memory
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    // Create a temporary URL for the blob
    const url = window.URL.createObjectURL(blob);

    // Create a temporary anchor element to trigger download
    const link = document.createElement('a');
    link.href = url;

    // Set the filename with current timestamp for uniqueness
    const timestamp = new Date().getTime();
    link.setAttribute('download', `assessment_questions_${timestamp}.xlsx`);

    // Append to body, click, and remove (programmatic download)
    document.body.appendChild(link);
    link.click();

    // Clean up: remove the link and revoke the object URL to free memory
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    console.log('Excel file downloaded successfully');
  } catch (error) {
    console.error('Error downloading Excel file:', error);
    throw error; // Re-throw so calling component can handle it
  }
}
