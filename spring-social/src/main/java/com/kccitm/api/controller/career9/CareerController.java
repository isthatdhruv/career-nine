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

import com.kccitm.api.model.career9.Career;
import com.kccitm.api.repository.Career9.CareerRepository;


@RestController
@RequestMapping("/api/career")
public class CareerController {

    @Autowired
    private CareerRepository careerRepository;

    @GetMapping("/getAll")
    public List<Career> getAllCareers() {
        return careerRepository.findAll();
    }

    @GetMapping("/get/{id}")
    public Career getCareerById(@PathVariable Long id) {
        return careerRepository.findById(id).orElse(null);
    }

    @PostMapping("/create")
    public Career createCareer(@RequestBody Career career) {
        return careerRepository.save(career);
    }
    @PutMapping("/update/{id}")
    public Career updateCareer(@PathVariable Long id, @RequestBody Career career) {
        Career existingCareer = careerRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Career not found"));

        // Only update simple fields, not relationships
        existingCareer.setTitle(career.getTitle());
        existingCareer.setDescription(career.getDescription());
        // Do NOT update measuredQualityTypes here

        return careerRepository.save(existingCareer);
    }
    @DeleteMapping("/delete/{id}")
    public org.springframework.http.ResponseEntity<String> deleteCareer(@PathVariable Long id) {
        Career career = careerRepository.findById(id).orElse(null);
        if (career == null) {
            return org.springframework.http.ResponseEntity.notFound().build();
        }
        // Remove all mappings to MeasuredQualityTypes (but do not delete the types)
        if (career.getMeasuredQualityTypes() != null) {
            career.getMeasuredQualityTypes().clear();
        }
        careerRepository.deleteById(id);
        return org.springframework.http.ResponseEntity.ok("Career deleted. All mappings to MeasuredQualityTypes removed, no types deleted.");
    }
    
    @GetMapping("/{id}/measured-quality-types")
    public List<com.kccitm.api.model.career9.MeasuredQualityTypes> getMeasuredQualityTypesForCareer(@PathVariable Long id) {
        Career career = careerRepository.findById(id).orElse(null);
        if (career == null) {
            return java.util.Collections.emptyList();
        }
        return new java.util.ArrayList<>(career.getMeasuredQualityTypes());
    }

}
