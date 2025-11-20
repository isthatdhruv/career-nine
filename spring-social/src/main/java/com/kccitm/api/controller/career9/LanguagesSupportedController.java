package com.kccitm.api.controller.career9;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

import com.kccitm.api.model.career9.LanguagesSupported;
import com.kccitm.api.repository.Career9.LanguagesSupportedRepository;

@RestController
@RequestMapping("/language-supported")
public class LanguagesSupportedController {
    
    @Autowired
    private LanguagesSupportedRepository LanguageRepository;

    @GetMapping("/getAll")
    public List<LanguagesSupported> getAllLanguages(){
        return LanguageRepository.findAll();
    }

    @GetMapping("/get/{id}")
    public LanguagesSupported getLanguageById(Long id){
        return LanguageRepository.findById(id).orElse(null);
    }

    @PostMapping("/create")
    public LanguagesSupported createLanguagesSupported(@RequestBody LanguagesSupported language){
        return LanguageRepository.save(language);
    }


}
