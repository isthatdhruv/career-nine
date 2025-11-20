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
@RequestMapping("/tools")
public class ToolController {

    @Autowired
    private ToolRepository toolRepository;

    @Autowired
    private MeasuredQualitiesRepository measuredQualitiesRepository;

    @GetMapping(value = "/getAll" , headers = "Accept=application/json")
    public List<Tool> getAll() {
        return toolRepository.findAll();
    }
    @GetMapping(value = "/get/{id}" , headers = "Accept=application/json")
    public Tool getToolById(@PathVariable Long id) {
        return toolRepository.findById(id).orElse(null);
    }

    @PostMapping(value = "/create" , headers = "Accept=application/json")
    public Tool createTool(@RequestBody Tool tool) {
        if (tool.isFree()) {
            tool.setPrice(0.0);
        }
        
        return toolRepository.save(tool);
    }
    
    @PutMapping("/update/{id}")
    public Tool updateTool(@PathVariable Long id, @RequestBody Tool tool) {
        tool.setToolId(id);
        
        if (tool.isFree()) {
            tool.setPrice(0.0);
        }
        
        return toolRepository.save(tool);
    }
    @DeleteMapping("/delete/{id}")
    public ResponseEntity<String> deleteTool(@PathVariable Long id) {
        try {
            Tool tool = toolRepository.findById(id).orElse(null);
            if (tool == null) {
                return ResponseEntity.notFound().build();
            }
            
            for (MeasuredQualities quality : tool.getMeasuredQualities()) {
                quality.removeTool(tool);
                continue;
                // measuredQualitiesRepository.save(quality);
            }
            
            tool.getMeasuredQualities().clear();
            toolRepository.save(tool);
            
            toolRepository.deleteById(id);
            
            return ResponseEntity.ok("Tool deleted successfully");
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Failed to delete tool: " + e.getMessage());
        }
    }
    
    // Many-to-Many relationship management endpoints
    
    @PostMapping("/{toolId}/measured-qualities/{qualityId}")
    public ResponseEntity<String> addMeasuredQualityToTool(@PathVariable Long toolId, @PathVariable Long qualityId) {
        Tool tool = toolRepository.findById(toolId).orElse(null);
        MeasuredQualities measuredQuality = measuredQualitiesRepository.findById(qualityId).orElse(null);
        
        if (tool == null || measuredQuality == null) {
            return ResponseEntity.badRequest().body("Tool or MeasuredQuality not found");
        }
        
        measuredQuality.addTool(tool);
        measuredQualitiesRepository.save(measuredQuality);
        
        return ResponseEntity.ok("Tool successfully associated with MeasuredQuality");
    }
    
    @DeleteMapping("/{toolId}/measured-qualities/{qualityId}")
    public ResponseEntity<String> removeMeasuredQualityFromTool(@PathVariable Long toolId, @PathVariable Long qualityId) {
        Tool tool = toolRepository.findById(toolId).orElse(null);
        MeasuredQualities measuredQuality = measuredQualitiesRepository.findById(qualityId).orElse(null);
        
        if (tool == null || measuredQuality == null) {
            return ResponseEntity.badRequest().body("Tool or MeasuredQuality not found");
        }
        
        measuredQuality.removeTool(tool);
        measuredQualitiesRepository.save(measuredQuality);
        
        return ResponseEntity.ok("Tool successfully removed from MeasuredQuality");
    }
    
    @GetMapping("/{toolId}/measured-qualities")
    public ResponseEntity<Set<MeasuredQualities>> getToolMeasuredQualities(@PathVariable Long toolId) {
        Tool tool = toolRepository.findById(toolId).orElse(null);
        
        if (tool == null) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(tool.getMeasuredQualities());
    }
}

