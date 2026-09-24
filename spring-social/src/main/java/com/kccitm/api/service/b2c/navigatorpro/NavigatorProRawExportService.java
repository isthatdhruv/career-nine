package com.kccitm.api.service.b2c.navigatorpro;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kccitm.api.model.career9.AssessmentQuestionOptions;
import com.kccitm.api.model.career9.OptionScoreBasedOnMEasuredQualityTypes;
import com.kccitm.api.model.career9.Questionaire.AssessmentAnswer;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.model.career9.StudentInfo;
import com.kccitm.api.model.career9.UserStudent;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireQuestionRepository;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.service.b2c.navigatorpro.NavigatorProCalculationService.Evaluation;
import com.kccitm.api.service.b2c.navigatorpro.NavigatorProNorms.NormSet;

/**
 * "Navigator Pro Raw Data" (Mira Desai → Reports Hub): one row per selected student with
 * every item mark, construct sums, v3 indices, cohort statistics, gate outcome and the full
 * blend, computed by the same engine that writes the reports. Suppressed and incomplete
 * students still get a row, with the gate that stopped them. Two further sheets carry the
 * item key and the matrices, weights and thresholds used, so any cell can be recomputed by hand.
 */
@Service
public class NavigatorProRawExportService {

    @Autowired private NavigatorProCalculationService engine;
    @Autowired private QuestionnaireQuestionRepository questionnaireQuestionRepository;
    @Autowired private StudentAssessmentMappingRepository mappingRepository;

    private static final String[] INDEX_ORDER = {"drive", "f_id", "f_st", "f_ae", "foundation", "skill", "reasoning"};
    private static final Map<String, String> INDEX_NAMES = Map.of(
            "drive", "Will", "f_id", "Self-Motivation", "f_st", "Consistency", "f_ae", "Adaptability",
            "foundation", "Foundation Skill", "skill", "Acquired Skill", "reasoning", "Everyday logic");

    @Transactional(readOnly = true)
    public byte[] export(Long assessmentId, List<Long> userStudentIds) throws IOException {
        NavigatorProQuestionnaireIndex index = engine.indexFor(assessmentId);   // routing error if not v3
        NavigatorProConstructMap map = engine.constructMap();

        // Students: the selection, else everyone mapped to the assessment.
        Set<Long> wanted = userStudentIds != null && !userStudentIds.isEmpty() ? new HashSet<>(userStudentIds) : null;
        Map<Long, StudentAssessmentMapping> mappings = new LinkedHashMap<>();
        for (StudentAssessmentMapping m : mappingRepository.findAllByAssessmentId(assessmentId)) {
            if (m.getUserStudent() == null || m.getUserStudent().getUserStudentId() == null) continue;
            Long id = m.getUserStudent().getUserStudentId();
            if (wanted == null || wanted.contains(id)) mappings.putIfAbsent(id, m);
        }
        if (mappings.isEmpty()) return null;

        Map<Long, List<AssessmentAnswer>> answers = engine.answersByStudent(assessmentId);
        Map<Long, Evaluation> evals = engine.evaluateCohort(assessmentId, index, mappings.keySet(), answers);
        NormSet norms = engine.normsFor(assessmentId, index);

        // Scored and unscored questions in questionnaire order.
        List<QuestionnaireQuestion> questions = new ArrayList<>(
                questionnaireQuestionRepository.findByQuestionnaireIdWithOptions(index.questionnaireId));
        questions.sort(Comparator.comparingInt((QuestionnaireQuestion q) -> num(q.getSection() == null ? null : q.getSection().getOrder()))
                .thenComparingInt(q -> num(q.getOrder()))
                .thenComparingLong(q -> q.getQuestionnaireQuestionId() == null ? 0 : q.getQuestionnaireQuestionId()));
        List<QuestionnaireQuestion> items = new ArrayList<>();
        for (QuestionnaireQuestion q : questions) {
            if (q.getQuestionnaireQuestionId() != null && index.constructByQuestion.containsKey(q.getQuestionnaireQuestionId())) items.add(q);
        }

        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Styles st = new Styles(wb);
            writeRawData(wb, st, map, index, items, mappings, answers, evals, norms);
            writeItemKey(wb, st, map, index, questions);
            writeSettings(wb, st, map, norms);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }

