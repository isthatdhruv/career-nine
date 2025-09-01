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
@RequestMapping("/api/tools")
public class ToolController {

    @Autowired
    private ToolRepository toolRepository;

    @GetMapping(value = "/getAll" , headers = "Accept=application/json")
    public List<Tool> getAll() {
        return toolRepository.findAll();
    }
    @GetMapping(value = "get/{id}" , headers = "Accept=application/json")
    public Tool getOptionById(@PathVariable Long id) {
        return toolRepository.getById(id);
    }

    @PostMapping(value = "create" , headers = "Accept=application/json")
    public Tool createOption(@RequestBody Tool tool) {
        return toolRepository.save(tool);
    }
    @PutMapping("/update/{id}")
    public Tool updateOption(@PathVariable Long id, @RequestBody Tool tool) {
        tool.setToolId(id);
        return toolRepository.save(tool);
    }
    @DeleteMapping("/delete/{id}")
    public void deleteOption(@PathVariable Long id) {
        toolRepository.deleteById(id);
    }
}
