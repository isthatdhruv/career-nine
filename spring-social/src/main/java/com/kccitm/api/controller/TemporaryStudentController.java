package com.kccitm.api.controller;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.Student;
import com.kccitm.api.repository.StudentRepository;
import com.kccitm.api.security.CurrentUser;
import com.kccitm.api.security.UserPrincipal;
import com.kccitm.api.service.GoogleCloudAPI;

@RestController
public class TemporaryStudentController {

	@Autowired
	private StudentRepository studentRepository;
	@Autowired
	GoogleCloudAPI googleCloudApi;

	@GetMapping(value = "temporary-student/get", headers = "Accept=application/json")
	public List<Student> getAllStudents() {
		List<Student> allStudents = studentRepository.findAll();
		return allStudents;
	}

	@PostMapping(value = "temporary-student/update", headers = "Accept=application/json")
	public List<Student> updateGender(@RequestBody Map<String, Student> currentGender) {
		Student r = currentGender.get("values");
		studentRepository.save(r);
		return studentRepository.findByPersonalEmailAddress(r.getPersonalEmailAddress());
	}

	@GetMapping(value = "temporary-student/delete/{name}", headers = "Accept=application/json")
	public Student deleteImage(@PathVariable("name") String data) throws IOException {
		Student student = studentRepository.getByWebcamPhoto(data);
		student.setWebcamPhoto(null);
		googleCloudApi.deleteFileFromCloud(data);
		Student r = studentRepository.save(student);
		return r;
	}

	@GetMapping(value = "temporary-student/getbyid/{id}", headers = "Accept=application/json")
	public List<Student> getBranchById(@PathVariable("id") int id) {
		List<Student> student = studentRepository.getById(id);
		return student;
	}

	@GetMapping(value = "temporary-student/getbyEmail", headers = "Accept=application/json")
	public Student getStudnetEmail(@CurrentUser UserPrincipal userPrincipal) {
		List<Student> student = studentRepository.findByPersonalEmailAddress(userPrincipal.getEmail());
		return student.get(0); 
	}

}
