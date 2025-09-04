package com.kccitm.api.service;

import java.io.IOException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.util.SerializationUtils;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.storage.Blob;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Bucket;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import com.google.common.collect.Lists;
import com.kccitm.api.model.FileMetadata;
import com.kccitm.api.model.userDefinedModel.FileDataModal;
import com.kccitm.api.repository.FileMetadataRepository;

@Service
public class GoogleCloudAPIImpl implements GoogleCloudAPI {
        @Value("${app.googleAPIJSON}")
        private Resource templateLocation;

        @Autowired
        FileMetadataRepository fileMetadataRepository;

        @Override
        public Blob uploadFileToCloud(FileDataModal data) throws IOException {

                GoogleCredentials credentials;

                credentials = GoogleCredentials.fromStream(templateLocation.getInputStream())
                                .createScoped(Lists.newArrayList("https://www.googleapis.com/auth/cloud-platform"));

                Storage storage = (Storage) StorageOptions.newBuilder().setCredentials(credentials).build()
                                .getService();
                byte[] decodedData = Base64.getDecoder()
                                .decode(data.getData().toString().getBytes(StandardCharsets.UTF_8));
                FileMetadata fmd = fileMetadataRepository.save(new FileMetadata(data.getFileName(), data.getType()));

                Bucket bucket = storage.get("kcc-studnet-files");

                Blob blob = bucket.create(fmd.getId() + "." + fmd.getExtenstion(), decodedData, data.getType());
                System.out.println(blob);
                // Blob blob = bucket.create(blobName, "Hello, World!".getBytes(UTF_8),
                // "text/plain");
                return blob;

        }

        @Override
        public Blob uploadFileToCloudByteArray(FileDataModal data) throws IOException {

                GoogleCredentials credentials;

                credentials = GoogleCredentials.fromStream(templateLocation.getInputStream())
                                .createScoped(Lists.newArrayList("https://www.googleapis.com/auth/cloud-platform"));

                Storage storage = (Storage) StorageOptions.newBuilder().setCredentials(credentials).build()
                                .getService();
                FileMetadata fmd = fileMetadataRepository.save(new FileMetadata(data.getFileName(), data.getType()));

                Bucket bucket = storage.get("kcc-studnet-files");
                byte[] decodedData = SerializationUtils.serialize(data.getData());
                Blob blob = bucket.create(data.getFileName() + "." + fmd.getExtenstion(), decodedData, data.getType());
                // System.out.println(blob);
                // Blob blob = bucket.create(blobName, "Hello, World!".getBytes(UTF_8),
                // "text/plain");
                return blob;

        }

        @Override
        public Blob getFileFromCloud(String data) throws IOException {

                GoogleCredentials credentials;

                credentials = GoogleCredentials.fromStream(templateLocation.getInputStream())
                                .createScoped(Lists.newArrayList("https://www.googleapis.com/auth/cloud-platform"));

                Storage storage = (Storage) StorageOptions.newBuilder().setCredentials(credentials).build()
                                .getService();

                Bucket bucket = storage.get("kcc-studnet-files");

                // Blob blob = bucket.create(fmd.getId()+"."+fmd.getExtenstion(), decodedData,
                // data.getType());
                Blob blob = bucket.get(data);

                // Blob blob = bucket.create(blobName, "Hello, World!".getBytes(UTF_8),
                // "text/plain");
                // return r;

                return blob;

        }

        @Override
        public void deleteFileFromCloud(String data) throws IOException {
                GoogleCredentials credentials;
                credentials = GoogleCredentials.fromStream(templateLocation.getInputStream())
                                .createScoped(Lists.newArrayList("https://www.googleapis.com/auth/cloud-platform"));

                Storage storage = (Storage) StorageOptions.newBuilder().setCredentials(credentials).build()
                                .getService();

                // Bucket bucket = storage.get("kcc-studnet-files");
                storage.delete("kcc-studnet-files", data);

        }

        @Override
        public URL getPublicURLOfFile(String Data) throws IOException {
                GoogleCredentials credentials;
                credentials = GoogleCredentials.fromStream(templateLocation.getInputStream())
                                .createScoped(Lists.newArrayList("https://www.googleapis.com/auth/cloud-platform"));

                Storage storage = (Storage) StorageOptions.newBuilder().setCredentials(credentials).build()
                                .getService();
                String bucketName = "kcc-studnet-files"; // Replace with your own bucket name
                String objectName = Data; // Replace with your own object name
                BlobId blobId = BlobId.of(bucketName, objectName);
                BlobInfo blobInfo = BlobInfo.newBuilder(blobId).build();
                return storage.signUrl(blobInfo, 15, TimeUnit.MINUTES,
                                Storage.SignUrlOption.withV4Signature());

        }

}