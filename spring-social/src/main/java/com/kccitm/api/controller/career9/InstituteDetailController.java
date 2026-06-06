package com.kccitm.api.controller.career9;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import com.kccitm.api.security.UserPrincipal;
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
import com.kccitm.api.security.access.AccessScope;
import com.kccitm.api.security.access.AccessScopeService;
import com.kccitm.api.service.DigitalOceanSpacesService;

@RestController
@RequestMapping("/instituteDetail")
public class InstituteDetailController {

	private static final Logger log = LoggerFactory.getLogger(InstituteDetailController.class);

	@Autowired
	private InstituteDetailRepository instituteDetailRepository;

	@Autowired
	private DigitalOceanSpacesService spacesService;

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

	@Autowired
	private AccessScopeService accessScopeService;

	/**
	 * Narrow an institute list down to the caller's allowed institute codes.
	 * Super-admins (Optional.empty()) pass through unchanged. Anyone else only
	 * sees institutes they're mapped to via ContactPerson — same source-of-truth
	 * the @PreAuthorize scope check on per-institute endpoints uses, so the
	 * dropdown and the deep-link endpoints agree on visibility.
	 */
	private Optional<Set<Integer>> scopeCodesForCurrentUser() {
		Optional<AccessScope> scope = accessScopeService.forCurrentUser();
		if (!scope.isPresent()) return Optional.empty(); // super-admin → no filter
		return Optional.of(scope.get().getAllowedInstituteCodes());
	}

	@PreAuthorize("@auth.allows('institute_detail.read.all')")
	@GetMapping("/get/list")
	public List<Map<String, Object>> getInstituteList() {
		List<Map<String, Object>> all = instituteDetailRepository.findAllIdAndName();
		Optional<Set<Integer>> allowed = scopeCodesForCurrentUser();
		// DIAG-INSTITUTE-FILTER: temporary diagnostic. Removed once dhruv-mapping is verified.
		Authentication a = SecurityContextHolder.getContext().getAuthentication();
		String who = (a != null && a.getPrincipal() instanceof UserPrincipal)
				? (((UserPrincipal) a.getPrincipal()).getEmail() + " sa=" + ((UserPrincipal) a.getPrincipal()).isSuperAdmin())
				: "anon";
		if (!allowed.isPresent()) {
			log.warn("DIAG-INSTITUTE-FILTER user={} → super-admin bypass, returning ALL {} institutes",
					who, all.size());
			return all;
		}
		Set<Integer> allowedCodes = allowed.get();
		log.warn("DIAG-INSTITUTE-FILTER user={} allowedCodes={} totalBeforeFilter={}",
				who, allowedCodes, all.size());
		List<Map<String, Object>> filtered = new ArrayList<Map<String, Object>>();
		for (Map<String, Object> row : all) {
			Object codeObj = row.get("instituteCode");
			if (codeObj instanceof Number && allowedCodes.contains(((Number) codeObj).intValue())) {
				filtered.add(row);
			}
		}
		log.warn("DIAG-INSTITUTE-FILTER user={} returning {} of {} institutes", who, filtered.size(), all.size());
		return filtered;
	}

	@PreAuthorize("@auth.allows('institute_detail.read.all')")
	@GetMapping(value = "/get", headers = "Accept=application/json")
	public List<InstituteDetail> getallInstituteDetail() {
		List<InstituteDetail> allInstituteDetails = instituteDetailRepository.findAll();
		Optional<Set<Integer>> allowed = scopeCodesForCurrentUser();
		List<InstituteDetail> allInstituteDetailsNew = new ArrayList<InstituteDetail>();
		for (InstituteDetail IdNew : allInstituteDetails) {
			if (IdNew.getDisplay() == null || !IdNew.getDisplay()) continue;
			if (allowed.isPresent()
					&& (IdNew.getInstituteCode() == null
							|| !allowed.get().contains(IdNew.getInstituteCode()))) {
				continue;
			}
			allInstituteDetailsNew.add(IdNew);
		}
		return allInstituteDetailsNew;
	}

	@PreAuthorize("@auth.allows('institute_detail.read', #instituteDetailId)")
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
	@PreAuthorize("@auth.allows('institute_detail.delete', #id)")
	@GetMapping("/delete/{id}")
	public InstituteDetail deleteUser(@PathVariable("id") Integer id) {
		InstituteDetail institute = instituteDetailRepository.findById(id.intValue());
		if (institute != null) {
			institute.setDisplay(false);
			return instituteDetailRepository.save(institute);
		}
		return null;
	}

	@PreAuthorize("@auth.allows('institute_detail.read.all')")
	@GetMapping("/deleted")
	public List<InstituteDetail> getDeletedInstitutes() {
		return instituteDetailRepository.findByDisplay(false);
	}

	@PreAuthorize("@auth.allows('institute_detail.update', #id)")
	@GetMapping("/restore/{id}")
	public InstituteDetail restoreInstitute(@PathVariable("id") Integer id) {
		InstituteDetail institute = instituteDetailRepository.findById(id.intValue());
		if (institute != null) {
			institute.setDisplay(true);
			return instituteDetailRepository.save(institute);
		}
		return null;
	}

	@PreAuthorize("@auth.allows('institute_detail.update')")
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

