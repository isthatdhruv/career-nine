package com.kccitm.api.controller;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.ContactPerson;
import com.kccitm.api.repository.ContactPersonRepository;
@RestController
@RequestMapping("/contact-person")
public class ContactPersonController {

    @Autowired
    private ContactPersonRepository contactPersonRepository;

    @GetMapping(value = "/getAll", headers = "Accept=application/json")
    public List<ContactPerson> getAllContactPersons() {
        return contactPersonRepository.findAll();
    }

    @GetMapping(value = "/get/{id}", headers = "Accept=application/json")
    public ContactPerson getContactPersonById(@PathVariable("id") Long contactPersonId) {
        return contactPersonRepository.findById(contactPersonId).orElse(null);
    }

    @GetMapping("/delete/{id}")
    public ContactPerson deleteContactPerson(@PathVariable("id") Long id) {
        Optional<ContactPerson> cpOpt = contactPersonRepository.findById(id);
        if (cpOpt.isPresent()) {
            ContactPerson cp = cpOpt.get();
            contactPersonRepository.deleteById(id);
            return cp;
        }
        return null;
    }

    @PostMapping("/create")
    public ContactPerson createContactPerson(@RequestBody ContactPerson contactPerson) {
        return contactPersonRepository.save(contactPerson);
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<?> updateContactPerson(@PathVariable Long id, @RequestBody ContactPerson body) {
        Optional<ContactPerson> opt = contactPersonRepository.findById(id);
        if (!opt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("ContactPerson not found");
        }

        ContactPerson existing = opt.get();

        existing.setName(body.getName());
        existing.setEmail(body.getEmail());
        existing.setPhoneNumber(body.getPhoneNumber()); 
        existing.setDesignation(body.getDesignation());
        existing.setGender(body.getGender());

        ContactPerson saved = contactPersonRepository.save(existing);
        return ResponseEntity.ok(saved);
    }

}
