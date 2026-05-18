package com.kccitm.api.controller;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.Topic;
import com.kccitm.api.repository.TopicRepository;

@RestController
public class TopicController {

	@Autowired
	private TopicRepository topicRepository;

	// no scope arg: catalog list endpoint — scope-filter narrows result set
	@PreAuthorize("@auth.allows('topic.read')")
	@GetMapping(value = "topic/get", headers = "Accept=application/json")
	public List<Topic> getAllTopics() {
		List<Topic> topics = topicRepository.findByTopic();
		return topics;
	}

	// no scope arg: fetch by id; scope-filter narrows access
	@PreAuthorize("@auth.allows('topic.read')")
	@GetMapping(value = "topic/getbyid/{id}", headers = "Accept=application/json")
	public Optional<Topic> gettopicById(@PathVariable("id") int topicId) {
		Optional<Topic> topic = topicRepository.findById(topicId);
		return topic;
	}

	// no scope arg: body is Map<String,Topic>; SpEL cannot address nested map values
	@PreAuthorize("@auth.allows('topic.update')")
	@PutMapping(value = "topic/update")
	public List<Topic> updateUser(@RequestBody Map<String, Topic> inputData) {
		Topic r = inputData.get("values");
		;
		topicRepository.save(r);
		return topicRepository.findByName(r.getName());

	}

	/*
	 * @GetMapping(value = "topic/delete/{id}", headers = "Accept=application/json")
	 * public Topic deleteUser(@PathVariable("id") int topicId) {
	 * Topic topic = topicRepository.getOne(topicId);
	 * topic.setDisplay(false);
	 * Topic r = topicRepository.save(topic);
	 * return r;
	 * }
	 */
}
