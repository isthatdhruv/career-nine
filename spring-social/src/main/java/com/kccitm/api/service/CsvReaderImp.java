package com.kccitm.api.service;
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;

public class CsvReaderImp implements CsvReader{
     public void CsvReader(){
      // ArrayList<String> csvdata;
        String line = "";
        String splitBy = ",";
        try {
          //parsing a CSV file into BufferedReader class constructor  
          BufferedReader br = new BufferedReader(new FileReader("/home/kcc/Downloads/1.csv"));
         
          while ((line = br.readLine()) != null)
          //returns a Boolean value  
          {
            String[] student = line.split(splitBy);
            //use comma as separator
            // csvdata.add(student[0]+","+student[1]+","+student[2]);  
            System.out.println("Student[Email Address=" + student[0] + ",Name=" + student[1] + ", Roll No.=" + student[2] + "]");
          }
        }
        catch(IOException e) {
          e.printStackTrace();
        }
      }
}
