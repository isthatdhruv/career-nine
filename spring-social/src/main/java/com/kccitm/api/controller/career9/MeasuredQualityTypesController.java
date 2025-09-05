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

import com.kccitm.api.model.career9.MeasuredQualityTypes;
import com.kccitm.api.repository.Career9.MeasuredQualityTypesRepository;

@RestController
@RequestMapping("/api/measured-quality-types")
public class MeasuredQualityTypesController {
    
    @Autowired
    private MeasuredQualityTypesRepository measuredQualityTypesRepository;

    @GetMapping("/getAll")
    public List<MeasuredQualityTypes> getAllMeasuredQualityTypes() {
        return measuredQualityTypesRepository.findAll();
    }

    @GetMapping("/get/{id}")
    public MeasuredQualityTypes getMeasuredQualityTypesById(@PathVariable Long id) {
        return measuredQualityTypesRepository.findById(id).orElse(null);
    }

    @PostMapping("/create")
    public MeasuredQualityTypes createMeasuredQualityTypes(@RequestBody MeasuredQualityTypes measuredQualityTypes) {
        return measuredQualityTypesRepository.save(measuredQualityTypes);
    }
    @PutMapping("/update/{id}")
    public MeasuredQualityTypes updateMeasuredQualityTypes(@PathVariable Long id, @RequestBody MeasuredQualityTypes measuredQualityTypes) {
        measuredQualityTypes.setMeasuredQualityTypeId(id);
        return measuredQualityTypesRepository.save(measuredQualityTypes);
    }
    @DeleteMapping("/delete/{id}")
    public void deleteMeasuredQualityTypes(@PathVariable Long id) {
        measuredQualityTypesRepository.deleteById(id);
    }
}
