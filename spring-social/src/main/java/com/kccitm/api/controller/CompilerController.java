package com.kccitm.api.controller;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.CodingLanguage;
import com.kccitm.api.model.CodingQuestion;
import com.kccitm.api.model.TestCase;
import com.kccitm.api.repository.CodingLanguageRepository;
import com.kccitm.api.repository.CodingQuestionRepository;
import com.kccitm.api.repository.TestCaseRepository;

@RestController
public class CompilerController {


    @Autowired
	private CodingLanguageRepository codingLanguageRepository;

	@Autowired
	private CodingQuestionRepository codingQuestionRepository;

    @Autowired
	private TestCaseRepository testCaseRepository;


	// no scope arg: catalog list; scope-filter narrows result set
	@PreAuthorize("@auth.allows('coding_question.read')")
	@GetMapping(value = "/codingquestion/get", headers = "Accept=application/json")
	public List<CodingQuestion> getAllCodingQuestion() {
		List<CodingQuestion> codingQuestion = codingQuestionRepository.findAll();
		return codingQuestion;
	}

	// no scope arg: fetch by id; scope-filter narrows access
	@PreAuthorize("@auth.allows('coding_question.read')")
	@GetMapping(value = "/codingquestion/get/{id}", headers = "Accept=application/json")
	public CodingQuestion getCodingQuestionById(@PathVariable("id") int questionId) {
		Optional<CodingQuestion> codingQuestion = codingQuestionRepository.findById(questionId);
		if(codingQuestion.isPresent())
		return codingQuestion.get();
		else
		return new CodingQuestion();
	}

	// no scope arg: body is Map<String,CodingQuestion>; SpEL cannot address nested values
	@PreAuthorize("@auth.allows('coding_question.create')")
	@PostMapping(value = "/codingquestion/save", headers = "Accept=application/json")
	public Integer setCodingQuestion(@RequestBody Map<String, CodingQuestion> inputData) {
		CodingQuestion cd = inputData.get("values");
		try {
			codingQuestionRepository.save(cd);
		} catch (Exception e) {
			System.out.println(e);
			// return false;
		}
		List<CodingQuestion> codingQuestion = codingQuestionRepository.findAll();
		CodingQuestion codingQuestionData = codingQuestion.get(codingQuestion.size() - 1);
		return codingQuestionData.getId();
	}


	// no scope arg: catalog list; scope-filter narrows result set
	@PreAuthorize("@auth.allows('compiler.read')")
    @GetMapping(value = "/testcase/get", headers = "Accept=application/json")
	public List<TestCase> getAllTestCase() {
		List<TestCase> testcase = testCaseRepository.findAll();
		return testcase;
	}

	// no scope arg: fetch by id; scope-filter narrows access
	@PreAuthorize("@auth.allows('compiler.read')")
	@GetMapping(value = "/testcase/get/{id}", headers = "Accept=application/json")
	public TestCase getAllTestCaseById(@PathVariable("id") int testcaseId) {
		Optional<TestCase> testcase = testCaseRepository.findById(testcaseId);
		if(testcase.isPresent())
		return testcase.get();
		else
		return new TestCase();
	}

	// no scope arg: body is Map<String,TestCase>; SpEL cannot address nested values
	@PreAuthorize("@auth.allows('compiler.submit')")
	@PostMapping(value = "/testcase/save", headers = "Accept=application/json")
	public boolean setTestCase(@RequestBody Map<String, TestCase> inputData) {
		TestCase cd = inputData.get("values");
		try {
			testCaseRepository.save(cd);
		} catch (Exception e) {
			System.out.println(e);
			return false;
		}
		return true;
	}
	

	// no scope arg: catalog list; scope-filter narrows result set
	@PreAuthorize("@auth.allows('compiler.read')")
     @GetMapping(value = "/codinglanguage/get", headers = "Accept=application/json")
	public List<CodingLanguage> getAllCodingLanguage() {
		List<CodingLanguage> codingLanguage = codingLanguageRepository.findAll();
		return codingLanguage;
	}

}