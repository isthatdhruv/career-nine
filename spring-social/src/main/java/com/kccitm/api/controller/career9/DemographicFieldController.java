package com.kccitm.api.controller.career9;

import java.util.List;

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

import com.kccitm.api.model.career9.DemographicFieldDefinition;
import com.kccitm.api.model.career9.DemographicFieldOption;
import com.kccitm.api.repository.Career9.DemographicFieldDefinitionRepository;

@RestController
@RequestMapping("/demographic-fields")
public class DemographicFieldController {

    @Autowired
    private DemographicFieldDefinitionRepository fieldDefinitionRepository;

    @GetMapping("/getAll")
    public List<DemographicFieldDefinition> getAll() {
        return fieldDefinitionRepository.findAll();
    }

    @GetMapping("/getActive")
    public List<DemographicFieldDefinition> getActive() {
        return fieldDefinitionRepository.findByIsActiveTrue();
    }

    @GetMapping("/get/{id}")
    public ResponseEntity<DemographicFieldDefinition> getById(@PathVariable Long id) {
        return fieldDefinitionRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/create")
    public ResponseEntity<DemographicFieldDefinition> create(@RequestBody DemographicFieldDefinition field) {
        // Set bidirectional references for options
        if (field.getOptions() != null) {
            for (DemographicFieldOption option : field.getOptions()) {
                option.setFieldDefinition(field);
            }
        }

        DemographicFieldDefinition saved = fieldDefinitionRepository.save(field);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<DemographicFieldDefinition> update(@PathVariable Long id,
            @RequestBody DemographicFieldDefinition fieldUpdate) {
        return fieldDefinitionRepository.findById(id).map(existing -> {
            existing.setFieldName(fieldUpdate.getFieldName());
            existing.setDisplayLabel(fieldUpdate.getDisplayLabel());
            existing.setFieldSource(fieldUpdate.getFieldSource());
            existing.setSystemFieldKey(fieldUpdate.getSystemFieldKey());
            existing.setDataType(fieldUpdate.getDataType());
            existing.setValidationRegex(fieldUpdate.getValidationRegex());
            existing.setValidationMessage(fieldUpdate.getValidationMessage());
            existing.setMinValue(fieldUpdate.getMinValue());
            existing.setMaxValue(fieldUpdate.getMaxValue());
            existing.setPlaceholder(fieldUpdate.getPlaceholder());
            existing.setDefaultValue(fieldUpdate.getDefaultValue());
            if (fieldUpdate.getIsActive() != null) {
                existing.setIsActive(fieldUpdate.getIsActive());
            }

            // Replace options (orphanRemoval handles deletion of old ones)
            existing.getOptions().clear();
            if (fieldUpdate.getOptions() != null) {
                for (DemographicFieldOption option : fieldUpdate.getOptions()) {
                    option.setFieldDefinition(existing);
                    existing.getOptions().add(option);
                }
            }

            return ResponseEntity.ok(fieldDefinitionRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<String> delete(@PathVariable Long id) {
        return fieldDefinitionRepository.findById(id).map(existing -> {
            // Soft delete - set isActive to false
            existing.setIsActive(false);
            fieldDefinitionRepository.save(existing);
            return ResponseEntity.ok("Field definition deactivated successfully");
        }).orElse(ResponseEntity.notFound().build());
    }
}
