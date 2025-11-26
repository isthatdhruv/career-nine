package com.kccitm.api.controller;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import javax.validation.Valid;

import org.checkerframework.checker.units.qual.C;
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

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.ContactPerson;
import com.kccitm.api.model.InstituteDetail;
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

    @DeleteMapping("/delete/{id}")
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

    @PutMapping(value = "/update/{id}", consumes = "application/json", produces = "application/json")
	public ContactPerson updateContactPerson(@PathVariable("id") Long id, @RequestBody @Valid ContactPerson payload) {
        payload.setId(id);
        ContactPerson updatedContactPerson = contactPersonRepository.save(payload);
        return updatedContactPerson;
    }

}
