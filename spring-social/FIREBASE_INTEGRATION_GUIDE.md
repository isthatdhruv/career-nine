# Firebase Integration Guide for Spring Boot Application

## Overview

Your Spring Boot application is now integrated with Firebase, providing access to:
- Firebase Authentication
- Cloud Firestore (NoSQL database)
- Firebase Admin SDK

## Setup Instructions

### 1. Firebase Console Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your existing project `career-library` or create a new one
3. Navigate to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file

### 2. Service Account Configuration

1. Replace the content of `src/main/resources/firebase-service-account.json` with your downloaded JSON file
2. Make sure the file contains your actual Firebase service account credentials

### 3. Application Configuration

The Firebase configuration is already set up in `application.yml`:

```yaml
firebase:
  project-id: career-library
  service-account-file: firebase-service-account.json
```

## Usage

### Firebase Service Methods

The `FirebaseService` class provides the following methods:

#### Document Operations
```java
// Add a document
WriteResult result = firebaseService.addDocument("users", "userId123", userData);

// Get a document
DocumentSnapshot doc = firebaseService.getDocument("users", "userId123");

// Get all documents from collection
List<QueryDocumentSnapshot> docs = firebaseService.getAllDocuments("users");

// Update a document
WriteResult result = firebaseService.updateDocument("users", "userId123", updatedData);

// Delete a document
WriteResult result = firebaseService.deleteDocument("users", "userId123");
```

#### Query Operations
```java
// Query documents with where clause
List<QueryDocumentSnapshot> docs = firebaseService.queryDocuments(
    "users", 
    "status", 
    "==", 
    "active"
);
```

#### Authentication
```java
// Verify Firebase ID Token
FirebaseToken token = firebaseService.verifyIdToken(idToken);
String userId = token.getUid();
```

### REST API Endpoints

The `FirebaseController` provides these REST endpoints:

#### Document Management
- **POST** `/api/firebase/collections/{collection}` - Add document
- **GET** `/api/firebase/collections/{collection}/documents/{documentId}` - Get document
- **GET** `/api/firebase/collections/{collection}` - Get all documents
- **PUT** `/api/firebase/collections/{collection}/documents/{documentId}` - Update document
- **DELETE** `/api/firebase/collections/{collection}/documents/{documentId}` - Delete document

#### Querying
- **GET** `/api/firebase/collections/{collection}/query?field=fieldName&operator==&value=fieldValue` - Query documents

#### Authentication
- **POST** `/api/firebase/auth/verify` - Verify Firebase ID token

### Example API Calls

#### Add a new user document
```bash
curl -X POST https://localhost:8443/api/firebase/collections/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "status": "active"
  }'
```

#### Get a user document
```bash
curl -X GET https://localhost:8443/api/firebase/collections/users/documents/userId123
```

#### Query active users
```bash
curl -X GET "https://localhost:8443/api/firebase/collections/users/query?field=status&operator===&value=active"
```

#### Verify Firebase token
```bash
curl -X POST https://localhost:8443/api/firebase/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "YOUR_FIREBASE_ID_TOKEN_HERE"
  }'
```

## Frontend Integration

Your frontend can now authenticate users with Firebase and send the ID token to your Spring Boot backend for verification:

```javascript
// In your frontend (React/JavaScript)
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";

const auth = getAuth();
const provider = new GoogleAuthProvider();

// Sign in with Google
signInWithPopup(auth, provider)
  .then(async (result) => {
    const user = result.user;
    const idToken = await user.getIdToken();
    
    // Send token to your Spring Boot backend
    const response = await fetch('/api/firebase/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken }),
    });
    
    const userData = await response.json();
    console.log('User verified:', userData);
  })
  .catch((error) => {
    console.error('Error:', error);
  });
```

## Security Considerations

1. **Service Account Key**: Keep your service account key secure and never commit it to version control
2. **CORS**: Update your CORS configuration to include your frontend domain
3. **Token Validation**: Always verify Firebase ID tokens on the backend before trusting user claims
4. **Firestore Rules**: Set up proper security rules in Firebase Console

## Firestore Security Rules Example

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own documents
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Public read access to certain collections
    match /public/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## Testing

1. Start your Spring Boot application:
   ```bash
   ./mvnw spring-boot:run
   ```

2. Test the Firebase connection by calling the API endpoints or check the application logs for "Firebase has been initialized successfully!"

## Troubleshooting

1. **Authentication Error**: Verify your service account JSON file is correct
2. **Project ID Mismatch**: Ensure the project ID in your configuration matches your Firebase project
3. **Permission Denied**: Check your Firestore security rules
4. **Network Issues**: Ensure your application can reach Firebase servers

## Next Steps

1. Replace the sample service account key with your actual Firebase credentials
2. Set up proper Firestore security rules
3. Implement user authentication flow in your frontend
4. Create specific collections and documents as per your application requirements
