package com.kccitm.api.service.b2c.navigatorpro;

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentQuestions;
import com.kccitm.api.model.career9.MeasuredQualityTypes;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.service.b2c.navigatorpro.NavigatorProConstructMap.Construct;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** In-memory Navigator Pro questionnaire on the v3 instrument shape, built from the construct map. */
public final class NavigatorProFixtures {

    public final NavigatorProConstructMap map = new NavigatorProConstructMap();
    public final List<QuestionnaireQuestion> questions = new ArrayList<>();
    public final Map<Long, List<OptionScoreBasedOnMEasuredQualityTypes>> scoresByOptionId = new HashMap<>();
    public final Map<String, List<QuestionnaireQuestion>> byConstruct = new LinkedHashMap<>();
    public QuestionnaireQuestion ranking;
    public QuestionnaireQuestion aspiration;
    /** Value tags in option order of the ranking question (Core Algorithm sheet 3 column order). */
    public static final List<String> VALUE_TAGS = List.of("Curiosity", "Autonomy", "Learning", "Stability",
            "Pay & benefits", "Structure", "Helping people", "Family respect", "Purpose", "Recognition",
            "Advancement", "Influence");

    private long nextQuestion = 100;
    private long nextOption = 1000;

    public static NavigatorProFixtures validQuestionnaire() {
        NavigatorProFixtures f = new NavigatorProFixtures();
        for (Construct c : f.map.all()) {
            for (int i = 0; i < c.questions; i++) {
                f.byConstruct.computeIfAbsent(c.key, k -> new ArrayList<>())
                        .add(f.question(c.mqts.get(0), scaleFor(c)));
            }
        }
        f.ranking = f.rankingQuestion();
        f.aspiration = f.aspirationQuestion();
        return f;
    }

    /** Stored option scores in option order, per construct scale. */
    static int[] scaleFor(Construct c) {
        if (c.key.equals(NavigatorProConstructMap.ATTENTION)) return new int[]{0, 1};      // Yes / No
        if (c.key.startsWith("chk_")) return new int[]{1, 0, 0, 0};                       // key first
        if (c.key.startsWith("fam_")) return new int[]{1, 0};                             // Yes / No
        if (c.max == 4) return new int[]{1, 2, 3, 4};                                     // Never … Regularly
        return new int[]{1, 2, 3, 4, 5};                                                  // agreement / intensity
    }

    /** One single-choice question whose options score {@code scores} under {@code mqtName}. */
    public QuestionnaireQuestion question(String mqtName, int[] scores) {
        AssessmentQuestions q = new AssessmentQuestions();
        q.setQuestionId(nextQuestion);
        q.setQuestionType("single-choice");
        q.setQuestionText("q" + nextQuestion);
        MeasuredQualityTypes mqt = new MeasuredQualityTypes();
        mqt.setMeasuredQualityTypeName(mqtName);
        List<AssessmentQuestionOptions> opts = new ArrayList<>();
        for (int i = 0; i < scores.length; i++) {
            AssessmentQuestionOptions o = new AssessmentQuestionOptions();
            o.setOptionId(nextOption++);
            o.setOptionText("opt" + i);
            o.setQuestion(q);
            OptionScoreBasedOnMEasuredQualityTypes s = new OptionScoreBasedOnMEasuredQualityTypes();
            s.setScore(scores[i]);
            s.setMeasuredQualityType(mqt);
            s.setQuestion_option(o);
            o.setOptionScores(new ArrayList<>(List.of(s)));
            scoresByOptionId.put(o.getOptionId(), new ArrayList<>(List.of(s)));
            opts.add(o);
        }
        q.setOptions(opts);
        QuestionnaireQuestion qq = new QuestionnaireQuestion();
        qq.setQuestionnaireQuestionId(10_000 + nextQuestion);
        qq.setQuestion(q);
        nextQuestion++;
        questions.add(qq);
        return qq;
    }

    private QuestionnaireQuestion rankingQuestion() {
        AssessmentQuestions q = new AssessmentQuestions();
        q.setQuestionId(nextQuestion);
        q.setQuestionType("ranking");
        q.setQuestionText("Choose the four that matter most");
        List<AssessmentQuestionOptions> opts = new ArrayList<>();
        for (String tag : VALUE_TAGS) {
            String text = NavigatorProContent.defaults().value(tag).orElseThrow().option;
            opts.add(taggedOption(q, text, tag));
        }
        q.setOptions(opts);
        QuestionnaireQuestion qq = new QuestionnaireQuestion();
        qq.setQuestionnaireQuestionId(10_000 + nextQuestion);
        qq.setQuestion(q);
        nextQuestion++;
        questions.add(qq);
        return qq;
    }

