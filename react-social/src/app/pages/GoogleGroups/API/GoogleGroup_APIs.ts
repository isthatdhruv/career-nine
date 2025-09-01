import axios from 'axios'
const API_URL = process.env.REACT_APP_API_URL 
const GetGroupName = `${API_URL}/google-api/groupemail/get`
const GetGroupMembers = `${API_URL}/google-api/group-member/get/`
const DeleteGroupMembers = `${API_URL}/google-api/group-member-delete/get/`
const DeleteGroup = `${API_URL}/google-api/group-delete/get/`
const AddGroup = `${API_URL}/google-api/group/add`
const GetSession = `${API_URL}/instituteSession/get`
const GetCourse = `${API_URL}/instituteCourse/get`
const GetBatch = `${API_URL}/instituteBatch/get`
const GetBranch = `${API_URL}/instituteBranch/get`
const GetSection = `${API_URL}/section/get`
const SetCourseData = `${API_URL}/course-group/update`
const SetBatchData = `${API_URL}/batch-group/update`
const SetSessionData = `${API_URL}/session-group/update`
const SetSectionData = `${API_URL}/section-group/update`
const SetBranchData = `${API_URL}/branch-group/update`
export function DeleteGroupData(email: any) {
  return axios.get(DeleteGroup + email);
}

export function GetGroupMembersData(id: any) {
  return axios.get(GetGroupMembers + id);
}

export function GetGroupNameData() {
  return axios.get(GetGroupName);
}

export function GetGroupMembersDelete(name: any, email: any) {
  return axios.get(DeleteGroupMembers + name + "/delete/" + email);
}

export function AddGroupData(values: any) {
  return axios.post(AddGroup, {
    values,
  });
}

export function getDataFor(params: any) {
  switch (params) {
    case "Session":
      return axios.get(GetSession);
      break;
    case "Course":
      return axios.get(GetCourse);
      break;
    case "Batch":
      return axios.get(GetBatch);
      break;
    case "Section":
      return axios.get(GetSection);
      break;
    case "Branch":
      return axios.get(GetBranch);
      break;
    default:
      return null;
      break;
  }
}
export function setDataFor(params: any, values: any) {
  switch (params) {
    case "Session":
      return axios.post(SetSessionData, {
        values,
      });
      break;
    case "Course":
      return axios.post(SetCourseData, {
        values,
      });
      break;
    case "Batch":
      return axios.post(SetBatchData, {
        values,
      });
      break;
    case "Section":
      return axios.post(SetSectionData, {
        values,
      });
      break;
    case "Branch":
      return axios.post(SetBranchData, {
        values,
      });
      break;
    default:
      return null;
      break;
  }
}
