package com.kccitm.api.controller;


@RestController
@RequestMapping("/contactPerson")
public class ContactPersonController {

    @Autowired
    private ContactPersonRepository contactPersonRepository;

    @GetMapping(value = "/get", headers = "Accept=application/json")
    public List<ContactPerson> getAllContactPersons() {
        return contactPersonRepository.findAll();
    }

    @GetMapping(value = "/getbyid/{id}", headers = "Accept=application/json")
    public ContactPerson getContactPersonById(@PathVariable("id") Long contactPersonId) {
        return contactPersonRepository.findById(contactPersonId);
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
    
}