console.log('hello');

import { auth } from "./firebase-config.js"; 
import { 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail,
    sendEmailVerification 
} from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const forgotPasswordBtn = document.getElementById("forgot-password");
    const errorMessage = document.getElementById("error-message");
    
    // Attach event listeners
    loginForm.addEventListener("submit", handleLogin);
    forgotPasswordBtn.addEventListener("click", handleForgotPassword);
    
    /**
     * Handles login submission
     */
    async function handleLogin(e) {
        e.preventDefault();
        clearError();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!validateInputs(email, password)) return;
        
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Check if email is verified
            if (!user.emailVerified) {
                showError("Email not verified. Please verify your email before logging in.");
                displayVerificationOptions(user);
                
                // Sign out user since they're not verified
                await auth.signOut();
                return; // Important: Exit the function here to prevent login
            }
            
            // If email is verified, proceed with login
            alert("Login Successful! Redirecting...");
            window.location.href = "homepage.html";
        } catch (error) {
            handleAuthError(error);
        }
    }
    
    /**
     * Display verification options in a better position
     */
    function displayVerificationOptions(user) {
        // Remove existing verification options if present
        const existingOptions = document.getElementById("verification-options");
        if (existingOptions) {
            existingOptions.remove();
        }
        
        // Create verification options container
        const verificationOptions = document.createElement("div");
        verificationOptions.id = "verification-options";
        verificationOptions.className = "mt-3 p-3 bg-yellow-100 rounded";
        
        // Add resend verification button
        const resendBtn = document.createElement("button");
        resendBtn.textContent = "Resend Verification Email";
        resendBtn.className = "w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded text-sm";
        resendBtn.onclick = async () => {
            try {
                await sendEmailVerification(user);
                alert("Verification email sent again. Please check your inbox.");
            } catch (error) {
                alert("Failed to send verification email: " + error.message);
            }
        };
        
        verificationOptions.appendChild(resendBtn);
        
        // Insert right after the error message for better visibility
        errorMessage.parentNode.insertBefore(verificationOptions, errorMessage.nextSibling);
    }
    
    /**
     * Handles password reset
     */
    async function handleForgotPassword() {
        const email = prompt("Enter your email to reset the password:");
        
        if (!email || !validateEmail(email)) {
            alert("Please enter a valid email address.");
            return;
        }
        
        try {
            await sendPasswordResetEmail(auth, email);
            alert("Password reset email sent! Check your inbox.");
        } catch (error) {
            alert("Error: " + error.message);
        }
    }
    
    /**
     * Validates email and password
     */
    function validateInputs(email, password) {
        if (!validateEmail(email)) {
            showError("Invalid email format. Please enter a valid email.");
            return false;
        }
        if (!password) {
            showError("Password cannot be empty.");
            return false;
        }
        return true;
    }
    
    /**
     * Validates email format
     */
    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    
    /**
     * Displays error messages
     */
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = "block"; // Show error message
    }
    
    /**
     * Clears error messages
     */
    function clearError() {
        errorMessage.textContent = "";
        errorMessage.style.display = "none"; // Hide error message
        
        // Also remove verification options if present
        const verificationOptions = document.getElementById("verification-options");
        if (verificationOptions) {
            verificationOptions.remove();
        }
    }
    
    /**
     * Handles authentication errors
     */
    function handleAuthError(error) {
        console.error("Login error:", error.code, error.message);
        
        switch (error.code) {
            case "auth/wrong-password":
            case "auth/invalid-credential":
            case "auth/user-not-found":
                showError("Invalid credentials. Please try again.");
                break;
            case "auth/user-disabled":
                showError("This account has been disabled. Contact support.");
                break;
            default:
                showError("Login failed. Please try again.");
                break;
        }
    }
});