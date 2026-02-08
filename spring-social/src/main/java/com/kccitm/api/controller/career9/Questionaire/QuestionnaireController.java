package com.kccitm.api.controller.career9.Questionaire;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.LanguagesSupported;
import com.kccitm.api.model.career9.Questionaire.Questionnaire;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireLanguage;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireQuestion;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireSection;
import com.kccitm.api.model.career9.Questionaire.QuestionnaireSectionInstruction;
import com.kccitm.api.repository.Career9.LanguagesSupportedRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireRepository;
import com.kccitm.api.repository.Career9.Questionaire.QuestionnaireSectionRepository;

@RestController
@RequestMapping("/api/questionnaire")
public class QuestionnaireController {

    @Autowired
    private QuestionnaireRepository questionnaireRepository;

    @Autowired
    private QuestionnaireSectionRepository questionnaireSectionRepository;

    @Autowired
    private LanguagesSupportedRepository languagesSupportedRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @PostMapping("/questionnaire-lelo")
    public Questionnaire questionnaireLelo(@RequestBody Long assessmentTableId) {
        return questionnaireRepository.findById(assessmentTableId)
                .orElse(null);
    }

    @PostMapping("/create")
    public ResponseEntity<Questionnaire> create(
            @RequestBody Questionnaire questionnaire) {

        // Set bidirectional relationships for languages
        if (questionnaire.getLanguages() != null) {
            for (QuestionnaireLanguage language : questionnaire.getLanguages()) {
                language.setQuestionnaire(questionnaire);
                // Resolve language entity reference
                if (language.getLanguage() != null && language.getLanguage().getLanguageId() != null) {
                    LanguagesSupported managedLanguage = languagesSupportedRepository
                            .findById(language.getLanguage().getLanguageId())
                            .orElse(null);
                    if (managedLanguage != null) {
                        language.setLanguage(managedLanguage);
                    }
                }
            }
        }

        // Set bidirectional relationships for sections
        if (questionnaire.getSections() != null) {
            for (QuestionnaireSection section : questionnaire.getSections()) {
                section.setQuestionnaire(questionnaire);

                // Set relationships for questions within section
                if (section.getQuestions() != null) {
                    for (QuestionnaireQuestion question : section.getQuestions()) {
                        question.setSection(section);
                    }
                }

                // Set relationships for instructions within section
                if (section.getInstruction() != null) {
                    for (QuestionnaireSectionInstruction instruction : section.getInstruction()) {
                        instruction.setSection(section);
                        // Resolve language entity reference
                        if (instruction.getLanguage() != null && instruction.getLanguage().getLanguageId() != null) {
                            LanguagesSupported managedLanguage = languagesSupportedRepository
                                    .findById(instruction.getLanguage().getLanguageId())
                                    .orElse(null);
                            if (managedLanguage != null) {
                                instruction.setLanguage(managedLanguage);
                            }
                        }
                    }
                }
            }
        }

        Questionnaire saved = questionnaireRepository.save(questionnaire);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @GetMapping(value = "/get", headers = "Accept=application/json")
    public List<Questionnaire> getallQuestionnaire() {
        List<Questionnaire> allQuestionnaires = questionnaireRepository.findAll();

        return allQuestionnaires;
    }

    @GetMapping(value = "/get/list", headers = "Accept=application/json")
    public List<Questionnaire> getAllQuestionnaires() {
        return questionnaireRepository.findQuestionnaireList();
    }

    @GetMapping("/getbyid/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Questionnaire> getById(
            @PathVariable Long id) {

        Optional<Questionnaire> optional = questionnaireRepository.findById(id);

        return optional
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/update/{id}")
    @Transactional
    public ResponseEntity<Questionnaire> update(
            @PathVariable Long id,
            @RequestBody Questionnaire questionnaire) {

        // Resolve language references for questionnaire languages
        if (questionnaire.getLanguages() != null) {
            for (QuestionnaireLanguage language : questionnaire.getLanguages()) {
                if (language.getLanguage() != null && language.getLanguage().getLanguageId() != null) {
                    LanguagesSupported managedLanguage = languagesSupportedRepository
                            .findById(language.getLanguage().getLanguageId())
                            .orElse(null);
                    if (managedLanguage != null) {
                        language.setLanguage(managedLanguage);
                    }
                }
            }
        }

        if(questionnaire.getSections()!=null){
            for(QuestionnaireSection section :questionnaire.getSections()){
                section.setQuestionnaire(questionnaire);
                if(section.getQuestions()!=null){
                    for(QuestionnaireQuestion question: section.getQuestions()){
                        question.setSection(section);
                    }
                }
                if(section.getInstruction()!=null){
                    for(QuestionnaireSectionInstruction instruction: section.getInstruction()){
                        instruction.setSection(section);
                        // Resolve language entity reference
                        if (instruction.getLanguage() != null && instruction.getLanguage().getLanguageId() != null) {
                            LanguagesSupported managedLanguage = languagesSupportedRepository
                                    .findById(instruction.getLanguage().getLanguageId())
                                    .orElse(null);
                            if (managedLanguage != null) {
                                instruction.setLanguage(managedLanguage);
                            }
                        }
                    }
                }
            }
        }

        return questionnaireRepository.findById(id)
                .map(existing -> {
                    // Update basic fields
                    existing.setName(questionnaire.getName());
                    existing.setModeId(questionnaire.getModeId());
                    existing.setPrice(questionnaire.getPrice());
                    existing.setIsFree(questionnaire.getIsFree());
                    existing.setTool(questionnaire.getTool());
                    existing.setDisplay(questionnaire.getDisplay());
                    existing.setType(questionnaire.getType());

                    // Update languages using the new helper method
                    updateLanguages(existing, questionnaire.getLanguages());

                    // Update sections using the new helper method
                    updateSections(existing, questionnaire.getSections());

                    Questionnaire updated = questionnaireRepository.save(existing);
                    return ResponseEntity.ok(updated);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {

        if (!questionnaireRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        questionnaireRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private void updateLanguages(Questionnaire existing, java.util.List<QuestionnaireLanguage> incomingList) {
        if (incomingList == null) {
            existing.getLanguages().clear();
            return;
        }

        // Map incoming by ID for O(1) lookup
        java.util.Map<Long, QuestionnaireLanguage> incomingMap = incomingList.stream()
                .filter(l -> l.getId() != null)
                .collect(java.util.stream.Collectors.toMap(
                        QuestionnaireLanguage::getId,
                        l -> l,
                        (existingValue, newValue) -> existingValue));

        // A. Remove missing (orphans)
        existing.getLanguages().removeIf(existingLang -> existingLang.getId() != null &&
                !incomingMap.containsKey(existingLang.getId()));

        // B. Update existing and Add new
        for (QuestionnaireLanguage incoming : incomingList) {
            if (incoming.getId() == null) {
                // New item
                incoming.setQuestionnaire(existing);
                existing.getLanguages().add(incoming);
            } else {
                // Update existing
                existing.getLanguages().stream()
                        .filter(l -> l.getId().equals(incoming.getId()))
                        .findFirst()
                        .ifPresent(l -> {
                            l.setLanguage(incoming.getLanguage()); // Update mutable fields
                            l.setInstructions(incoming.getInstructions());
                            // Add other fields to update if any
                        });
            }
        }
    }

    private void updateSections(Questionnaire existing, java.util.List<QuestionnaireSection> incomingList) {
        if (incomingList == null) {
            // Only remove the mapping, not the section entity itself
            for (QuestionnaireSection section : existing.getSections()) {
                section.setQuestionnaire(null);
            }
            existing.getSections().clear();
            return;
        }

        java.util.Map<Long, QuestionnaireSection> incomingMap = incomingList.stream()
                .filter(s -> s.getQuestionnaireSectionId() != null)
                .collect(java.util.stream.Collectors.toMap(
                        QuestionnaireSection::getQuestionnaireSectionId,
                        s -> s,
                        (existingValue, newValue) -> existingValue));

        // A. Remove missing sections (remove mapping only)
        existing.getSections().removeIf(existingSection -> {
            boolean toRemove = existingSection.getQuestionnaireSectionId() != null &&
                    !incomingMap.containsKey(existingSection.getQuestionnaireSectionId());
            if (toRemove) {
                existingSection.setQuestionnaire(null);
            }
            return toRemove;
        });

        // B. Update existing and Add new
        for (QuestionnaireSection incoming : incomingList) {
            if (incoming.getQuestionnaireSectionId() == null) {
                // New Section
                incoming.setQuestionnaire(existing);
                // Ensure children have back-reference
                if (incoming.getInstruction() != null)
                    incoming.getInstruction().forEach(i -> i.setSection(incoming));
                if (incoming.getQuestions() != null)
                    incoming.getQuestions().forEach(q -> q.setSection(incoming));

                existing.getSections().add(incoming);
            } else {
                // Update Existing Section
                existing.getSections().stream()
                        .filter(s -> s.getQuestionnaireSectionId().equals(incoming.getQuestionnaireSectionId()))
                        .findFirst()
                        .ifPresent(existingSection -> {
                            existingSection.setOrder(incoming.getOrder());
                            existingSection.setSection(incoming.getSection());

                            // Recursive Update for Instructions
                            updateInstructions(existingSection, incoming.getInstruction());

                            // Recursive Update for Questions
                            updateQuestions(existingSection, incoming.getQuestions());
                        });
            }
        }
    }

    private void updateInstructions(QuestionnaireSection existingSection,
            java.util.Set<QuestionnaireSectionInstruction> incomingSet) {
        if (incomingSet == null) {
            existingSection.getInstruction().clear();
            return;
        }

        // Convert Set to List for easier handling or just stream the Set
        java.util.Map<Long, QuestionnaireSectionInstruction> incomingMap = incomingSet.stream()
                .filter(i -> i.getQuestionnaireSectionInstructionId() != null)
                .collect(java.util.stream.Collectors.toMap(
                        QuestionnaireSectionInstruction::getQuestionnaireSectionInstructionId,
                        i -> i,
                        (existingValue, newValue) -> existingValue));

        // Remove
        existingSection.getInstruction().removeIf(exist -> exist.getQuestionnaireSectionInstructionId() != null &&
                !incomingMap.containsKey(exist.getQuestionnaireSectionInstructionId()));

        // Add / Update
        for (QuestionnaireSectionInstruction incoming : incomingSet) {
            if (incoming.getQuestionnaireSectionInstructionId() == null) {
                incoming.setSection(existingSection);
                existingSection.getInstruction().add(incoming);
            } else {
                existingSection.getInstruction().stream()
                        .filter(i -> i.getQuestionnaireSectionInstructionId()
                                .equals(incoming.getQuestionnaireSectionInstructionId()))
                        .findFirst()
                        .ifPresent(exist -> {
                            exist.setInstructionText(incoming.getInstructionText());
                            exist.setLanguage(incoming.getLanguage());
                        });
            }
        }
    }

    private void updateQuestions(QuestionnaireSection existingSection,
            java.util.Set<QuestionnaireQuestion> incomingSet) {
        if (incomingSet == null) {
            existingSection.getQuestions().clear();
            return;
        }

        java.util.Map<Long, QuestionnaireQuestion> incomingMap = incomingSet.stream()
                .filter(q -> q.getQuestionnaireQuestionId() != null)
                .collect(java.util.stream.Collectors.toMap(
                        QuestionnaireQuestion::getQuestionnaireQuestionId,
                        q -> q,
                        (existingValue, newValue) -> existingValue));

        // Remove
        existingSection.getQuestions().removeIf(exist -> exist.getQuestionnaireQuestionId() != null &&
                !incomingMap.containsKey(exist.getQuestionnaireQuestionId()));

        // Add / Update
        for (QuestionnaireQuestion incoming : incomingSet) {
            if (incoming.getQuestionnaireQuestionId() == null) {
                incoming.setSection(existingSection);
                existingSection.getQuestions().add(incoming);
            } else {
                try {
                    existingSection.getQuestions().stream()
                            .filter(q -> q.getQuestionnaireQuestionId().equals(incoming.getQuestionnaireQuestionId()))
                            .findFirst()
                            .ifPresent(exist -> {
                                exist.setOrder(incoming.getOrder());
                                exist.setExcelQuestionHeader(incoming.getExcelQuestionHeader());
                                // Update the question reference if it changed
                                exist.setQuestion(incoming.getQuestion());
                            });
                } catch (Exception e) {
                    Set<QuestionnaireQuestion> existingQuestions = existingSection.getQuestions();
                    e.printStackTrace();
                }
            }
        }
    }
}
