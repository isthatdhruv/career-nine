import axios from "axios";
const API_URL = process.env.REACT_APP_API_URL ;

const ReadCourse = `${API_URL}/instituteCourse/get`;
const readCourseByCollegeId = `${API_URL}/instituteCourse/getbyCollegeId/`;
const updateCourse = `${API_URL}/instituteCourse/update`;
const deleteCourse = `${API_URL}/instituteCourse/delete/`;

export function readCourseData() {
  return axios.get(ReadCourse);
}

export function ReadCourseByCollegeIdData(id: any) {
  return axios.get(readCourseByCollegeId + id);
}

export function UpdateCourseData(values: any) {
  return axios.post(updateCourse, {
    values,
  });
}

export function DeleteCourseData(id: any) {
  return axios.get(deleteCourse + id);
}
