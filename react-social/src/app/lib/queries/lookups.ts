import { useQuery, UseQueryOptions, UseQueryResult } from "react-query";
import { ReadQuestionSectionData } from "../../pages/QuestionSections/API/Question_Section_APIs";
import { ReadToolData } from "../../pages/Tool/API/Tool_APIs";
import { ReadCollegeData } from "../../pages/College/API/College_APIs";
import { ReadMeasuredQualityTypesData } from "../../pages/MeasuredQualityTypes/API/Measured_Quality_Types_APIs";
import { readRoleData } from "../../modules/role/components/core/Role_APIs";

export const lookupKeys = {
  questionSections: ["lookup", "questionSections"] as const,
  tools: ["lookup", "tools"] as const,
  institutes: ["lookup", "institutes"] as const,
  measuredQualityTypes: ["lookup", "measuredQualityTypes"] as const,
  roles: ["lookup", "roles"] as const,
};

type LookupOptions<T> = Omit<UseQueryOptions<T[], unknown, T[]>, "queryKey" | "queryFn">;

const unwrap = (p: Promise<any>): Promise<any> => p.then((r) => r.data);

export function useQuestionSections<T = any>(options?: LookupOptions<T>): UseQueryResult<T[]> {
  return useQuery<T[]>(lookupKeys.questionSections, () => unwrap(ReadQuestionSectionData()), options);
}

export function useTools<T = any>(options?: LookupOptions<T>): UseQueryResult<T[]> {
  return useQuery<T[]>(lookupKeys.tools, () => unwrap(ReadToolData()), options);
}

export function useInstitutes<T = any>(options?: LookupOptions<T>): UseQueryResult<T[]> {
  return useQuery<T[]>(lookupKeys.institutes, () => unwrap(ReadCollegeData()), options);
}

export function useMeasuredQualityTypes<T = any>(options?: LookupOptions<T>): UseQueryResult<T[]> {
  return useQuery<T[]>(lookupKeys.measuredQualityTypes, () => unwrap(ReadMeasuredQualityTypesData()), options);
}

export function useRoles<T = any>(options?: LookupOptions<T>): UseQueryResult<T[]> {
  return useQuery<T[]>(lookupKeys.roles, () => unwrap(readRoleData()), options);
}
