package com.kccitm.api.controller;

import java.io.IOException;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.google.cloud.storage.Blob;
import com.kccitm.api.model.Student;
import com.kccitm.api.model.userDefinedModel.FileDataModal;
import com.kccitm.api.repository.StudentRepository;
import com.kccitm.api.service.GoogleCloudAPI;

@RestController
@RequestMapping("/util")
public class UtilController {

    @Autowired
    GoogleCloudAPI googleCloudApi;

    @Autowired
	private StudentRepository studentRepository;

    @PostMapping(value = "/file-upload")
    public String uploadFile(@RequestBody Map<String, FileDataModal> params) throws IOException {
        FileDataModal data = params.get("values");
        Blob blob = googleCloudApi.uploadFileToCloud(data);

        // byte[] decodedBytes = Base64.getDecoder().decode(params.get("values"));
        // FileUtils.writeByteArrayToFile(new File(outputFileName), decodedBytes);
        return blob.getName();

    }

    @GetMapping(value = "/file-get/getbyname/{name}", headers = "Accept=application/json")
    public ResponseEntity<ByteArrayResource> getfileById(@PathVariable("name") String data) throws IOException {
        Blob dataFile = googleCloudApi.getFileFromCloud(data);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(dataFile.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + dataFile.getName() + "\"")
                .body(new ByteArrayResource(dataFile.getContent()));

    }

    @GetMapping(value = "/file-delete/deletebyname/{name}", headers = "Accept=application/json")
    public ResponseEntity<ByteArrayResource> deletefileById(@PathVariable("name") String data) throws IOException, java.io.IOException {
        googleCloudApi.deleteFileFromCloud(data);
        // studentRepository.deleteBywebcamPhoto(data);
        return null;

    }

    @GetMapping(value = "file-delete/delete/{id}", headers = "Accept=application/json")
	public Student deleteUser(@PathVariable("id") int Id) {
		Student student = studentRepository.getOne(Id);
		student.setWebcamPhoto(null);
		Student r = studentRepository.save(student);
		return r;
	}
}