    // ── sheet 1: raw data ────────────────────────────────────────────────────

    private void writeRawData(XSSFWorkbook wb, Styles st, NavigatorProConstructMap map, NavigatorProQuestionnaireIndex index,
                              List<QuestionnaireQuestion> items, Map<Long, StudentAssessmentMapping> mappings,
                              Map<Long, List<AssessmentAnswer>> answers, Map<Long, Evaluation> evals, NormSet norms) {
        Sheet sh = wb.createSheet("Raw data");
        List<String> head = new ArrayList<>(List.of("User student ID", "Name", "Roll number", "Class", "Institute",
                "Assessment status", "Completed at", "Outcome (R1–R6)", "Gate reason", "Attention passed",
                "Validity flags", "Response-quality banner"));
        for (QuestionnaireQuestion q : items) head.add(header(q));
        for (int i = 1; i <= 4; i++) head.add("Value rank " + i);
        for (int i = 1; i <= 3; i++) head.add("Aspiration " + i);
        for (NavigatorProConstructMap.Construct c : map.all()) head.add("Σ " + c.label);
        for (String k : INDEX_ORDER) head.add(INDEX_NAMES.get(k) + (k.equals("reasoning") ? " (n/5)" : " (0–100)"));
        for (String k : NavigatorProConstructMap.SUB_KEYS) head.add(map.label(k));
        for (String k : NavigatorProConstructMap.CHECK_KEYS) head.add("Check: " + map.label(k) + " (1/0)");
        for (String k : NavigatorProConstructMap.DOMAIN_KEYS) head.add("Exposure: " + map.label(k));
        for (String k : NavigatorProConstructMap.FAMILY_KEYS) head.add("Family: " + map.label(k));
        head.addAll(List.of("Top family", "Second family", "Interest shape"));
        for (String k : INDEX_ORDER) { head.add(INDEX_NAMES.get(k) + " percentile (internal)"); head.add(INDEX_NAMES.get(k) + " band"); }
        head.addAll(List.of("Zone", "Will cut", "Skill cut", "Cohort n", "Norms provisional (n<60)", "Percentiles suppressed (n<30)"));
        for (String k : NavigatorProConstructMap.DOMAIN_KEYS) {
            String l = map.label(k);
            head.add("InterestFit: " + l); head.add("ValueAlignment: " + l); head.add("CareerScore: " + l);
        }
        for (int i = 1; i <= 12; i++) { head.add("Rank " + i); head.add("Rank " + i + " score"); }
        head.addAll(List.of("#1 − #2 gap", "#1 − #3 spread", "Max exposure", "Tie (<3)", "Explorer (R6)", "Track"));
        for (String sector : engine.blendConfig().sectorRecipes().keySet()) head.add("Sector: " + sector + "*");
        headerRow(sh, st, head);

        SimpleDateFormat df = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.ENGLISH);
        int rowNum = 1;
        for (Map.Entry<Long, StudentAssessmentMapping> e : mappings.entrySet()) {
            Long sid = e.getKey();
            StudentAssessmentMapping m = e.getValue();
            Evaluation ev = evals.get(sid);
            List<AssessmentAnswer> rows = answers.getOrDefault(sid, List.of());
            NavigatorProScores s = ev.scores;
            NavigatorProBlend.Result b = ev.blend;
            Row r = sh.createRow(rowNum++);
            int c = 0;
            UserStudent us = m.getUserStudent();
            StudentInfo si = us.getStudentInfo();
            num(r, c++, sid);
            text(r, c++, si != null ? si.getName() : "");
            text(r, c++, si != null ? si.getSchoolRollNumber() : "");
            text(r, c++, si != null ? si.getStudentClass() : "");
            text(r, c++, us.getInstitute() != null ? us.getInstitute().getInstituteName() : "");
            text(r, c++, m.getStatus());
            text(r, c++, m.getCompletedAt() == null ? "" : df.format(m.getCompletedAt()));
            text(r, c++, rows.isEmpty() ? "Not attempted" : ev.outcome());
            text(r, c++, rows.isEmpty() ? "" : ev.gateReason);
            text(r, c++, s.attentionPassed ? "Yes" : "No");
            num(r, c++, s.validityFlags);
            text(r, c++, ev.banner ? "Yes" : "No");

            Map<Long, Integer> marks = new HashMap<>();
            for (Contribution ct : engine.contributions(index, rows)) marks.merge(ct.questionId, ct.score, (a, x) -> a);
            for (QuestionnaireQuestion q : items) {
                Integer v = marks.get(q.getQuestionnaireQuestionId());
                if (v == null) c++; else num(r, c++, v);
            }
            for (int i = 0; i < 4; i++) text(r, c++, s.values.size() > i ? s.values.get(i) : "");
            for (int i = 0; i < 3; i++) text(r, c++, s.aspirations.size() > i ? map.label(s.aspirations.get(i)) : "");
            for (NavigatorProConstructMap.Construct con : map.all()) num(r, c++, s.sums.getOrDefault(con.key, 0));
            for (String k : INDEX_ORDER) num(r, c++, k.equals("reasoning") ? s.reasoning : s.get(k));
            for (String k : NavigatorProConstructMap.SUB_KEYS) num(r, c++, s.get(k));
            for (String k : NavigatorProConstructMap.CHECK_KEYS) num(r, c++, Boolean.TRUE.equals(s.checks.get(k)) ? 1 : 0);
            for (String k : NavigatorProConstructMap.DOMAIN_KEYS) num(r, c++, s.get(k));
            for (String k : NavigatorProConstructMap.FAMILY_KEYS) num(r, c++, s.get(k));
            text(r, c++, map.label(s.topFamily));
            text(r, c++, map.label(s.secondFamily));
            text(r, c++, s.flat ? "Tied" : "Clear leader");
            for (String k : INDEX_ORDER) {
                double raw = k.equals("reasoning") ? s.reasoning : s.get(k);
                Double pct = ev.suppressed() ? null : norms.percentile(k, raw);
                if (pct == null) { c++; c++; } else { num(r, c++, pct); text(r, c++, NavigatorProNorms.band(pct)); }
            }
            text(r, c++, ev.suppressed() ? "" : NavigatorProNorms.zone(s.get("drive"), s.get("skill"), norms.driveCut, norms.skillCut));
            num(r, c++, norms.driveCut);
            num(r, c++, norms.skillCut);
            num(r, c++, norms.n);
            text(r, c++, norms.provisional ? "Yes" : "No");
            text(r, c++, norms.percentilesSuppressed ? "Yes" : "No");
            if (b == null) {
                c += NavigatorProConstructMap.DOMAIN_KEYS.size() * 3 + 24 + 6 + engine.blendConfig().sectorRecipes().size();
                continue;
            }
            for (String k : NavigatorProConstructMap.DOMAIN_KEYS) {
                num(r, c++, b.interestFit.get(k)); num(r, c++, b.valueAlignment.get(k)); num(r, c++, b.careerScore.get(k));
            }
            for (int i = 1; i <= 12; i++) { text(r, c++, map.label(b.ranking.get(i - 1))); num(r, c++, b.score(i)); }
            num(r, c++, b.gap12);
            num(r, c++, b.spread13);
            num(r, c++, b.maxExposure);
            text(r, c++, b.tie ? "Yes" : "No");
            text(r, c++, b.explorer ? "Yes" : "No");
            text(r, c++, ev.trackA ? "A" : "B");
            for (double fit : b.sectors.values()) num(r, c++, fit);
        }
        sh.createFreezePane(2, 1);
    }

    // ── sheet 2: item key ────────────────────────────────────────────────────

    private void writeItemKey(XSSFWorkbook wb, Styles st, NavigatorProConstructMap map, NavigatorProQuestionnaireIndex index,
                              List<QuestionnaireQuestion> questions) {
        Sheet sh = wb.createSheet("Item key");
        headerRow(sh, st, List.of("Column header", "Questionnaire question ID", "Question ID", "Section", "Order",
                "Construct", "Construct key", "MQT(s)", "Question text", "Options = stored mark"));
        int rowNum = 1;
        for (QuestionnaireQuestion q : questions) {
            Long qqId = q.getQuestionnaireQuestionId();
            String key = qqId == null ? null : index.constructByQuestion.get(qqId);
            String role = key != null ? map.label(key)
                    : qqId != null && qqId.equals(index.rankingQuestionId) ? "Work Values (ranking, unscored)"
                    : qqId != null && qqId.equals(index.aspirationQuestionId) ? "Aspiration (unscored)" : null;
            if (role == null) continue;
            Row r = sh.createRow(rowNum++);
            int c = 0;
            text(r, c++, header(q));
            num(r, c++, qqId);
            num(r, c++, q.getQuestion() != null ? q.getQuestion().getQuestionId() : null);
            text(r, c++, q.getSection() != null && q.getSection().getSection() != null ? q.getSection().getSection().getSectionName() : "");
            text(r, c++, q.getOrder());
            text(r, c++, role);
            text(r, c++, key == null ? "" : key);
            Set<String> mqts = new LinkedHashSet<>();
            List<String> opts = new ArrayList<>();
            if (q.getQuestion() != null && q.getQuestion().getOptions() != null) {
                for (AssessmentQuestionOptions o : q.getQuestion().getOptions()) {
                    StringBuilder sb = new StringBuilder(o.getOptionText() == null ? "" : o.getOptionText());
                    if (o.getOptionScores() != null) {
                        for (OptionScoreBasedOnMEasuredQualityTypes s : o.getOptionScores()) {
                            if (s.getMeasuredQualityType() == null) continue;
                            mqts.add(s.getMeasuredQualityType().getMeasuredQualityTypeName());
                            sb.append(" = ").append(s.getScore());
                        }
                    }
                    opts.add(sb.toString());
                }
            }
            text(r, c++, String.join(", ", mqts));
            text(r, c++, q.getQuestion() != null ? q.getQuestion().getQuestionText() : "");
            text(r, c++, String.join(" | ", opts));
        }
        sh.createFreezePane(1, 1);
    }

    // ── sheet 3: matrices, weights and thresholds ───────────────────────────

    private void writeSettings(XSSFWorkbook wb, Styles st, NavigatorProConstructMap map, NormSet norms) {
        Sheet sh = wb.createSheet("Matrices & settings");
        NavigatorProBlend b = engine.blendConfig();
        int rowNum = 0;
        rowNum = section(sh, st, rowNum, "Blend weights (LOCKED, Core_Algorithm_Weightages sheet 4)");
        rowNum = pair(sh, rowNum, "Interest", b.weightInterest());
        rowNum = pair(sh, rowNum, "Exposure", b.weightExposure());
        rowNum = pair(sh, rowNum, "Values", b.weightValues());
        int[] rw = b.rankWeights();
        rowNum = pair(sh, rowNum, "Rank weights (#1..#4)", rw.length == 4 ? rw[0] + " / " + rw[1] + " / " + rw[2] + " / " + rw[3] : "");
        rowNum = pair(sh, rowNum, "ValueAlignment divisor", b.valueDivisor());
        rowNum = pair(sh, rowNum, "CareerScore", "0.40 × InterestFit + 0.40 × Exposure + 0.20 × ValueAlignment");
        rowNum = pair(sh, rowNum, "InterestFit", "Σ(weight × family %) ÷ Σ weights");
        rowNum = pair(sh, rowNum, "ValueAlignment", "Σ rank-weight × supply(career, value) ÷ 30 × 100");
        rowNum++;

        rowNum = section(sh, st, rowNum, "Thresholds (application.yml, app.navigator-pro.*)");
        for (Map.Entry<String, Object> e : engine.thresholds().entrySet()) rowNum = pair(sh, rowNum, e.getKey(), e.getValue());
        rowNum = pair(sh, rowNum, "Cohort n used for this export", norms.n);
        rowNum = pair(sh, rowNum, "Will cut / Skill cut", round(norms.driveCut) + " / " + round(norms.skillCut));
        rowNum++;

        rowNum = section(sh, st, rowNum, "Interest matrix 12×6 (3 primary · 2 secondary · 1 supporting · 0 none)");
        List<String> fams = new ArrayList<>();
        for (String f : NavigatorProConstructMap.FAMILY_KEYS) fams.add(map.label(f));
        rowNum = matrix(sh, st, rowNum, fams, b.interestMatrix(), fams);
        rowNum++;

        rowNum = section(sh, st, rowNum, "Value-supply matrix 12×12 (0–3)");
        List<String> tags = b.valueTags();
        List<String> tagKeys = new ArrayList<>();
        for (String t : tags) tagKeys.add(NavigatorProConstructMap.normalize(t));
        rowNum = matrix(sh, st, rowNum, tags, b.supplyMatrix(), tagKeys);
        rowNum++;

        rowNum = section(sh, st, rowNum, "Sector recipes (asterisked; weighted average of CareerScores)");
        for (Map.Entry<String, Map<String, Double>> e : b.sectorRecipes().entrySet()) {
            StringBuilder sb = new StringBuilder();
            for (Map.Entry<String, Double> part : e.getValue().entrySet()) {
                if (sb.length() > 0) sb.append(" + ");
                sb.append(part.getValue()).append(" × ").append(part.getKey());
            }
            rowNum = pair(sh, rowNum, e.getKey(), sb.toString());
        }
        sh.setColumnWidth(0, 44 * 256);
        sh.setColumnWidth(1, 60 * 256);
    }

    private <V extends Number> int matrix(Sheet sh, Styles st, int rowNum, List<String> colLabels,
                                          Map<String, Map<String, V>> m, List<String> colKeys) {
        List<String> head = new ArrayList<>();
        head.add("Career");
        head.addAll(colLabels);
        Row hr = sh.createRow(rowNum++);
        for (int i = 0; i < head.size(); i++) { Cell cell = hr.createCell(i); cell.setCellValue(head.get(i)); cell.setCellStyle(st.bold); }
        for (Map.Entry<String, Map<String, V>> e : m.entrySet()) {
            Row r = sh.createRow(rowNum++);
            r.createCell(0).setCellValue(e.getKey());
            for (int i = 0; i < colKeys.size(); i++) {
                V v = e.getValue().get(colKeys.get(i));
                if (v != null) r.createCell(i + 1).setCellValue(v.doubleValue());
            }
        }
        return rowNum;
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private static final class Styles {
        final CellStyle header, bold;

        Styles(XSSFWorkbook wb) {
            Font f = wb.createFont();
            f.setBold(true);
            header = wb.createCellStyle();
            header.setFont(f);
            header.setWrapText(true);
            bold = wb.createCellStyle();
            bold.setFont(f);
        }
    }

    private static void headerRow(Sheet sh, Styles st, List<String> head) {
        Row r = sh.createRow(0);
        for (int i = 0; i < head.size(); i++) {
            Cell c = r.createCell(i);
            c.setCellValue(head.get(i));
            c.setCellStyle(st.header);
            sh.setColumnWidth(i, Math.min(40, Math.max(12, head.get(i).length() + 2)) * 256);
        }
    }

    private static int section(Sheet sh, Styles st, int rowNum, String title) {
        Cell c = sh.createRow(rowNum).createCell(0);
        c.setCellValue(title);
        c.setCellStyle(st.bold);
        return rowNum + 1;
    }

    private static int pair(Sheet sh, int rowNum, String k, Object v) {
        Row r = sh.createRow(rowNum);
        r.createCell(0).setCellValue(k);
        if (v instanceof Number) r.createCell(1).setCellValue(((Number) v).doubleValue());
        else r.createCell(1).setCellValue(v == null ? "" : String.valueOf(v));
        return rowNum + 1;
    }

    /** Platform Excel header when present, else a stable fallback. */
    static String header(QuestionnaireQuestion q) {
        String h = q.getExcelQuestionHeader();
        return h != null && !h.trim().isEmpty() ? h.trim() : "Q" + q.getQuestionnaireQuestionId();
    }

    private static void text(Row r, int col, String v) {
        r.createCell(col).setCellValue(v == null ? "" : v);
    }

    private static void num(Row r, int col, Number v) {
        if (v == null) return;
        r.createCell(col).setCellValue(round(v.doubleValue()));
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static int num(String s) {
        try { return s == null ? Integer.MAX_VALUE : Integer.parseInt(s.trim()); } catch (NumberFormatException e) { return Integer.MAX_VALUE; }
    }
}
