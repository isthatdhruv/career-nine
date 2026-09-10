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
        assertThat(ix.problems).anySatisfy(p -> assertThat(p).contains("1 option(s) without a score under Internal Drive"));
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
        other.setMeasuredQualityTypeName("Sustained Tenacity");
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
        fx.question("Grit", new int[]{1, 2, 3, 4, 5});   // old pilot type, not in the map
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
