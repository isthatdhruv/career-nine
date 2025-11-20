package com.kccitm.api.controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import java.util.List;
import com.kccitm.api.repository.CoordinatorRepository;
import com.kccitm.api.model.Coordinator;


@RestController
@RequestMapping("/faculty")
public class CoordinatorController {

    @Autowired
    private CoordinatorRepository coordinatorRepository;
    
    @GetMapping("/all")
    public List<Coordinator> getAllCoordinators() {
        return coordinatorRepository.findAll();
    }

    @PostMapping("/add")
    public Coordinator addCoordinator(@RequestBody Coordinator coordinator) {
        return coordinatorRepository.save(coordinator);
    }
}
