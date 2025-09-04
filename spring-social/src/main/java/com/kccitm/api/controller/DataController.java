package com.kccitm.api.controller;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.Student;
import com.kccitm.api.repository.StudentRepository;

@RestController
public class DataController {

    @Autowired
    private StudentRepository studentRepository;

    @GetMapping(value = "db/get", headers = "Accept=application/json")
    public void main(String[] args) throws SQLException, ClassNotFoundException {
        // TODO Auto-generated method stub
        String maxSalary = null;
        Class.forName("com.mysql.jdbc.Driver");
        Connection con = DriverManager.getConnection("jdbc:mysql://easylearning.guru/kcc_student?"
                + "user=kcccrm&password=Bombay0084!");
        String Query = "SELECT * FROM kcc_student.students LIMIT 8";
        Statement st = con.createStatement();

        // st.ex
        ResultSet rs = st.executeQuery(Query);
        List<Student> stl = new ArrayList<Student>();
        while (rs.next()) {
            Student ts = new Student();

            ts.setFirstName(rs.getString("FName"));
            ts.setMiddleName(rs.getString("MName"));
            ts.setLastName(rs.getString("LName"));
            ts.set_0thMarks(rs.getString("10thMarks"));
            ts.set_0thRollNo(rs.getString("10thRollNo"));
            // ts.set_0thboard(rs.getString("10thboard"));
            // ts.set_2thboardSS(rs.getString("12thboardSS"));
            ts.set_2thMarksChemistry(rs.getString("12thMarksChemistry"));
            ts.set_2thMarksMaths(rs.getString("12thMarksMaths"));
            ts.set_2thMarksPhysics(rs.getString("12thMarksPhysics"));
            ts.set_2thRollNoss(rs.getString("12thRollNoSS"));
            ts.setAadharCardNo(rs.getString("AadharCardNo"));
            var batch = rs.getString("Batch");
            if (batch == "2018-22") {
                ts.setBatch_id(10);
            } else {
                ts.setBatch_id(1);
            }
            var branch = rs.getString("Branch");
            ts.setBirthdayMail(rs.getString("birthdayMail"));
            if (branch == "CSE") {
                ts.setBranch_id(1);
            } else {
                ts.setBranch_id(10);
            }
            // ts.setCategory(rs.getString("category"));
            ts.setCourse(rs.getInt("Course"));
            ts.setCryptoWalletAddress(rs.getString("cryptoWalletAddress"));
            ts.setCurrentAddress(rs.getString("CurrentAddress"));
            ts.setDob(rs.getString("DOB"));
            ts.setPersonalEmailAddress(rs.getString("EmailAddress"));
            ts.setFatherName(rs.getString("FatherName"));
            ts.setFatherPhoneNumber(rs.getString("FatherPhoneNumber"));
            // ts.setGender(rs.getString("Gender"));
            ts.setGenerate(rs.getString("Generate"));
            ts.setHindiName(rs.getString("HindiName"));
            ts.setIpfsPdfUrl(rs.getString("ipfsPdfUrl"));
            ts.setIpfsUrl(rs.getString("ipfsUrl"));
            ts.setMotherName(rs.getString("MotherName"));
            ts.setNftHashCode(rs.getString("nftHashCode"));
            ts.setPermanentAddress(rs.getString("PermanentAddress"));
            ts.setPhoneNumber(rs.getString("PhoneNumber"));
            ts.setDisplay(rs.getByte("display"));
            ts.setRollNo((int) rs.getLong("Roll No."));
            System.out.println("Saving data for" + rs.getString("FName"));
            stl.add(ts);
            // maxSalary = rs.getString("first_name");
            // System.out.println("hellllloooooooo");
        }

        studentRepository.saveAllAndFlush(stl);

        // System.out.println("The name of employee who has the higher salary is :");

    }
}
