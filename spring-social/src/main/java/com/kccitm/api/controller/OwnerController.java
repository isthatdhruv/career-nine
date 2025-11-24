package com.kccitm.api.controller;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import com.kccitm.api.model.ContactPerson;
import com.kccitm.api.model.InstituteBranch;
import com.kccitm.api.model.InstituteBranchBatchMapping;
import com.kccitm.api.model.InstituteCourse;
import com.kccitm.api.model.InstituteDetail;
import com.kccitm.api.model.Owner;
import com.kccitm.api.model.userDefinedModel.BatchBranchOption;
import com.kccitm.api.repository.ContactPersonRepository;
import com.kccitm.api.repository.InstituteBatchRepository;
import com.kccitm.api.repository.InstituteBranchBatchMappingRepository;
import com.kccitm.api.repository.InstituteBranchRepository;
import com.kccitm.api.repository.InstituteCourseRepository;
import com.kccitm.api.repository.InstituteDetailRepository;
import com.kccitm.api.repository.OwnerRepository;

@RestController
@RequestMapping("/instituteDetail")
public class InstituteDetailController {

    @Autowired
    private InstituteDetailRepository instituteDetailRepository;

    @Autowired
    private InstituteCourseRepository instituteCourseRepository;

    @Autowired
    private InstituteBranchRepository instituteBranchRepository;

    @Autowired
    private InstituteBranchBatchMappingRepository instituteBranchBatchMappingRepository;

    @Autowired
    private InstituteBatchRepository instituteBatchRepository;

    // Minimal additional repositories for nested endpoints
    @Autowired
    private ContactPersonRepository contactPersonRepository;

    @Autowired
    private OwnerRepository ownerRepository;

    /* ---------------- existing endpoints (kept as in your reference) ---------------- */

    @GetMapping(value = "/get", headers = "Accept=application/json")
    public List<InstituteDetail> getallInstituteDetail() {
        List<InstituteDetail> allInstituteDetails = instituteDetailRepository.findAll();
        List<InstituteDetail> allInstituteDetailsNew = new ArrayList<InstituteDetail>();
        for (InstituteDetail IdNew : allInstituteDetails) {
            if (IdNew.getDisplay() != null && IdNew.getDisplay() == true) {
                allInstituteDetailsNew.add(IdNew);
            }
        }
        return allInstituteDetailsNew;
    }

    @GetMapping(value = "/getbyid/{id}", headers = "Accept=application/json")
    public InstituteDetail getInstituteDetailById(@PathVariable("id") int instituteDetailId) {
        InstituteDetail instituteDetail = instituteDetailRepository.findById(instituteDetailId);
        instituteDetail.setInstituteCourse(instituteCourseRepository.findByInstituteId(instituteDetailId));
        for (InstituteCourse ins : instituteDetail.getInstituteCourse()) {
            ins.setInstituteBranchs(instituteBranchRepository.findByCourseId(ins.getCourseCode()));
            for (InstituteBranch insb : ins.getInstituteBranchs()) {
                insb.setInstituteBranchBatchMapping(
                        instituteBranchBatchMappingRepository.findByBranchId(insb.getBranchId()));
                for (InstituteBranchBatchMapping ibbm : insb.getInstituteBranchBatchMapping()) {
                    ibbm.setInstituteBatch(instituteBatchRepository.findById(ibbm.getBatchId()));
                }
            }
        }
        return instituteDetail;
    }

    @GetMapping(value = "/instituteBatchAndBranchDetail/getbyid/{id}", headers = "Accept=application/json")
    public BatchBranchOption getInstituteBatchAndBranchById(@PathVariable("id") int instituteDetailId) {
        InstituteDetail instituteDetail = instituteDetailRepository.findById(instituteDetailId);
        instituteDetail.setInstituteCourse(instituteCourseRepository.findByInstituteId(instituteDetailId));
        for (InstituteCourse ins : instituteDetail.getInstituteCourse()) {
            ins.setInstituteBranchs(instituteBranchRepository.findByCourseId(ins.getCourseCode()));
            for (InstituteBranch insb : ins.getInstituteBranchs()) {
                insb.setInstituteBranchBatchMapping(
                        instituteBranchBatchMappingRepository.findByBranchId(insb.getBranchId()));
                for (InstituteBranchBatchMapping ibbm : insb.getInstituteBranchBatchMapping()) {
                    ibbm.setInstituteBatch(instituteBatchRepository.findById(ibbm.getBatchId()));
                }
            }
        }
        BatchBranchOption bbo = new BatchBranchOption(instituteDetail);
        return bbo;
    }

    @PostMapping(value = "/instituteDetail/update", headers = "Accept=application/json")
    public List<InstituteDetail> updateInstituteDetail(@RequestBody Map<String, InstituteDetail> inputData) {
        InstituteDetail r = inputData.get("values");
        instituteDetailRepository.save(r);
        return instituteDetailRepository.findByInstituteName(r.getInstituteName());
    }

    @GetMapping(value = "/instituteDetail/delete/{id}", headers = "Accept=application/json")
    public InstituteDetail deleteUser(@PathVariable("id") int instituteDetailId) {
        InstituteDetail instituteDetail = instituteDetailRepository.getOne(instituteDetailId);
        instituteDetail.setDisplay(false);
        InstituteDetail r = instituteDetailRepository.save(instituteDetail);
        return r;
    }

    @PostMapping(value = "/instituteDetail/create", headers = "Accept=application/json")
    public void createInstituteDetail(@RequestBody InstituteDetail instituteDetail) {
        instituteDetailRepository.save(instituteDetail);
    }

    /* ---------------- minimal nested endpoints you asked for ---------------- */

    // GET /instituteDetail/{id}/contactPerson
    @GetMapping("/{id}/contactPerson")
    public List<ContactPerson> getContactPersonsByInstitute(@PathVariable("id") int instituteCode) {
        return contactPersonRepository.findByInstitute_InstituteCode(instituteCode);
    }

    // POST /instituteDetail/{id}/contactPerson
    @PostMapping("/{id}/contactPerson")
    public ContactPerson addContactPerson(@PathVariable("id") int instituteCode,
                                          @RequestBody ContactPerson contactPerson) {

        InstituteDetail inst = instituteDetailRepository.findById(instituteCode);
        if (inst == null) return null;

        // link and save
        contactPerson.setInstitute(inst);
        ContactPerson saved = contactPersonRepository.save(contactPerson);

        // optional: keep institute collection in sync
        if (inst.getContactPersons() != null) {
            inst.getContactPersons().add(saved);
            instituteDetailRepository.save(inst);
        }

        return saved;
    }

    // POST /instituteDetail/{id}/owners  body: [1,2,3] or [ownerId]
    @PostMapping("/{id}/owners")
    public InstituteDetail addOwnersToInstitute(@PathVariable("id") int instituteCode,
                                                @RequestBody List<Long> ownerIds) {

        InstituteDetail inst = instituteDetailRepository.findById(instituteCode);
        if (inst == null) return null;

        if (inst.getOwners() == null) inst.setOwners(new HashSet<>());

        for (Long ownerId : ownerIds) {
            Optional<Owner> ownerOpt = ownerRepository.findById(ownerId);
            if (ownerOpt.isPresent()) {
                Owner owner = ownerOpt.get();
                inst.getOwners().add(owner);

                // optional inverse sync
                if (owner.getInstitutes() == null) owner.setInstitutes(new HashSet<>());
                owner.getInstitutes().add(inst);

                // save owner to persist inverse side (optional)
                ownerRepository.save(owner);
            }
        }

        // institute is owning side for join table — save it
        return instituteDetailRepository.save(inst);
    }

}
