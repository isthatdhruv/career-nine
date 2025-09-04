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
import com.kccitm.api.repository.Career9.ToolRepository;

@RestController
@RequestMapping("/tools")
public class ToolController {

    @Autowired
    private ToolRepository toolRepository;

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
    @PostMapping("/addSampleData")
    public String addSampleData() {
        // Add a free tool
        Tool freeTool = new Tool();
        freeTool.setName("Free Calculator");
        freeTool.setPrice(0.0);
        freeTool.setFree(true);
        toolRepository.save(freeTool);
        
        // Add a paid tool
        Tool paidTool = new Tool();
        paidTool.setName("Premium Analytics");
        paidTool.setPrice(29.99);
        paidTool.setFree(false);
        toolRepository.save(paidTool);
        
        return "Sample data added successfully";
    }
    }

