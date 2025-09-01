package com.kccitm.api.service;

import java.io.IOException;
import java.net.URL;

import com.google.cloud.storage.Blob;
import com.kccitm.api.model.userDefinedModel.FileDataModal;

public interface GoogleCloudAPI {

    public Blob uploadFileToCloud(FileDataModal data) throws IOException;

    public Blob uploadFileToCloudByteArray(FileDataModal data) throws IOException;

    public Blob getFileFromCloud(String data) throws IOException;

    public void deleteFileFromCloud(String data) throws IOException, java.io.IOException;

    public URL getPublicURLOfFile(String Data) throws IOException;

}