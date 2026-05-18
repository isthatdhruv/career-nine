package com.kccitm.api.controller;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.CodingQuestion;
import com.kccitm.api.model.Difficulty;
import com.kccitm.api.repository.CodingQuestionRepository;
import com.kccitm.api.repository.DifficultyRepository;

import net.bytebuddy.implementation.attribute.TypeAttributeAppender.ForInstrumentedType.Differentiating;

@RestController
@RequestMapping("/coding")
public class CodingQuestionController {

    @Autowired
    private CodingQuestionRepository codingQuestionRepository;

    @Autowired
    private DifficultyRepository difficultyRepository;

    // no scope arg: body is CodingQuestion entity without scope dims; scope-filter narrows access
    @PreAuthorize("@auth.allows('coding_question.update')")
    @CrossOrigin(origins = "https://codeforces.com")
    @PostMapping("/update")
    public CodingQuestion CodingQuestionUpdate(@RequestBody CodingQuestion cd) {

        Optional<Difficulty> diffclity = difficultyRepository.findByName(cd.getDifficulty().getName().toUpperCase());
        if (diffclity.isPresent()) {
            cd.setDifficulty(diffclity.get());
        }
        Optional<CodingQuestion> cqOption = codingQuestionRepository.findByQuestionUrl(cd.getQuestionUrl());
        if (cqOption.isPresent()) {
            CodingQuestion cdOld = cqOption.get();
            cd.setId(cdOld.getId());
            return codingQuestionRepository.save(cd);
        }

        return codingQuestionRepository.save(cd);
    }

    // no scope arg: fetch by id; scope-filter narrows access
    @PreAuthorize("@auth.allows('coding_question.read')")
    @GetMapping("/get")
    public CodingQuestion CodingQuestionGet(@RequestParam int id) {

        Optional<CodingQuestion> cqOption = codingQuestionRepository.findById(id);
        if (cqOption.isPresent()) {
            return cqOption.get();
        }
        return new CodingQuestion();
    }
}
