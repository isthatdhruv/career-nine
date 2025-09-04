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

import com.kccitm.api.model.career9.Tool;
import com.kccitm.api.repository.Career9.MeasuredQualitiesRepository;
import com.kccitm.api.repository.Career9.ToolRepository;

@RestController
@RequestMapping("/api/tools")
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
        System.out.println("Creating tool: " + tool.getName() + ", isFree: " + tool.isFree() + ", price: " + tool.getPrice());
        
        // Ensure data consistency
        if (tool.isFree()) {
            tool.setPrice(0.0);
        }
        
        return toolRepository.save(tool);
    }
    
    @PutMapping("/update/{id}")
    public Tool updateTool(@PathVariable Long id, @RequestBody Tool tool) {
        System.out.println("Updating tool ID: " + id + ", name: " + tool.getName() + ", isFree: " + tool.isFree() + ", price: " + tool.getPrice());
        
        tool.setToolId(id);
        
        // Ensure data consistency
        if (tool.isFree()) {
            tool.setPrice(0.0);
        }
        
        return toolRepository.save(tool);
    }
    @DeleteMapping("/delete/{id}")
    public void deleteTool(@PathVariable Long id) {
        toolRepository.deleteById(id);
    }
    
    // Test endpoint to add sample data
    
    }

