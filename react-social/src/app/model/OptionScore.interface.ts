import { AssessmentQuestionOption } from './AssessmentQuestionOption.interface';
import { MeasuredQualityType } from './MeasuredQualityType.interface';

export interface OptionScore {
  optionScoreId: number;
  scoreValue: number;
  assessmentQuestionOption: AssessmentQuestionOption;
  measuredQualityType: MeasuredQualityType;
}
