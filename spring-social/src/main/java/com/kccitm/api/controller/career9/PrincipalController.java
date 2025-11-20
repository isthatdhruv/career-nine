package com.kccitm.api.controller.career9;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Autowired;
import com.kccitm.api.repository.career9.PrincipalRepository;
import com.kccitm.api.model.career9.Principal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import java.util.List;


@RestController
@RequestMapping("/principal")
public class PrincipalController {
    @Autowired
    private PrincipalRepository principalRepository;
    
    @GetMapping("/all")
    public List<Principal> getAllPrincipals() {
        return principalRepository.findAll();
    }

    @PostMapping("/add")
    public Principal addPrincipal(@RequestBody Principal principal) {
        return principalRepository.save(principal);
    }
}