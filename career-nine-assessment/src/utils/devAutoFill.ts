type Answers = Record<string, Record<number, number[]>>;
type RankingAnswers = Record<string, Record<number, Record<number, number>>>;
type TextAnswers = Record<string, Record<number, Record<number, string>>>;

type AutoFillResult = {
  answers: Answers;
  rankingAnswers: RankingAnswers;
  textAnswers: TextAnswers;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomIntInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function resolveSelectionBounds(question: any, optionCount: number): { min: number; max: number } {
  const optionsRule: 'min' | 'max' | 'equal' | null | undefined = question.optionsRule;
  const optionsCount: number | null | undefined =
    typeof question.optionsCount === 'number' ? question.optionsCount : null;
  const maxOptionsAllowed: number = question.maxOptionsAllowed ?? 0;
  const minOptionsAllowed: number | undefined = question.minOptionsAllowed;

  let min: number;
  let max: number;

  if (optionsRule && optionsCount != null && optionsCount > 0) {
    if (optionsRule === 'min') {
      min = optionsCount;
      max = 0;
    } else if (optionsRule === 'max') {
      min = 1;
      max = optionsCount;
    } else {
      min = optionsCount;
      max = optionsCount;
    }
  } else if (maxOptionsAllowed === 0) {
    min = 1;
    max = 0;
  } else {
    min = minOptionsAllowed ?? maxOptionsAllowed;
    max = maxOptionsAllowed;
  }

  if (max === 0) max = optionCount;
  min = Math.max(1, min);
  max = Math.min(optionCount, max);
  if (min > max) min = max;

  return { min, max };
}

export function generateRandomAnswers(questionnaire: any): AutoFillResult {
  const answers: Answers = {};
  const rankingAnswers: RankingAnswers = {};
  const textAnswers: TextAnswers = {};

  if (!questionnaire?.sections) return { answers, rankingAnswers, textAnswers };

  for (const section of questionnaire.sections) {
    const sectionId = String(section.section.sectionId);

    for (const q of section.questions) {
      const qId: number = q.questionnaireQuestionId;
      const question = q.question;
      const allOptions: any[] = question.options || [];
      const nonGameOptions = allOptions.filter((o) => !o.isGame);

      if (nonGameOptions.length === 0) continue;

      const isRanking = question.questionType === 'ranking';
      const isText = question.questionType === 'text' || question.isMQTtyped === true;

      if (isRanking) {
        const shuffled = shuffle(nonGameOptions);
        const rankings: Record<number, number> = {};
        shuffled.forEach((opt, idx) => {
          rankings[opt.optionId] = idx + 1;
        });
        rankingAnswers[sectionId] = rankingAnswers[sectionId] || {};
        rankingAnswers[sectionId][qId] = rankings;
        continue;
      }

      if (isText) {
        const useExistingOptionText = Math.random() < 0.5 && nonGameOptions.length > 0;
        const value = useExistingOptionText
          ? String(
              nonGameOptions[Math.floor(Math.random() * nonGameOptions.length)].optionText ?? '',
            ).trim() || `dev-autofill-${qId}-0`
          : `dev-autofill-${qId}-0`;
        textAnswers[sectionId] = textAnswers[sectionId] || {};
        textAnswers[sectionId][qId] = { 0: value };
        continue;
      }

      const { min, max } = resolveSelectionBounds(question, nonGameOptions.length);
      const k = randomIntInclusive(min, max);
      const picked = shuffle(nonGameOptions).slice(0, k).map((o) => o.optionId);
      answers[sectionId] = answers[sectionId] || {};
      answers[sectionId][qId] = picked;
    }
  }

  return { answers, rankingAnswers, textAnswers };
}
