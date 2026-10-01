package com.kccitm.api.service.b2c.navigatorpro;

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.MeasuredQualityTypes;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;

import static org.assertj.core.api.Assertions.assertThat;

class NavigatorProQuestionnaireIndexTest {

    private NavigatorProQuestionnaireIndex build(NavigatorProFixtures fx) {
        return NavigatorProQuestionnaireIndex.build(fx.map, 20L, fx.questions, fx.scoresByOptionId);
    }

    @Test
    void validQuestionnaire_indexesEveryConstruct() {
        NavigatorProFixtures fx = NavigatorProFixtures.validQuestionnaire();
        NavigatorProQuestionnaireIndex ix = build(fx);
        assertThat(ix.problems).isEmpty();
        assertThat(ix.valid()).isTrue();
        assertThat(ix.questionsByConstruct.get("fs_tp")).hasSize(6);
        assertThat(ix.questionsByConstruct.get("d_pe")).hasSize(1);
        assertThat(ix.constructByQuestion).hasSize(90);
        assertThat(ix.rankingQuestionId).isEqualTo(fx.ranking.getQuestionnaireQuestionId());
        assertThat(ix.valueTagByOptionId).hasSize(12).containsValues("Pay & benefits", "Influence");
        assertThat(ix.aspirationQuestionId).isEqualTo(fx.aspiration.getQuestionnaireQuestionId());
        assertThat(ix.constructByQuestion).doesNotContainKey(fx.aspiration.getQuestionnaireQuestionId());
    }

    @Test
    void rankingOptionWithoutValueTag_isReported() {
        NavigatorProFixtures fx = NavigatorProFixtures.validQuestionnaire();
        AssessmentQuestionOptions o = fx.ranking.getQuestion().getOptions().get(3);
        fx.scoresByOptionId.put(o.getOptionId(), new ArrayList<>());
        NavigatorProQuestionnaireIndex ix = build(fx);
        assertThat(ix.problems).anySatisfy(p -> assertThat(p).contains("has no value tag"));
    }

    @Test
    void sharedPilotReasoningType_failsTheFiveChecks() {
        NavigatorProFixtures fx = NavigatorProFixtures.validQuestionnaire();
        for (String k : NavigatorProConstructMap.CHECK_KEYS) {
            QuestionnaireQuestion qq = fx.byConstruct.get(k).get(0);
            for (AssessmentQuestionOptions o : qq.getQuestion().getOptions()) {
                fx.scoresByOptionId.get(o.getOptionId()).get(0).getMeasuredQualityType().setMeasuredQualityTypeName("Cognitive Check");
            }
        }
        NavigatorProQuestionnaireIndex ix = build(fx);
        assertThat(ix.problems).anySatisfy(p -> assertThat(p).contains("Applied numeracy").contains("0 question(s) scored, expected 1"));
    }

    @Test
    void missingQuestion_isReportedWithLabelAndExpectedCount() {
        NavigatorProFixtures fx = NavigatorProFixtures.validQuestionnaire();
        fx.questions.remove(fx.byConstruct.get("chk_spr").get(0));
        NavigatorProQuestionnaireIndex ix = build(fx);
        assertThat(ix.valid()).isFalse();
        assertThat(ix.problems).anySatisfy(p -> assertThat(p).contains("Spreadsheet logic").contains("0 question(s) scored, expected 1"));
    }

    @Test
    void optionWithoutScore_isReported() {
        NavigatorProFixtures fx = NavigatorProFixtures.validQuestionnaire();
        QuestionnaireQuestion qq = fx.byConstruct.get("f_id").get(0);
        AssessmentQuestionOptions last = qq.getQuestion().getOptions().get(4);
        fx.scoresByOptionId.put(last.getOptionId(), new ArrayList<>());
        NavigatorProQuestionnaireIndex ix = build(fx);
        assertThat(ix.problems).anySatisfy(p -> assertThat(p).contains("1 option(s) without a score under Self-Motivation"));
    }

    @Test
    void scoreOutOfRange_isReported() {
        NavigatorProFixtures fx = NavigatorProFixtures.validQuestionnaire();
        QuestionnaireQuestion qq = fx.byConstruct.get("fam_r").get(0);
        fx.scoresByOptionId.get(qq.getQuestion().getOptions().get(0).getOptionId()).get(0).setScore(2);
        NavigatorProQuestionnaireIndex ix = build(fx);
        assertThat(ix.problems).anySatisfy(p -> assertThat(p).contains("scores 2 under Hands-on (allowed 0-1)"));
    }

    @Test
    void questionFeedingTwoConstructs_isReported() {
        NavigatorProFixtures fx = NavigatorProFixtures.validQuestionnaire();
        QuestionnaireQuestion qq = fx.byConstruct.get("f_id").get(0);
        MeasuredQualityTypes other = new MeasuredQualityTypes();
        other.setMeasuredQualityTypeName("Perseverance");
        for (AssessmentQuestionOptions o : qq.getQuestion().getOptions()) {
            OptionScoreBasedOnMEasuredQualityTypes s = new OptionScoreBasedOnMEasuredQualityTypes();
            s.setScore(3);
            s.setMeasuredQualityType(other);
            fx.scoresByOptionId.get(o.getOptionId()).add(s);
        }
        NavigatorProQuestionnaireIndex ix = build(fx);
        assertThat(ix.problems).anySatisfy(p -> assertThat(p).contains("feeds several constructs"));
    }

    @Test
    void unmappedMqt_isIgnored() {
        NavigatorProFixtures fx = NavigatorProFixtures.validQuestionnaire();
        fx.question("Grit", new int[]{1, 2, 3, 4, 5});   // retired pilot type, not in the map
        NavigatorProQuestionnaireIndex ix = build(fx);
        assertThat(ix.valid()).isTrue();
    }

    @Test
    void twoRankingQuestions_isReported() {
        NavigatorProFixtures fx = NavigatorProFixtures.validQuestionnaire();
        fx.questions.add(fx.ranking);   // same question listed twice
        NavigatorProQuestionnaireIndex ix = build(fx);
        assertThat(ix.problems).anySatisfy(p -> assertThat(p).contains("exactly one ranking question, found 2"));
        assertThat(ix.rankingQuestionId).isNull();
    }
}
