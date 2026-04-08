package com.kccitm.api.controller.career9;

import com.kccitm.api.model.career9.Career;
import com.kccitm.api.model.career9.CareerComparisonResult;
import com.kccitm.api.model.career9.CareerSuggestionResult;
import com.kccitm.api.model.career9.StudentAssessmentMapping;
import com.kccitm.api.repository.StudentAssessmentMappingRepository;
import com.kccitm.api.service.career9.CareerSuggestionService;
import com.kccitm.api.service.career9.Qwen3CareerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/career-suggestion")
public class CareerSuggestionController {

    @Autowired
    private CareerSuggestionService careerSuggestionService;

    @Autowired
    private Qwen3CareerService qwen3CareerService;

    @Autowired
    private StudentAssessmentMappingRepository mappingRepo;

    /** Returns students who have a mapping for the given assessment, for use in the frontend selector. */
    @GetMapping("/assessment/{assessmentId}/students")
    public ResponseEntity<List<Map<String, Object>>> getStudentsForAssessment(
            @PathVariable Long assessmentId) {
        List<StudentAssessmentMapping> mappings = mappingRepo.findAllByAssessmentId(assessmentId);
        List<Map<String, Object>> result = mappings.stream()
                .filter(m -> m.getUserStudent() != null)
                .map(m -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("userStudentId", m.getUserStudent().getUserStudentId());
                    String name = (m.getUserStudent().getStudentInfo() != null)
                            ? m.getUserStudent().getStudentInfo().getName()
                            : "Student #" + m.getUserStudent().getUserStudentId();
                    entry.put("name", name);
                    return entry;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/suggest/{studentId}/{assessmentId}")
    public ResponseEntity<CareerSuggestionResult> suggest(
            @PathVariable Long studentId,
            @PathVariable Long assessmentId) {
        CareerSuggestionResult result = careerSuggestionService.suggest(studentId, assessmentId);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/compare/{studentId}/{assessmentId}")
    public ResponseEntity<CareerComparisonResult> compare(
            @PathVariable Long studentId,
            @PathVariable Long assessmentId) {

        CareerSuggestionResult programResult = careerSuggestionService.suggest(studentId, assessmentId);
        CareerSuggestionResult llmResult = qwen3CareerService.suggest(studentId, assessmentId);

        CareerComparisonResult comparison = new CareerComparisonResult();
        comparison.setProgramResult(programResult);
        comparison.setLlmResult(llmResult);

        // Compute agreements and disagreements across green/orange/red
        List<String> programTitles = allTitles(programResult);
        List<String> llmTitles = allTitles(llmResult);

        List<String> agreements = programTitles.stream()
                .filter(llmTitles::contains)
                .collect(Collectors.toList());

        List<String> disagreements = new ArrayList<>();
        for (String t : programTitles) {
            if (!llmTitles.contains(t)) disagreements.add(t + " (program only)");
        }
        for (String t : llmTitles) {
            if (!programTitles.contains(t)) disagreements.add(t + " (LLM only)");
        }

        comparison.setAgreements(agreements);
        comparison.setDisagreements(disagreements);

        return ResponseEntity.ok(comparison);
    }

    private List<String> allTitles(CareerSuggestionResult result) {
        List<String> titles = new ArrayList<>();
        if (result.getGreenPathways() != null) {
            result.getGreenPathways().stream().map(Career::getTitle).forEach(titles::add);
        }
        if (result.getOrangePathways() != null) {
            result.getOrangePathways().stream().map(Career::getTitle).forEach(titles::add);
        }
        if (result.getRedPathways() != null) {
            result.getRedPathways().stream().map(Career::getTitle).forEach(titles::add);
        }
        return titles;
    }
}
