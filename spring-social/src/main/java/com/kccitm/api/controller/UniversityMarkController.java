package com.kccitm.api.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.google.gson.Gson;
import com.kccitm.api.model.UniversityMark;
import com.kccitm.api.model.userDefinedModel.Marks;
import com.kccitm.api.model.userDefinedModel.Result;
import com.kccitm.api.model.userDefinedModel.ResultClass;
import com.kccitm.api.model.userDefinedModel.UniMarksScrapping;
import com.kccitm.api.repository.UniversityMarkRepository;

@RestController
public class UniversityMarkController {

	@Autowired
	private UniversityMarkRepository universityMarkRepository;

	// @PreAuthorize("hasAuthority('Role')")
	// @GetMapping(value = "unimarks/getbyid/{id}", headers =
	// "Accept=application/json")
	// public ResultClass getRoleById(@PathVariable("id") String rollno) {
	// UniversityMark marksById = universityMarkRepository.getOne(rollno);
	// Gson g = new Gson();
	// ResultClass p = g.fromJson(marksById.getJsontext(), ResultClass.class);
	// return p;
	// }

	@GetMapping(value = "/getmarks")
	public List<ResultClass> getAllMarks() {
		List<UniversityMark> tasks = universityMarkRepository.findAll();
		List<ResultClass> list = new ArrayList<ResultClass>();
		HashMap<String, Float> map1 = new HashMap<>();
		tasks.forEach((UniversityMark uk) -> {
			Gson g = new Gson();
			ResultClass p = g.fromJson(uk.getJsontext(), ResultClass.class);
			list.add(p);
			HashMap<String, Float> map = new HashMap<>();

			for (int i = 0; i < p.result.size(); i++) {
				if (p.result.get(i).semester.isEmpty()) {
					// System.out.println(p.result.get(i).SGPA);
					p.result.remove(i);
				}
			}

			try {
				for (int i = 0; i < p.result.size(); i++) {
					if (!map.containsKey(p.result.get(i).semester) && !p.result.get(i).SGPA.equals("N/A")) {
						map.put(p.result.get(i).semester, Float.parseFloat(p.result.get(i).SGPA));
					} else {
						map.put(p.result.get(i).semester,
								Math.max(Float.parseFloat(p.result.get(i).SGPA), map.get(p.result.get(i).semester)));
					}
				}
			} catch (Exception e) {
				System.out.println("Error in parsing SGPA for rollno: " + p.rollno);
				return;
			}

			float sum = 0.0f;
			for (float f : map.values()) {
				sum += f;
			}
			sum = (sum / map.size()) * 10;
			// System.out.println("Percentage: " + sum + " %");
			map1.put(p.rollno, sum);
			// System.out.println(map1);
		});
		return list;
	}

	@GetMapping(value = "/getmarks/{id}", headers = "Accept=application/json")
	public ResultClass getRoleById(@PathVariable("id") Long rollno) {
		List<UniversityMark> list = universityMarkRepository.findAll();
		UniversityMark marksById = universityMarkRepository.getById(rollno);
		Gson g = new Gson();
		ResultClass p = g.fromJson(marksById.getJsontext(), ResultClass.class);
		HashMap<String, Float> map = new HashMap<>();
		for (int i = 0; i < p.result.size(); i++) {
			if (p.result.get(i).semester.isEmpty()) {
				// System.out.println(p.result.get(i).SGPA);
				p.result.remove(i);
			}
		}

		for (int i = 0; i < p.result.size(); i++) {

			if (!map.containsKey(p.result.get(i).semester)) {
				map.put(p.result.get(i).semester, Float.parseFloat(p.result.get(i).SGPA));
			} else {
				map.put(p.result.get(i).semester,
						Math.max(Float.parseFloat(p.result.get(i).SGPA), map.get(p.result.get(i).semester)));
			}
		}
		float sum = 0.0f;
		for (float f : map.values()) {
			sum += f;
		}
		sum = (sum / map.size()) * 10;
		System.out.println("Percentage: " + sum + " %");

		HashMap<String, Integer> map1 = new HashMap<>();
		for (int i = 0; i < p.result.size(); i++) {
			// System.out.println(p.result.get(i).result_status.charAt(0));
			if (!p.result.get(i).result_status.contains("PCP") && !p.result.get(i).result_status.contains("PWG")
					&& !p.result.get(i).result_status.contains("PASS")) {
				try {
					if (!map1.containsKey(p.result.get(i).semester) && p.result.get(i).result_status.length() >= 3) {
						System.out.println(p.result.get(i).result_status.charAt(3));

						map1.put(p.result.get(i).semester,
								(p.result.get(i).result_status.replaceAll("\\s", "").charAt(3) - '0'));

					} else {
						map1.put(p.result.get(i).semester,
								Math.min((p.result.get(i).result_status.replaceAll("\\s", "").charAt(3) - '0'),
										map1.get(p.result.get(i).semester)));
					}
				} catch (Exception e) {
					System.out.println(p.result.get(i).result_status);
					System.out.println("Error in parsing result status for rollno: " + p.rollno);
				}
			}
		}
		int sum1 = 0;
		for (int f : map1.values()) {
			sum1 += f;
		}
		System.out.println("Total Back: " + sum1);

		return p;
	}

