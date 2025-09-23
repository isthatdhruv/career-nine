package com.kccitm.api.controller.career9;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

import com.kccitm.api.model.career9.LanguageOption;
import com.kccitm.api.repository.Career9.LanguageOptionRepository;

@RestController
@RequestMapping("/api/options")
public class LanguageOptionsController {
    
    @Autowired
    private LanguageOptionRepository languageoption;

    @GetMapping("/getAll")
    public List<LanguageOption> getAllOptions(){
       return languageoption.findAll();
    }

    @GetMapping("/get/{id}")
    public LanguageOption getOptionsById(Long id){
       return languageoption.findById(id).orElse(null);
    }
    @PostMapping("/create")
    public LanguageOption createLanguageOption(@RequestBody LanguageOption langoption){
        return languageoption.save(langoption);
    }

}
