package com.kccitm.api.controller;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.Owner;
import com.kccitm.api.model.InstituteDetail;
import com.kccitm.api.repository.OwnerRepository;
import com.kccitm.api.repository.InstituteDetailRepository;


@RestController
@RequestMapping("/owner")
public class OwnerController {

    @Autowired
    private OwnerRepository ownerRepository;

    @Autowired
    private InstituteDetailRepository instituteDetailRepository;

    // GET /owner/get
    @GetMapping("/get")
    public List<Owner> getAllOwners() {
        return ownerRepository.findAll();
    }

    // GET /owner/getbyid/{id}
    @GetMapping("/getbyid/{id}")
    public Owner getById(@PathVariable("id") Long id) {
        Optional<Owner> o = ownerRepository.findById(id);
        return o.orElse(null);
    }

    // GET /owner/getByInstitute/{instituteCode}
    @GetMapping("/getByInstitute/{instituteCode}")
    public List<Owner> getByInstitute(@PathVariable("instituteCode") int instituteCode) {
        return ownerRepository.findByInstitutes_InstituteCode(instituteCode);
    }

    // POST /owner/create
    @PostMapping("/create")
    public Owner create(@RequestBody Owner owner) {
        return ownerRepository.save(owner);
    }

    // POST /owner/update  (expects {"values": {...}}) - matches your style
    @PostMapping("/update")
    public Owner update(@RequestBody Map<String, Owner> input) {
        Owner values = input.get("values");
        if (values == null) return null;
        return ownerRepository.save(values);
    }

    // GET /owner/delete/{id}
    @GetMapping("/delete/{id}")
    public Owner delete(@PathVariable("id") Long id) {
        Optional<Owner> oOpt = ownerRepository.findById(id);
        if (oOpt.isPresent()) {
            Owner o = oOpt.get();
            ownerRepository.deleteById(id);
            return o;
        }
        return null;
    }

    /**
     * Link existing owners to an institute.
     * POST /owner/addToInstitute
     * Body example: { "ownerId": 5, "instituteCode": 123 }
     *
     * NOTE: This assumes InstituteDetail has a Set<Owner> owners field (many-to-many)
     * and InstituteDetail is the owning side of the relationship (with @JoinTable).
     */
    @PostMapping("/addToInstitute")
    public InstituteDetail addOwnerToInstitute(@RequestBody Map<String, Object> input) {
        if (input == null) return null;

        Object ownerIdObj = input.get("ownerId");
        Object instCodeObj = input.get("instituteCode");
        if (ownerIdObj == null || instCodeObj == null) return null;

        Long ownerId;
        int instituteCode;
        try {
            ownerId = Long.valueOf(String.valueOf(ownerIdObj));
            instituteCode = Integer.parseInt(String.valueOf(instCodeObj));
        } catch (Exception e) {
            return null;
        }

        Optional<Owner> ownerOpt = ownerRepository.findById(ownerId);
        InstituteDetail institute = instituteDetailRepository.findById(instituteCode); // your repo returns the entity directly

        if (ownerOpt.isEmpty() || institute == null) {
            return null;
        }

        Owner owner = ownerOpt.get();

        // initialize sets if null
        if (institute.getOwners() == null) {
            institute.setOwners(new java.util.HashSet<>());
        }
        if (owner.getInstitutes() == null) {
            owner.setInstitutes(new java.util.HashSet<>());
        }

        // link both sides
        institute.getOwners().add(owner);
        owner.getInstitutes().add(institute);

        // save owning side (institute) — that will create the join table entry
        instituteDetailRepository.save(institute);
        // also save owner to update inverse side in DB (optional but safe)
        ownerRepository.save(owner);

        return institute;
    }
}
