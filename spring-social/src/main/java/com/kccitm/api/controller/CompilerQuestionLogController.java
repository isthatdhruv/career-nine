package com.kccitm.api.controller;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.CompilerQuestionLog;
import com.kccitm.api.repository.CompilerQuestionLogRepository;


@RestController
public class CompilerQuestionLogController {

	@Autowired
	private CompilerQuestionLogRepository compilerQuestionLogRepository;

	


	// no scope arg: body is Map<String,CompilerQuestionLog>; SpEL cannot address nested values
	@PreAuthorize("@auth.allows('compiler_question_log.create')")
	@PostMapping(value = "compiler/update")
	public List<CompilerQuestionLog> updateUser(@RequestBody Map<String, CompilerQuestionLog> inputData) {
		CompilerQuestionLog r = inputData.get("values");
		
		compilerQuestionLogRepository.save(r);
		return compilerQuestionLogRepository.findByExpectedOutput(r.getExpectedOutput());

	}

}
