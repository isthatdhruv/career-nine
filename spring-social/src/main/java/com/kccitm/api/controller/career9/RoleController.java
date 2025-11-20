package com.kccitm.api.controller.career9;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import java.util.List;
import com.kccitm.api.repository.career9.RoleRepository;
import com.kccitm.api.model.career9.Role;

@RestController
@RequestMapping("/role")
public class RoleController {
    @Autowired
    private RoleRepository roleRepository;
    
    @GetMapping("/all")
    public List<Role> getAllRoles() {
        return roleRepository.findAll();
    }

    @PostMapping("/add")
    public Role addRole(@RequestBody Role role) {
        return roleRepository.save(role);
    }
}