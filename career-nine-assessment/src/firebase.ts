import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBrWCawt_UCXaf3VYoVkuvT4g4161rObRk",
  authDomain: "career-9-assessment.firebaseapp.com",
  projectId: "career-9-assessment",
  storageBucket: "career-9-assessment.firebasestorage.app",
  messagingSenderId: "127678007629",
  appId: "1:127678007629:web:1ea85f1153b49e7e16cf04"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
