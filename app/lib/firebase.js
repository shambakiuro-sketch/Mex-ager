import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBV9HZO_PyiD3mWtwgpgUDOxryoVRzJtUE",
  authDomain: "jackson-messaging-app.firebaseapp.com",
  projectId: "jackson-messaging-app",
  storageBucket: "jackson-messaging-app.firebasestorage.app",
  messagingSenderId: "39972249513",
  appId: "1:39972249513:web:babbc9f3ca42c3dee1eeb8",
  databaseURL: "https://jackson-messaging-app-default-rtdb.europe-west1.firebasedatabase.app"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Realtime Database
export const database = getDatabase(app);

// Initialize Cloud Storage
export const storage = getStorage(app);

export default app;
