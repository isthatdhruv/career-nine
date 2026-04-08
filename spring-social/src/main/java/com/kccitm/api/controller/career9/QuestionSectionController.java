package com.kccitm.api.controller.career9;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.exception.ResourceNotFoundException;
import com.kccitm.api.model.career9.AssessmentQuestions;
import com.kccitm.api.model.career9.QuestionSection;
import com.kccitm.api.repository.Career9.QuestionSectionRepository;

@RestController
@RequestMapping("/question-sections")
public class QuestionSectionController {
    
    @Autowired
    private QuestionSectionRepository questionSectionRepository;

    @GetMapping("/getAll")
    public List<QuestionSection> getAllQuestionSections() {
        return questionSectionRepository.findByIsDeletedFalseOrIsDeletedIsNull();
    }

    @GetMapping("/getAllList")
    public List<QuestionSection> getAllQuestionSectionsList() {
        return questionSectionRepository.findAllSectionsProjection();
    }

    @GetMapping("/get/{id}")
    public QuestionSection getQuestionSectionById(@PathVariable Long id) {
        return questionSectionRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("QuestionSection", "id", id));
    }

    @PostMapping("/create")
    public QuestionSection createQuestionSection(@RequestBody QuestionSection questionSection) {
        return questionSectionRepository.save(questionSection);
    }
    @PutMapping("/update/{id}")
    public ResponseEntity<QuestionSection> updateQuestionSection(@PathVariable Long id, @RequestBody QuestionSection questionSection) {
        QuestionSection existingSection = questionSectionRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("QuestionSection", "id", id));

        existingSection.setSectionName(questionSection.getSectionName());
        existingSection.setSectionDescription(questionSection.getSectionDescription());

        QuestionSection updatedSection = questionSectionRepository.save(existingSection);
        return ResponseEntity.ok(updatedSection);
    }
    @DeleteMapping("/delete/{id}")
    public ResponseEntity<String> deleteQuestionSection(@PathVariable Long id) {
        QuestionSection questionSection = questionSectionRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("QuestionSection", "id", id));
        // Set section to null for all related AssessmentQuestions
        if (questionSection.getQuestions() != null) {
            for (AssessmentQuestions question : questionSection.getQuestions()) {
                question.setSection(null);
            }
        }
        questionSection.setIsDeleted(true);
        questionSectionRepository.save(questionSection);
        return ResponseEntity.ok("Question section deleted successfully");
    }
    
    @GetMapping("/deleted")
    public List<QuestionSection> getDeletedQuestionSections() {
        return questionSectionRepository.findByIsDeletedTrue();
    }

    @PutMapping("/restore/{id}")
    public ResponseEntity<String> restoreQuestionSection(@PathVariable Long id) {
        QuestionSection qs = questionSectionRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("QuestionSection", "id", id));
        qs.setIsDeleted(false);
        questionSectionRepository.save(qs);
        return ResponseEntity.ok("Restored successfully.");
    }

    @DeleteMapping("/permanent-delete/{id}")
    public ResponseEntity<String> permanentDeleteQuestionSection(@PathVariable Long id) {
        questionSectionRepository.deleteById(id);
        return ResponseEntity.ok("Permanently deleted.");
    }

    // Additional endpoints
    @GetMapping("/{id}/questions")
    public ResponseEntity<List<com.kccitm.api.model.career9.AssessmentQuestions>> getSectionQuestions(@PathVariable Long id) {
        QuestionSection section = questionSectionRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("QuestionSection", "id", id));
        return ResponseEntity.ok(section.getQuestions());
    } 
}
