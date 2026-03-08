package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kccitm.api.model.BoardName;
import com.kccitm.api.model.ContactPerson;
import com.kccitm.api.model.InstituteBranch;
import com.kccitm.api.model.InstituteBranchBatchMapping;
import com.kccitm.api.model.InstituteCourse;
import com.kccitm.api.model.career9.school.InstituteDetail;
import com.kccitm.api.payload.ApiResponse;
import com.kccitm.api.repository.BoardNameRepository;
import com.kccitm.api.repository.ContactPersonRepository;
import com.kccitm.api.repository.InstituteBatchRepository;
import com.kccitm.api.repository.InstituteBranchBatchMappingRepository;
import com.kccitm.api.repository.InstituteBranchRepository;
import com.kccitm.api.repository.InstituteCourseRepository;
import com.kccitm.api.repository.InstituteDetailRepository;

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

	@Autowired
	private ContactPersonRepository contactPersonRepository;

	@Autowired
	private BoardNameRepository boardNameRepository;

	@GetMapping(value = "/get", headers = "Accept=application/json")
	public List<InstituteDetail> getallInstituteDetail() {
		List<InstituteDetail> allInstituteDetails = instituteDetailRepository.findAll();
		List<InstituteDetail> allInstituteDetailsNew = new ArrayList<InstituteDetail>();
		for (InstituteDetail IdNew : allInstituteDetails) {
			if (IdNew.getDisplay() != null && IdNew.getDisplay() == true) {
				// if (IdNew.getDisplay() == null) {
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

	// @GetMapping(value = "/instituteBatchAndBranchDetail/getbyid/{id}", headers =
	// "Accept=application/json")
	// public BatchBranchOption getInstituteBatchAndBranchById(@PathVariable("id")
	// int instituteDetailId) {
	// InstituteDetail instituteDetail =
	// instituteDetailRepository.findById(instituteDetailId);
	// instituteDetail.setInstituteCourse(instituteCourseRepository.findByInstituteId(instituteDetailId));
	// for (InstituteCourse ins : instituteDetail.getInstituteCourse()) {
	// ins.setInstituteBranchs(instituteBranchRepository.findByCourseId(ins.getCourseCode()));
	// for (InstituteBranch insb : ins.getInstituteBranchs()) {
	// insb.setInstituteBranchBatchMapping(
	// instituteBranchBatchMappingRepository.findByBranchId(insb.getBranchId()));
	// for (InstituteBranchBatchMapping ibbm :
	// insb.getInstituteBranchBatchMapping()) {
	// ibbm.setInstituteBatch(instituteBatchRepository.findById(ibbm.getBatchId()));
	// }
	// }
	// }
	// BatchBranchOption bbo = new BatchBranchOption(instituteDetail);
	// return bbo;
	// }

	// @GetMapping(value = "/delete/{id}", headers = "Accept=application/json")
	// public InstituteDetail deleteUser(@PathVariable("id") int instituteDetailId)
	// {
	// InstituteDetail instituteDetail =
	// instituteDetailRepository.getOne(instituteDetailId);
	// instituteDetail.setDisplay(false);
	// InstituteDetail r = instituteDetailRepository.save(instituteDetail);
	// return r;
	// }
	@GetMapping("/delete/{id}")
	public InstituteDetail deleteUser(@PathVariable("id") Integer id) {
		Optional<InstituteDetail> cpOpt = instituteDetailRepository.findById(id);
		if (cpOpt.isPresent()) {
			InstituteDetail cp = cpOpt.get();
			instituteDetailRepository.deleteById(id);
			return cp;
		}
		return null;
	}

	@PostMapping(value = "/update", consumes = "application/json", produces = "application/json")
	public InstituteDetail updateInstituteDetail(@RequestBody Map<String, InstituteDetail> payload) {
		if (payload == null || payload.isEmpty()) {
			return null;
		}

		ObjectMapper mapper = new ObjectMapper()
				.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

		InstituteDetail instituteDetail = payload.get("values");
		InstituteDetail saved = instituteDetailRepository.save(instituteDetail);

		return saved;
	}

	@SuppressWarnings("unchecked")
	@PostMapping(value = "/map-contacts-boards")
	public ResponseEntity<?> mapContactsAndBoards(@RequestBody Map<String, Object> payload) {
		Integer instituteCode = (Integer) payload.get("instituteCode");
		List<Integer> contactPersonIds = (List<Integer>) payload.get("contactPersonIds");
		List<Integer> boardIds = (List<Integer>) payload.get("boardIds");

		if (instituteCode == null) {
			return ResponseEntity.badRequest()
				.body(new ApiResponse(false, "instituteCode is required"));
		}

		InstituteDetail institute = instituteDetailRepository.findById(instituteCode.intValue());
		if (institute == null) {
			return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_FOUND)
				.body(new ApiResponse(false, "Institute not found"));
		}

		// Unmap old contact persons (set their institute to null)
		List<ContactPerson> oldContacts = contactPersonRepository.findByInstitute_InstituteCode(instituteCode);
		for (ContactPerson cp : oldContacts) {
			cp.setInstitute(null);
			contactPersonRepository.save(cp);
		}

		// Map new contact persons to this institute
		if (contactPersonIds != null) {
			for (Integer cpId : contactPersonIds) {
				Optional<ContactPerson> cpOpt = contactPersonRepository.findById(cpId.longValue());
				if (cpOpt.isPresent()) {
					cpOpt.get().setInstitute(institute);
					contactPersonRepository.save(cpOpt.get());
				}
			}
		}

		// Set boards via ManyToMany
		Set<BoardName> boardSet = new HashSet<>();
		if (boardIds != null) {
			for (Integer boardId : boardIds) {
				Optional<BoardName> boardOpt = boardNameRepository.findById(boardId);
				if (boardOpt.isPresent()) {
					boardSet.add(boardOpt.get());
				}
			}
		}
		institute.setBoards(boardSet);
		instituteDetailRepository.save(institute);

		return ResponseEntity.ok(new ApiResponse(true, "Contacts and boards mapped successfully"));
	}

	@GetMapping(value = "/get-mappings/{id}")
	public ResponseEntity<?> getMappings(@PathVariable("id") int instituteCode) {
		InstituteDetail institute = instituteDetailRepository.findById(instituteCode);
		if (institute == null) {
			return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_FOUND)
				.body(new ApiResponse(false, "Institute not found"));
		}

		List<ContactPerson> contacts = contactPersonRepository.findByInstitute_InstituteCode(instituteCode);
		Set<BoardName> boards = institute.getBoards();

		Map<String, Object> result = new java.util.HashMap<>();
		result.put("contactPersons", contacts);
		result.put("boards", boards);
		return ResponseEntity.ok(result);
	}

}
