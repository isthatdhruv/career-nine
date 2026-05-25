import { AssessmentQuestion } from './AssessmentQuestion.interface';
import { OptionScore } from './OptionScore.interface';
import { GameTable } from './GameTable.interface';

export interface AssessmentQuestionOption {
  optionId: number;
  optionText: string;
  description: string;
  assessmentQuestion: AssessmentQuestion;
  optionScores: OptionScore[];
  optionImageUrl?: string;
  isGame?: boolean;
  game?: GameTable;
}