	/**
	 * Whitelabel: upload a school logo to DigitalOcean Spaces and return its public
	 * CDN URL. The frontend stores the returned URL into the institute's
	 * {@code logoUrl} field and persists it via {@code /update}.
	 *
	 * <p>Body: {@code { "base64Data": "data:image/png;base64,...", "instituteCode": 123,
	 * "previousUrl": "https://.../school-logos/..." }} — {@code instituteCode} and
	 * {@code previousUrl} are optional (previousUrl, if present, is deleted on success).
	 *
	 * <p><b>PNG/JPEG only.</b> The logo is reused in transactional emails, and Outlook
	 * does not render WebP — so non-PNG/JPEG uploads are rejected.
	 */
	@PreAuthorize("@auth.allows('institute_detail.update')")
	@PostMapping(value = "/upload-logo", consumes = "application/json", produces = "application/json")
	public ResponseEntity<Map<String, String>> uploadLogo(@RequestBody Map<String, Object> request) {
		Object base64Obj = request.get("base64Data");
		String base64Data = base64Obj == null ? null : base64Obj.toString();
		if (base64Data == null || base64Data.isBlank()) {
			return ResponseEntity.badRequest().body(Map.of("error", "base64Data is required"));
		}

		String head = base64Data.substring(0, Math.min(base64Data.length(), 30)).toLowerCase();
		boolean isPng = head.startsWith("data:image/png");
		boolean isJpeg = head.startsWith("data:image/jpeg") || head.startsWith("data:image/jpg");
		if (!isPng && !isJpeg) {
			return ResponseEntity.badRequest()
					.body(Map.of("error", "Logo must be a PNG or JPG/JPEG image"));
		}

		// Defense-in-depth: the data: prefix is caller-declarable, so confirm the decoded
		// bytes actually start with PNG/JPEG magic numbers (not just the claimed MIME type).
		if (!hasPngOrJpegMagic(base64Data)) {
			return ResponseEntity.badRequest()
					.body(Map.of("error", "Logo content is not a valid PNG or JPG/JPEG image"));
		}

		Object codeObj = request.get("instituteCode");
		String folder = codeObj != null ? "school-logos/institute-" + codeObj : "school-logos";

		try {
			String url = spacesService.uploadBase64File(base64Data, folder, null);
			// Best-effort cleanup of the replaced logo. Scoped to the school-logos area so a
			// crafted previousUrl cannot delete arbitrary objects elsewhere in the bucket.
			Object previousUrl = request.get("previousUrl");
			if (previousUrl != null && previousUrl.toString().contains("/school-logos/")) {
				try {
					spacesService.deleteFileByUrl(previousUrl.toString());
				} catch (Exception ignore) {
					// never fail the upload on a cleanup error
				}
			}
			return ResponseEntity.ok(Map.of("url", url));
		} catch (IllegalStateException e) {
			return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
					.body(Map.of("error", e.getMessage()));
		}
	}

	/** True if the base64 data URL decodes to bytes starting with PNG or JPEG magic numbers. */
	private boolean hasPngOrJpegMagic(String base64Data) {
		try {
			int comma = base64Data.indexOf(',');
			String raw = comma >= 0 ? base64Data.substring(comma + 1) : base64Data;
			byte[] bytes = java.util.Base64.getDecoder().decode(raw);
			if (bytes.length < 4) {
				return false;
			}
			boolean png = (bytes[0] & 0xFF) == 0x89 && (bytes[1] & 0xFF) == 0x50
					&& (bytes[2] & 0xFF) == 0x4E && (bytes[3] & 0xFF) == 0x47;
			boolean jpeg = (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8
					&& (bytes[2] & 0xFF) == 0xFF;
			return png || jpeg;
		} catch (Exception e) {
			return false;
		}
	}

	@SuppressWarnings("unchecked")
	@PreAuthorize("@auth.allows('institute_detail.update')")
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

	@PreAuthorize("@auth.allows('institute_detail.read', #instituteCode)")
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

	// ============================================================
	// Per-institute limits (max assessments allowed before allotment is blocked)
	// ============================================================

	@PreAuthorize("@auth.allows('institute_detail.read', #instituteCode)")
	@GetMapping("/{id}/limits")
	public ResponseEntity<?> getInstituteLimits(@PathVariable("id") int instituteCode) {
		InstituteDetail institute = instituteDetailRepository.findById(instituteCode);
		if (institute == null) {
			return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_FOUND)
				.body(new ApiResponse(false, "Institute not found"));
		}
		Map<String, Object> body = new java.util.HashMap<>();
		body.put("instituteCode", institute.getInstituteCode());
		body.put("maxAssessments", institute.getMaxAssessments());
		return ResponseEntity.ok(body);
	}

	@PreAuthorize("@auth.allows('institute_detail.update', #instituteCode)")
	@PutMapping("/{id}/limits")
	public ResponseEntity<?> updateInstituteLimits(
			@PathVariable("id") int instituteCode,
			@RequestBody Map<String, Object> payload) {
		InstituteDetail institute = instituteDetailRepository.findById(instituteCode);
		if (institute == null) {
			return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_FOUND)
				.body(new ApiResponse(false, "Institute not found"));
		}
		Object raw = payload.get("maxAssessments");
		Integer next;
		if (raw == null) {
			next = null;
		} else if (raw instanceof Number) {
			int v = ((Number) raw).intValue();
			if (v < 0) {
				return ResponseEntity.badRequest()
					.body(new ApiResponse(false, "maxAssessments must be non-negative"));
			}
			next = v;
		} else {
			try {
				int v = Integer.parseInt(String.valueOf(raw).trim());
				if (v < 0) {
					return ResponseEntity.badRequest()
						.body(new ApiResponse(false, "maxAssessments must be non-negative"));
				}
				next = v;
			} catch (NumberFormatException ex) {
				return ResponseEntity.badRequest()
					.body(new ApiResponse(false, "maxAssessments must be an integer"));
			}
		}
		institute.setMaxAssessments(next);
		instituteDetailRepository.save(institute);
		Map<String, Object> body = new java.util.HashMap<>();
		body.put("instituteCode", institute.getInstituteCode());
		body.put("maxAssessments", institute.getMaxAssessments());
		return ResponseEntity.ok(body);
	}

}
