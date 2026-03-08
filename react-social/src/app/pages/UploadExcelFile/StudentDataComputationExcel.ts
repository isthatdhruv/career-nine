import { SchoolOMRRow } from "./DataStructure";

export const setData = (
  excelData: any[],
  columnMap: Record<string, string>
): SchoolOMRRow[] => {
  return excelData.map((row) => {
    const mappedRow: any = {
      answers: [],
      measuredQualityFinalScore: [],
    };

    Object.keys(columnMap).forEach((excelCol) => {
      const schemaField = columnMap[excelCol];
      if (schemaField) {
        mappedRow[schemaField] = row[excelCol] ?? "";
      }
    });

    return mappedRow as SchoolOMRRow;
  });
};
