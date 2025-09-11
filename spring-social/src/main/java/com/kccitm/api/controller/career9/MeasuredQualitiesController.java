package com.kccitm.api.controller.career9;

import java.util.List;
import java.util.Set;

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

import com.kccitm.api.model.career9.MeasuredQualities;
import com.kccitm.api.model.career9.Tool;
import com.kccitm.api.repository.Career9.MeasuredQualitiesRepository;
import com.kccitm.api.repository.Career9.ToolRepository;

@RestController
@RequestMapping("/api/measured-qualities")
public class MeasuredQualitiesController {

    @Autowired
    private MeasuredQualitiesRepository measuredQualitiesRepository;

    @Autowired
    private ToolRepository toolRepository;

    @GetMapping("/getAll")
    public List<MeasuredQualities> getAllMeasuredQualities() {
        return measuredQualitiesRepository.findAll();
    }

    @GetMapping("/get/{id}")
    public MeasuredQualities getMeasuredQualitiesById(@PathVariable Long id) {
        return measuredQualitiesRepository.findById(id).orElse(null);
    }

    @PostMapping("/create")
    public ResponseEntity<MeasuredQualities> createMeasuredQualities(@RequestBody MeasuredQualities measuredQualities) {
        try {
            // Don't automatically set tools relationships during creation
            // This should be done via separate relationship management endpoints
            MeasuredQualities savedQuality = measuredQualitiesRepository.save(measuredQualities);
            return ResponseEntity.ok(savedQuality);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/update/{id}")
    public MeasuredQualities updateMeasuredQualities(@PathVariable Long id,
            @RequestBody MeasuredQualities measuredQualities) {

        MeasuredQualities existingQuality = measuredQualitiesRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("MeasuredQuality not found"));

        existingQuality.setMeasuredQualityName(measuredQualities.getMeasuredQualityName());
        existingQuality.setMeasuredQualityDescription(measuredQualities.getMeasuredQualityDescription());
        existingQuality.setQualityDisplayName(measuredQualities.getQualityDisplayName());

        return measuredQualitiesRepository.save(existingQuality);
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<String> deleteMeasuredQualities(@PathVariable Long id) {
        MeasuredQualities measuredQuality = measuredQualitiesRepository.findById(id).orElse(null);
        if (measuredQuality == null) {
            return ResponseEntity.notFound().build();
        }
        // Remove all mappings to MeasuredQualityTypes (but do not delete the types)
        if (measuredQuality.getQualityTypes() != null) {
            for (var type : measuredQuality.getQualityTypes()) {
                type.setMeasuredQuality(null); // Remove the back-reference if it exists
            }
            measuredQuality.getQualityTypes().clear();
        }
        measuredQualitiesRepository.deleteById(id);
        return ResponseEntity.ok("MeasuredQualities deleted. All mappings to MeasuredQualityTypes removed, no types deleted.");
    }

    // Many-to-Many relationship management endpoints for Tools

    @PostMapping("/{qualityId}/tools/{toolId}")
    public ResponseEntity<String> addToolToMeasuredQuality(@PathVariable Long qualityId, @PathVariable Long toolId) {
        MeasuredQualities measuredQuality = measuredQualitiesRepository.findById(qualityId).orElse(null);
        Tool tool = toolRepository.findById(toolId).orElse(null);

        if (measuredQuality == null || tool == null) {
            return ResponseEntity.badRequest().body("MeasuredQuality or Tool not found");
        }

        measuredQuality.addTool(tool);
        measuredQualitiesRepository.save(measuredQuality);

        return ResponseEntity.ok("Tool successfully associated with MeasuredQuality");
    }

    @DeleteMapping("/{qualityId}/tools/{toolId}")
    public ResponseEntity<String> removeToolFromMeasuredQuality(@PathVariable Long qualityId,
            @PathVariable Long toolId) {
        MeasuredQualities measuredQuality = measuredQualitiesRepository.findById(qualityId).orElse(null);
        Tool tool = toolRepository.findById(toolId).orElse(null);

        if (measuredQuality == null || tool == null) {
            return ResponseEntity.badRequest().body("MeasuredQuality or Tool not found");
        }

        measuredQuality.removeTool(tool);
        measuredQualitiesRepository.save(measuredQuality);

        return ResponseEntity.ok("Tool successfully removed from MeasuredQuality");
    }

    @GetMapping("/{qualityId}/tools")
    public ResponseEntity<Set<Tool>> getMeasuredQualityTools(@PathVariable Long qualityId) {
        MeasuredQualities measuredQuality = measuredQualitiesRepository.findById(qualityId).orElse(null);

        if (measuredQuality == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(measuredQuality.getTools());
    }
}
