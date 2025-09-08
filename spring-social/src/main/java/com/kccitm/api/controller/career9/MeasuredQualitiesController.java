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
    public MeasuredQualities createMeasuredQualities(@RequestBody MeasuredQualities measuredQualities) {
        return measuredQualitiesRepository.save(measuredQualities);
    }

    @PutMapping("/update/{id}")
    public MeasuredQualities updateMeasuredQualities(@PathVariable Long id,
            @RequestBody MeasuredQualities measuredQualities) {
        System.out.println("Updating measured quality ID: " + id);

        // Get existing entity from database
        MeasuredQualities existingQuality = measuredQualitiesRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("MeasuredQuality not found"));

        // Update only the fields that should be updated (preserve relationships)
        existingQuality.setMeasuredQualityName(measuredQualities.getMeasuredQualityName());
        existingQuality.setMeasuredQualityDescription(measuredQualities.getMeasuredQualityDescription());
        existingQuality.setQualityDisplayName(measuredQualities.getQualityDisplayName());

        // DON'T update tools - preserve existing relationships
        // existingQuality.setTools(measuredQuality.getTools()); // Remove this line

        return measuredQualitiesRepository.save(existingQuality);
    }

    @DeleteMapping("/delete/{id}")
    public void deleteMeasuredQualities(@PathVariable Long id) {
        measuredQualitiesRepository.deleteById(id);
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
