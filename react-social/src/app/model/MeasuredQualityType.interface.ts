import { MeasuredQuality } from './MeasuredQuality.interface';

export interface MeasuredQualityType {
  measuredQualityTypeId: number;
  qualityTypeName: string;
  qualityTypeDescription: string;
  measuredQuality: MeasuredQuality;
}
