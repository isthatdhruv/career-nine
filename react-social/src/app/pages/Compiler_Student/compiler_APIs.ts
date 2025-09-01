import axios from 'axios'
const API_COMPLIER = process.env.REACT_APP_COMPLIER 
const API_URL = process.env.REACT_APP_API_URL 

export const readLanguages = `${API_COMPLIER}/languages`;
export const runCode = `${API_COMPLIER}/submissions/`;
export const submitQuestion = `${API_URL}/codingquestion/save`;
export const submitTestcase = `${API_URL}/testcase/save`;
export const getAllQuestionURL = `${API_URL}/codingquestion/get`;

// export interface crudApiModal {
//   data?: any
// }

export function ReadLanguages() {
  return axios.get(readLanguages);
}

export function SubmitQuestion(values: any) {
  return axios.post(submitQuestion, {
    values,
  });
}

export function SubmitTestcase(values: any) {
  return axios.post(submitTestcase, {
    values,
  });
}

export function RunCode(
  language_id: any,
  source_code: any,
  stdin: any,
  expected_output: any
) {
  return axios.post(runCode, {
    language_id,
    source_code,
    stdin,
    expected_output,
  });
}

export function SubmitCode(data: any) {
  return axios.get(runCode + data.token);
}

export function readAllCompilerQuestions() {
  return axios.get(getAllQuestionURL);
}
