import { AssessmentQuestionOption } from './AssessmentQuestionOption.interface';
import { QuestionSection } from './QuestionSection.interface';

export interface AssessmentQuestion {
  questionId: number;
  questionText: string;
  questionSection: QuestionSection;
  assessmentQuestionOptions: AssessmentQuestionOption[];
}
