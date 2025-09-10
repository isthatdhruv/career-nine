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

import com.kccitm.api.model.career9.QuestionSection;
import com.kccitm.api.repository.Career9.QuestionSectionRepository;

@RestController
@RequestMapping("/api/question-sections")
public class QuestionSectionController {
    
    @Autowired
    private QuestionSectionRepository questionSectionRepository;

    @GetMapping("/getAll")
    public List<QuestionSection> getAllQuestionSections() {
        return questionSectionRepository.findAll();
    }

    @GetMapping("/get/{id}")
    public QuestionSection getQuestionSectionById(@PathVariable Long id) {
        return questionSectionRepository.findById(id).orElse(null);
    }

    @PostMapping("/create")
    public QuestionSection createQuestionSection(@RequestBody QuestionSection questionSection) {
        return questionSectionRepository.save(questionSection);
    }
    @PutMapping("/update/{id}")
    public ResponseEntity<QuestionSection> updateQuestionSection(@PathVariable Long id, @RequestBody QuestionSection questionSection) {
        QuestionSection existingSection = questionSectionRepository.findById(id).orElse(null);
        if (existingSection == null) {
            return ResponseEntity.notFound().build();
        }
        
        try {
            existingSection.setSectionName(questionSection.getSectionName());
            existingSection.setSectionDescription(questionSection.getSectionDescription());
            
            QuestionSection updatedSection = questionSectionRepository.save(existingSection);
            return ResponseEntity.ok(updatedSection);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
    @DeleteMapping("/delete/{id}")
    public ResponseEntity<String> deleteQuestionSection(@PathVariable Long id) {
        if (!questionSectionRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        
        try {
            questionSectionRepository.deleteById(id);
            return ResponseEntity.ok("Question section deleted successfully");
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Failed to delete section: " + e.getMessage());
        }
    }
    
    // Additional endpoints
    @GetMapping("/{id}/questions")
    public ResponseEntity<List<com.kccitm.api.model.career9.AssessmentQuestions>> getSectionQuestions(@PathVariable Long id) {
        QuestionSection section = questionSectionRepository.findById(id).orElse(null);
        if (section == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(section.getQuestions());
    } 
}
