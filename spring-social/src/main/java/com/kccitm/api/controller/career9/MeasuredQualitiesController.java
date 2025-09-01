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

import com.kccitm.api.model.career9.MeasuredQualities;
import com.kccitm.api.repository.Career9.MeasuredQualitiesRepository;

@RestController
@RequestMapping("/api/measured-qualities")
public class MeasuredQualitiesController {
    
    @Autowired
    private MeasuredQualitiesRepository measuredQualitiesRepository;

    @GetMapping("/getAll")
    public List<MeasuredQualities> getAllMeasuredQualities() {
        return measuredQualitiesRepository.findAll();
    }

    @GetMapping("/get/{id}")
    public MeasuredQualities getMeasuredQualitiesById(@PathVariable Long id) {
        return measuredQualitiesRepository.findById(id).orElse(null);
    }

    @PostMapping("/create")
    public MeasuredQualities createMeasuredQualities(@RequestBody MeasuredQualities measuredQualities) {
        return measuredQualitiesRepository.save(measuredQualities);
    }
    @PutMapping("/update/{id}")
    public MeasuredQualities updateMeasuredQualities(@PathVariable Long id, @RequestBody MeasuredQualities measuredQualities) {
        measuredQualities.setMeasuredQualityId(id);
        return measuredQualitiesRepository.save(measuredQualities);
    }
    @DeleteMapping("/delete/{id}")
    public void deleteMeasuredQualities(@PathVariable Long id) {
        measuredQualitiesRepository.deleteById(id);
    }
}
