package com.kccitm.api.controller.career9;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
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
    public QuestionSection updateQuestionSection(@PathVariable Long id, @RequestBody QuestionSection questionSection) {
        System.out.println("Updating question section with ID: " + id);
        System.out.println("Request body: " + questionSection.toString());
        
        // Ensure the ID is set correctly
        questionSection.setSectionId(id);
        
        // Check if the entity exists first
        if (!questionSectionRepository.existsById(id)) {
            throw new RuntimeException("Question section with ID " + id + " not found");
        }
        
        QuestionSection updatedSection = questionSectionRepository.save(questionSection);
        System.out.println("Successfully updated question section: " + updatedSection.toString());
        return updatedSection;
    }
    @DeleteMapping("/delete/{id}")
    public void deleteQuestionSection(@PathVariable Long id) {
        questionSectionRepository.deleteById(id);
    } 
}
