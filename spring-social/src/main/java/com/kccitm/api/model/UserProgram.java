package com.kccitm.api.model;

public class UserProgram {
  private int id;

  private int codingLanguage;

  private byte[] programBlob;
  private String saveType;

  private int urlId;

  public int getId() {
    return id;
  }

  public int getCodingLanguage() {
    return codingLanguage;
  }

  public byte[] getProgramBlob() {
    return programBlob;
  }

  public void setCodingLanguage(int codingLanguage) {
    this.codingLanguage = codingLanguage;
  }

  public int getUrlId() {
    return urlId;
  }

  public void setId(int id) {
    this.id = id;
  }

  public void setProgramBlob(byte[] programBlob) {
    this.programBlob = programBlob;
  }

  public void setUrlId(int urlId) {
    this.urlId = urlId;
  }

  public String getSaveType() {
    return saveType;
  }

  public void setSaveType(String saveType) {
    this.saveType = saveType;
  }
}
