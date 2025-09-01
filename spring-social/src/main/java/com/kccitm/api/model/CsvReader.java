package com.kccitm.api.model;

public class CsvReader {
    public String Email;
    public String Name;
    public String Roll_No;

    public CsvReader(String Email,String Name,String Roll_No) { 
       this.Email=Email;
       this.Name=Name;
       this.Roll_No=Roll_No;
    }

    public String getEmail() {
        return Email;
    }
    public String getName() {
        return Name;
    }
    public String getRoll_No() {
        return Roll_No;
    }

    public void setEmail(String email) {
        Email = email;
    }
    public void setName(String name) {
        Name = name;
    }
    public void setRoll_No(String roll_No) {
        Roll_No = roll_No;
    }
    
}
