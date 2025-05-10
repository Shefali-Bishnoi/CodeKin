// Import required Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCKbTqkog_EhHuDISyR8nqiI7qaSzKXdaE",
    authDomain: "codekinuserloginregister.firebaseapp.com",
    projectId: "codekinuserloginregister",
    storageBucket: "codekinuserloginregister.appspot.com", // Fixed storage bucket URL
    messagingSenderId: "52673131620",
    appId: "1:52673131620:web:5ac55b83b0809801761b71",
    measurementId: "G-LRJR9ETR8V"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app); // Initialize Firebase Authentication
const db = getFirestore(app); // Initialize Firestore Database

// Export Firebase instances for use in other files
export { app, analytics, auth, db };

