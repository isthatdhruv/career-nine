import { Tool } from './Tool.interface';

export interface MeasuredQuality {
  tools: Tool[];
  measuredQualityName: string;
  measuredQualityDescription: string;
  qualityDisplayName: string;
  measuredQualityId: number;
}