	@PostMapping(value = "/getmarksArray", headers = "Accept=application/json")
	public List<ResultClass> getStudentMarksRollArray(@RequestBody List<Long> rollNos) {
		List<UniversityMark> marks = universityMarkRepository.findAll();
		List<UniversityMark> marksFilter = new ArrayList<>();
		List<ResultClass> results = new ArrayList<>();

		for (int i = 0; i < rollNos.size(); i++) {
			for (UniversityMark mark : marks) {
				if (mark.getRollNo() == rollNos.get(i)) {
					marksFilter.add(mark);
				}
			}
		}

		Gson gson = new Gson();
		for (UniversityMark mark : marksFilter) {
			ResultClass parsed = gson.fromJson(mark.getJsontext(), ResultClass.class);
			results.add(parsed);
		}

		return results;
	}

	@PostMapping(value = "/student/putmarks")
	public UniversityMark putUniMarks(@RequestBody UniMarksScrapping uni) {
		System.out.println("Working!!!");
		String a = uni.getHtml().toString();
		org.jsoup.nodes.Document doc = Jsoup.parse(a);

		ResultClass rc = new ResultClass(
				doc.selectFirst("span#lblFullName").ownText().toString(),
				doc.selectFirst("span#lblCourse").text(),
				doc.selectFirst("span#lblBranch").text(),
				doc.selectFirst("span#lblRollNo").text(),
				doc.selectFirst("span#lblEnrollmentNo").text(),
				doc.selectFirst("span#lblHindiName").text(),
				doc.selectFirst("span#lblFatherName").text(),
				doc.selectFirst("span#lblGender").text(), null);

		ArrayList<Result> nerArry = new ArrayList<Result>();
		for (int i = 0; i <= 200; i++) {
			for (int j = 0; j <= 200; j++) {
				if (doc.getElementById("ctl0" + i + "_ctl0" + j + "_ctl00_grdViewSubjectMarksheet") != null) {
					Result retu = new Result();

					retu.setSemester(doc.selectFirst("span#ctl0" + i + "_ctl0" + j + "_lblSemesterId").text());
					retu.setSession(doc.selectFirst("span#ctl0" + i + "_lblSession").text());
					retu.setTotal_subjects(
							doc.selectFirst("span#ctl0" + i + "_ctl0" + j + "_lblTotalSubjectsCount").text());
					retu.setPractical_subjects(
							doc.selectFirst("span#ctl0" + i + "_ctl0" + j + "_lblPracticalSubjects").text());
					retu.setResult_status(doc.selectFirst("span#ctl0" + i + "_ctl0" + j + "_lblResultStatus").text());
					retu.setDate_of_declaration(
							doc.selectFirst("span#ctl0" + i + "_ctl0" + j + "_lblDateOfDeclaration").text());
					retu.setEven_odd(doc.selectFirst("span#ctl0" + i + "_ctl0" + j + "_lblEvenOdd").text());
					retu.setTheory_subjects(
							doc.selectFirst("span#ctl0" + i + "_ctl0" + j + "_lblTheorySubjectsCount").text());
					retu.setTotal_marks_obt(
							doc.selectFirst("span#ctl0" + i + "_ctl0" + j + "_lblSemesterTotalMarksObtained").text());
					retu.setSGPA(doc.selectFirst("span#ctl0" + i + "_ctl0" + j + "_lblSGPA").text());

					Element table = doc.getElementById("ctl0" + i + "_ctl0" + j + "_ctl00_grdViewSubjectMarksheet");

					ArrayList<Marks> mark = new ArrayList<Marks>();
					if (table != null) {
						for (int y = 0; y < table.select("tbody").select("tr").size(); y++) {
							if (table.select("tbody").select("tr").get(y).select("td").size() > 5) {
								Marks mrk = new Marks();
								mrk.setCode(table.select("tbody").select("tr").get(y).select("td").get(0).text());
								mrk.setName(table.select("tbody").select("tr").get(y).select("td").get(1).text());
								mrk.setType(table.select("tbody").select("tr").get(y).select("td").get(2).text());
								mrk.setInternal(table.select("tbody").select("tr").get(y).select("td").get(3).text());
								mrk.setExternal(table.select("tbody").select("tr").get(y).select("td").get(4).text());
								mrk.setBack_paper(table.select("tbody").select("tr").get(y).select("td").get(5).text());
								mrk.setGrade(table.select("tbody").select("tr").get(y).select("td").get(6).text());
								mark.add(mrk);
							}
						}
					}
					retu.setMarks(mark);
					nerArry.add(retu);
				}
				if (doc.getElementById("ctl1" + i + "_ctl0" + j + "_ctl00_grdViewSubjectMarksheet") != null) {
					Result retu = new Result();

					retu.setSemester(doc.selectFirst("span#ctl1" + i + "_ctl0" + j + "_lblSemesterId").text());
					retu.setSession(doc.selectFirst("span#ctl1" + i + "_lblSession").text());
					retu.setTotal_subjects(
							doc.selectFirst("span#ctl1" + i + "_ctl0" + j + "_lblTotalSubjectsCount").text());
					retu.setPractical_subjects(
							doc.selectFirst("span#ctl1" + i + "_ctl0" + j + "_lblPracticalSubjects").text());
					retu.setResult_status(doc.selectFirst("span#ctl1" + i + "_ctl0" + j + "_lblResultStatus").text());
					retu.setDate_of_declaration(
							doc.selectFirst("span#ctl1" + i + "_ctl0" + j + "_lblDateOfDeclaration").text());
					retu.setEven_odd(doc.selectFirst("span#ctl1" + i + "_ctl0" + j + "_lblEvenOdd").text());
					retu.setTheory_subjects(
							doc.selectFirst("span#ctl1" + i + "_ctl0" + j + "_lblTheorySubjectsCount").text());
					retu.setTotal_marks_obt(
							doc.selectFirst("span#ctl1" + i + "_ctl0" + j + "_lblSemesterTotalMarksObtained").text());
					retu.setSGPA(doc.selectFirst("span#ctl1" + i + "_ctl0" + j + "_lblSGPA").text());

					Element table = doc.getElementById("ctl1" + i + "_ctl0" + j + "_ctl00_grdViewSubjectMarksheet");

					ArrayList<Marks> mark = new ArrayList<Marks>();
					if (table != null) {
						for (int y = 0; y < table.select("tbody").select("tr").size(); y++) {
							if (table.select("tbody").select("tr").get(y).select("td").size() > 5) {
								Marks mrk = new Marks();
								mrk.setCode(table.select("tbody").select("tr").get(y).select("td").get(0).text());
								mrk.setName(table.select("tbody").select("tr").get(y).select("td").get(1).text());
								mrk.setType(table.select("tbody").select("tr").get(y).select("td").get(2).text());
								mrk.setInternal(table.select("tbody").select("tr").get(y).select("td").get(3).text());
								mrk.setExternal(table.select("tbody").select("tr").get(y).select("td").get(4).text());
								mrk.setBack_paper(table.select("tbody").select("tr").get(y).select("td").get(5).text());
								mrk.setGrade(table.select("tbody").select("tr").get(y).select("td").get(6).text());
								mark.add(mrk);
							}
						}
					}
					retu.setMarks(mark);
					nerArry.add(retu);
				}
			}
		}
		rc.setResult(nerArry);

		Gson gson = new Gson();
		String json = gson.toJson(rc);
		System.out.println(json);
		UniversityMark um = new UniversityMark();
		um.setRollNo(Long.parseLong(uni.getRoll_no()));
		um.setJsontext(json);
		UniversityMark ty = universityMarkRepository.save(um);
		System.out.println(ty.toString());
		return ty;

	}

}
