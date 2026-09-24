package com.kccitm.api.service.b2c.navigatorpro;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.AssessmentQuestions;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.service.b2c.navigatorpro.NavigatorProConstructMap.Construct;

/**
 * Per-questionnaire schema check. Assigns every question to the construct its
 * options are scored under, and lists every way the questionnaire deviates from
 * the September bank shape. A non-empty {@link #problems} means "not on the bank"
 * (an admin problem), which is reported as a routing error — never as a student
 * being incomplete.
 */
public final class NavigatorProQuestionnaireIndex {

    public final long questionnaireId;
    /** questionnaireQuestionId → construct key. */
    public final Map<Long, String> constructByQuestion;
    public final Map<String, Set<Long>> questionsByConstruct;
    /** questionnaireQuestionId of the single ranking question, or null when the check failed. */
    public final Long rankingQuestionId;
    /** Ranking option id → its value tag (the option's MQT name, e.g. "Pay & benefits"). */
    public final Map<Long, String> valueTagByOptionId;
    /** questionnaireQuestionId of the aspiration multi-select, or null when absent. */
    public final Long aspirationQuestionId;
    public final List<String> problems;

    private NavigatorProQuestionnaireIndex(long questionnaireId, Map<Long, String> constructByQuestion,
                                           Map<String, Set<Long>> questionsByConstruct,
                                           Long rankingQuestionId, Map<Long, String> valueTagByOptionId,
                                           Long aspirationQuestionId, List<String> problems) {
        this.questionnaireId = questionnaireId;
        this.constructByQuestion = Collections.unmodifiableMap(constructByQuestion);
        this.questionsByConstruct = Collections.unmodifiableMap(questionsByConstruct);
        this.rankingQuestionId = rankingQuestionId;
        this.valueTagByOptionId = Collections.unmodifiableMap(valueTagByOptionId);
        this.aspirationQuestionId = aspirationQuestionId;
        this.problems = Collections.unmodifiableList(problems);
    }

    public boolean valid() {
        return problems.isEmpty();
    }

    public static NavigatorProQuestionnaireIndex build(
            NavigatorProConstructMap map, long questionnaireId,
            List<QuestionnaireQuestion> questions,
            Map<Long, List<OptionScoreBasedOnMEasuredQualityTypes>> scoresByOptionId) {

        Map<Long, String> byQuestion = new HashMap<>();
        Map<String, Set<Long>> byConstruct = new TreeMap<>();
        List<String> problems = new ArrayList<>();
        List<Long> rankingIds = new ArrayList<>();
        List<Long> aspirationIds = new ArrayList<>();
        Map<Long, String> valueTags = new HashMap<>();

        for (QuestionnaireQuestion qq : questions) {
            AssessmentQuestions q = qq.getQuestion();
            if (q == null || qq.getQuestionnaireQuestionId() == null) continue;
            long qqId = qq.getQuestionnaireQuestionId();
            List<AssessmentQuestionOptions> options = q.getOptions() == null ? List.of() : q.getOptions();

            if ("ranking".equalsIgnoreCase(q.getQuestionType())) {
                rankingIds.add(qqId);
                if (options.size() != 12) {
                    problems.add("ranking question " + qqId + " has " + options.size() + " options, expected 12");
                }
                Set<String> seenTags = new TreeSet<>();
                for (AssessmentQuestionOptions o : options) {
                    String tag = null;
                    for (OptionScoreBasedOnMEasuredQualityTypes s : scoresByOptionId.getOrDefault(o.getOptionId(), List.of())) {
                        if (s.getMeasuredQualityType() != null && s.getMeasuredQualityType().getMeasuredQualityTypeName() != null) {
                            tag = s.getMeasuredQualityType().getMeasuredQualityTypeName().trim();
                            break;
                        }
                    }
                    if (tag == null) {
                        problems.add("ranking option '" + o.getOptionText() + "' has no value tag (MQT)");
                    } else if (!seenTags.add(NavigatorProConstructMap.normalize(tag))) {
                        problems.add("ranking value tag '" + tag + "' is used by two options");
                    } else {
                        valueTags.put(o.getOptionId(), tag);
                    }
                }
                continue;
            }

            boolean aspiration = !options.isEmpty();
            for (AssessmentQuestionOptions o : options) {
                List<OptionScoreBasedOnMEasuredQualityTypes> sc = scoresByOptionId.getOrDefault(o.getOptionId(), List.of());
                if (sc.isEmpty() || !sc.stream().allMatch(x -> x.getMeasuredQualityType() != null
                        && map.isAspiration(x.getMeasuredQualityType().getMeasuredQualityTypeName()))) {
                    aspiration = false;
                    break;
                }
            }
            if (aspiration) {
                aspirationIds.add(qqId);
                continue;
            }

            Set<String> constructs = new TreeSet<>();
            Map<String, Integer> scoredOptions = new HashMap<>();
            for (AssessmentQuestionOptions o : options) {
                for (OptionScoreBasedOnMEasuredQualityTypes s : scoresByOptionId.getOrDefault(o.getOptionId(), List.of())) {
                    if (s.getMeasuredQualityType() == null || s.getScore() == null) continue;
                    Optional<String> key = map.constructFor(s.getMeasuredQualityType().getMeasuredQualityTypeName());
                    if (key.isEmpty()) continue;
                    constructs.add(key.get());
                    scoredOptions.merge(key.get(), 1, Integer::sum);
                    Construct c = map.get(key.get());
                    if (s.getScore() < c.min || s.getScore() > c.max) {
                        problems.add("question " + qqId + " option '" + o.getOptionText() + "' scores " + s.getScore()
                                + " under " + c.label + " (allowed " + c.min + "-" + c.max + ")");
                    }
                }
            }
            if (constructs.isEmpty()) continue;                 // not a Navigator Pro construct → ignored
            if (constructs.size() > 1) {
                problems.add("question " + qqId + " feeds several constructs " + constructs);
                continue;
            }
            String key = constructs.iterator().next();
            int unscored = options.size() - scoredOptions.getOrDefault(key, 0);
            if (unscored > 0) {
                problems.add("question " + qqId + " has " + unscored + " option(s) without a score under " + map.label(key));
            }
            byQuestion.put(qqId, key);
            byConstruct.computeIfAbsent(key, k -> new TreeSet<>()).add(qqId);
        }

        for (Construct c : map.all()) {
            int n = byConstruct.getOrDefault(c.key, Set.of()).size();
            if (n != c.questions) {
                problems.add(c.label + " " + c.mqts + ": " + n + " question(s) scored, expected " + c.questions);
            }
        }
        if (rankingIds.size() != 1) {
            problems.add("expected exactly one ranking question, found " + rankingIds.size());
        }
        if (aspirationIds.size() > 1) {
            problems.add("expected at most one aspiration question, found " + aspirationIds.size());
        }
        return new NavigatorProQuestionnaireIndex(questionnaireId, byQuestion, byConstruct,
                rankingIds.size() == 1 ? rankingIds.get(0) : null, valueTags,
                aspirationIds.size() == 1 ? aspirationIds.get(0) : null, problems);
    }
}