    private QuestionnaireQuestion aspirationQuestion() {
        AssessmentQuestions q = new AssessmentQuestions();
        q.setQuestionId(nextQuestion);
        q.setQuestionType("multiple-choice");
        q.setQuestionText("Which 2 or 3 of these areas would you most like to explore this year?");
        List<AssessmentQuestionOptions> opts = new ArrayList<>();
        for (String d : NavigatorProConstructMap.DOMAIN_KEYS) opts.add(taggedOption(q, map.label(d), "Aspiration"));
        q.setOptions(opts);
        QuestionnaireQuestion qq = new QuestionnaireQuestion();
        qq.setQuestionnaireQuestionId(10_000 + nextQuestion);
        qq.setQuestion(q);
        nextQuestion++;
        questions.add(qq);
        return qq;
    }

    /** An option scoring 1 under {@code mqtName} (value tag or Aspiration). */
    private AssessmentQuestionOptions taggedOption(AssessmentQuestions q, String text, String mqtName) {
        MeasuredQualityTypes mqt = new MeasuredQualityTypes();
        mqt.setMeasuredQualityTypeName(mqtName);
        AssessmentQuestionOptions o = new AssessmentQuestionOptions();
        o.setOptionId(nextOption++);
        o.setOptionText(text);
        o.setQuestion(q);
        OptionScoreBasedOnMEasuredQualityTypes s = new OptionScoreBasedOnMEasuredQualityTypes();
        s.setScore(1);
        s.setMeasuredQualityType(mqt);
        s.setQuestion_option(o);
        o.setOptionScores(new ArrayList<>(List.of(s)));
        scoresByOptionId.put(o.getOptionId(), new ArrayList<>(List.of(s)));
        return o;
    }

    /** Aspiration rows: one per picked domain key. */
    public List<AssessmentAnswer> aspirationAnswers(UserStudent us, String... domainKeys) {
        List<AssessmentAnswer> out = new ArrayList<>();
        for (String d : domainKeys) {
            out.add(answer(us, aspiration, NavigatorProConstructMap.DOMAIN_KEYS.indexOf(d)));
        }
        return out;
    }

    /** What OptionScoreBasedOnMeasuredQualityTypesRepository.findByOptionIdIn would return. */
    public List<OptionScoreBasedOnMEasuredQualityTypes> scoresFor(List<Long> optionIds) {
        List<OptionScoreBasedOnMEasuredQualityTypes> out = new ArrayList<>();
        for (Long id : optionIds) out.addAll(scoresByOptionId.getOrDefault(id, List.of()));
        return out;
    }

    public AssessmentAnswer answer(UserStudent us, QuestionnaireQuestion qq, int optionIndex) {
        AssessmentAnswer a = new AssessmentAnswer();
        a.setUserStudent(us);
        a.setQuestionnaireQuestion(qq);
        a.setOption(qq.getQuestion().getOptions().get(optionIndex));
        return a;
    }

    /** Ranking rows: first index = rank 1. */
    public List<AssessmentAnswer> rankingAnswers(UserStudent us, int... optionIndexes) {
        List<AssessmentAnswer> out = new ArrayList<>();
        for (int i = 0; i < optionIndexes.length; i++) {
            AssessmentAnswer a = answer(us, ranking, optionIndexes[i]);
            a.setRankOrder(i + 1);
            out.add(a);
        }
        return out;
    }

    /** Every scored question answered once, by construct family, plus the ranking rows. */
    public List<AssessmentAnswer> completeAnswers(UserStudent us, int agreeIdx, int freqIdx, int mcqIdx,
                                                  int intensityIdx, int yesIdx, int validityIdx,
                                                  int attentionIdx, int... valueIdx) {
        List<AssessmentAnswer> out = new ArrayList<>();
        for (Map.Entry<String, List<QuestionnaireQuestion>> e : byConstruct.entrySet()) {
            String k = e.getKey();
            int idx;
            if (k.equals(NavigatorProConstructMap.VALIDITY)) idx = validityIdx;
            else if (k.equals(NavigatorProConstructMap.ATTENTION)) idx = attentionIdx;
            else if (k.startsWith("f_")) idx = agreeIdx;
            else if (k.startsWith("fam_")) idx = yesIdx;
            else if (k.startsWith("fs_")) idx = freqIdx;
            else if (k.startsWith("chk_")) idx = mcqIdx;
            else idx = intensityIdx;
            for (QuestionnaireQuestion qq : e.getValue()) out.add(answer(us, qq, idx));
        }
        out.addAll(rankingAnswers(us, valueIdx));
        return out;
    }
}
