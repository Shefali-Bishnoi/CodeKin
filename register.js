import { auth, db } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    sendEmailVerification, 
    signInWithEmailAndPassword,
    deleteUser,
    fetchSignInMethodsForEmail,
    applyActionCode
} from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { doc, setDoc, getDoc, deleteDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";

// Function to explicitly check and update verification status
async function checkAndUpdateVerificationStatus(userId) {
    try {
        // Get the current auth user
        const user = auth.currentUser;
        if (!user) {
            console.log("No user is signed in when checking verification status");
            return;
        }
        
        // Force refresh the token to ensure we have the latest verification status
        await user.getIdToken(true);
        
        // Get the user from Firestore
        const userDoc = await getDoc(doc(db, "users", userId));
        if (!userDoc.exists()) {
            console.error("User document not found in Firestore");
            return;
        }
        
        console.log("Current verification status:", {
            authVerified: user.emailVerified,
            firestoreVerified: userDoc.data().emailVerified
        });
        
        // Update the verification status if it's different
        if (userDoc.data().emailVerified !== user.emailVerified) {
            console.log("Updating verification status to:", user.emailVerified);
            await updateDoc(doc(db, "users", userId), {
                emailVerified: user.emailVerified
            });
            console.log("Verification status updated successfully");
        } else {
            console.log("Verification status already up to date");
        }
    } catch (error) {
        console.error("Error updating verification status:", error);
    }
}

// Check if user came from email verification link
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get('mode');
const oobCode = urlParams.get('oobCode');

// If this is a verification completion, show success message and redirect
if (mode === 'verifyEmail' && oobCode) {
    // Apply the verification code (Firebase needs this to complete verification)
    try {
        await applyActionCode(auth, oobCode);
        console.log("Email verification completed successfully");
        
        // Add a delay to allow Firebase to update internally
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // If user is already signed in, update their verification status
        const currentUser = auth.currentUser;
        if (currentUser) {
            // Force reload the user object to get latest email verification status
            await currentUser.reload();
            // Then update the verification status
            await checkAndUpdateVerificationStatus(currentUser.uid);
        }
        
        // Create a success banner at the top of the page
        const successBanner = document.createElement('div');
        successBanner.style.backgroundColor = '#4CAF50';
        successBanner.style.color = 'white';
        successBanner.style.padding = '15px';
        successBanner.style.textAlign = 'center';
        successBanner.style.position = 'fixed';
        successBanner.style.top = '0';
        successBanner.style.left = '0';
        successBanner.style.width = '100%';
        successBanner.style.zIndex = '1000';
        successBanner.innerHTML = '<strong>Email verified successfully!</strong> Redirecting to login page...';
        
        document.body.prepend(successBanner);
        
        // Redirect to login page after 3 seconds
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 3000);
    } catch (error) {
        console.error("Failed to verify email:", error);
        
        // Show an error message to the user
        const errorBanner = document.createElement('div');
        errorBanner.style.backgroundColor = '#f44336';
        errorBanner.style.color = 'white';
        errorBanner.style.padding = '15px';
        errorBanner.style.textAlign = 'center';
        errorBanner.style.position = 'fixed';
        errorBanner.style.top = '0';
        errorBanner.style.left = '0';
        errorBanner.style.width = '100%';
        errorBanner.style.zIndex = '1000';
        errorBanner.innerHTML = '<strong>Failed to verify email:</strong> ' + error.message + '<br>Please try again or contact support.';
        
        document.body.prepend(errorBanner);
    }
}

document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById("name");
    const emailInput = document.getElementById("email");
    const ageInput = document.getElementById("age");
    const genderInput = document.getElementById("gender");
    const instituteInput = document.getElementById("institute");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const age = ageInput.value.trim();
    const gender = genderInput.value;
    const institute = instituteInput.value.trim();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    document.querySelectorAll(".error").forEach(el => el.remove());
    let hasError = false;

    function showError(inputElement, message) {
        const errorDiv = document.createElement("div");
        errorDiv.classList.add("error");
        errorDiv.style.color = "red";
        errorDiv.style.fontSize = "12px";
        errorDiv.style.marginTop = "5px";
        errorDiv.textContent = message;
        inputElement.parentElement.appendChild(errorDiv);
    }

    function validateEmail(email) {
        return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
    }

    function validateAge(age) {
        // Ensure age is a positive number greater than 0
        return /^\d+$/.test(age) && parseInt(age) > 0;
    }

    function validatePassword(password) {
        // Password must contain at least one uppercase letter, one lowercase letter,
        // one digit, one special character, and be at least 6 characters long
        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasDigit = /[0-9]/.test(password);
        const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
        const hasMinLength = password.length >= 6;

        return hasUppercase && hasLowercase && hasDigit && hasSpecial && hasMinLength;
    }

    if (name === "") { showError(nameInput, "Full Name is required"); hasError = true; }
    if (email === "") { showError(emailInput, "Email is required"); hasError = true; }
    else if (!validateEmail(email)) { showError(emailInput, "Enter a valid email address"); hasError = true; }
    if (age === "") { showError(ageInput, "Age is required"); hasError = true; }
    else if (!validateAge(age)) { showError(ageInput, "Enter a valid age (must be positive)"); hasError = true; }
    if (institute === "") { showError(instituteInput, "Institute is required"); hasError = true; }
    if (username === "") { showError(usernameInput, "Username is required"); hasError = true; }
    if (password === "") { showError(passwordInput, "Password is required"); hasError = true; }
    else if (!validatePassword(password)) { 
        showError(passwordInput, "Password must contain at least one uppercase letter, one lowercase letter, one digit, one special character, and be at least 6 characters long"); 
        hasError = true; 
    }

    if (hasError) return;

    try {
        // NEW APPROACH: First check if email exists in Firestore
        const usersRef = collection(db, "users");
        const emailQuery = query(usersRef, where("email", "==", email));
        const emailSnapshot = await getDocs(emailQuery);
        
        if (!emailSnapshot.empty) {
            // Email exists in Firestore, check verification status
            const userDoc = emailSnapshot.docs[0];
            const userData = userDoc.data();
            
            if (!userData.emailVerified) {
                // Email exists but is not verified
                displayEmailExistsMessage(email);
                return;
            } else {
                // Email exists and is verified
                alert("This email is already registered. Please login or use a different email.");
                return;
            }
        }
        
        // FALLBACK: Check with Firebase Auth directly
        try {
            const methods = await fetchSignInMethodsForEmail(auth, email);
            if (methods && methods.length > 0) {
                // Email exists in Auth
                displayEmailExistsMessage(email);
                return;
            }
        } catch (authError) {
            console.error("Auth check error:", authError);
            // Continue with registration if auth check fails
        }
        
        // Now check username availability
        const usernameDoc = await getDoc(doc(db, "usernames", username));
        if (usernameDoc.exists()) {
            alert("Username is already taken. Please choose another one.");
            return;
        }

        // All checks passed, create the user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await sendEmailVerification(user);

        // Create success message with instructions
        const registerForm = document.getElementById("register-form");
        const successMessage = document.createElement("div");
        successMessage.classList.add("success-message");
        successMessage.style.backgroundColor = "#f0f8ff";
        successMessage.style.border = "1px solid #4682b4";
        successMessage.style.borderRadius = "5px";
        successMessage.style.padding = "15px";
        successMessage.style.marginTop = "20px";
        successMessage.innerHTML = `
            <h3 style="color: #4682b4; margin-top: 0;">Registration Successful!</h3>
            <p>A verification email has been sent to <strong>${email}</strong>.</p>
            <p>Please check your inbox and click the verification link to complete your registration.</p>
            <p>After verification, you'll be redirected to the login page.</p>
            <button id="go-to-login" style="background-color: #4682b4; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; margin-top: 10px;">Go to Login Page</button>
        `;
        
        // Insert success message after the form
        registerForm.parentNode.insertBefore(successMessage, registerForm.nextSibling);
        
        // Hide the registration form
        registerForm.style.display = "none";
        
        // Add event listener for the login button
        document.getElementById("go-to-login").addEventListener("click", () => {
            window.location.href = "login.html";
        });

        await setDoc(doc(db, "users", user.uid), {
            name,
            email,
            age,
            gender,
            institute,
            username,
            emailVerified: false
        });

        await setDoc(doc(db, "usernames", username), { 
            uid: user.uid,
            email: email // Store email to help with cleanup if needed
        });

    } catch (error) {
        console.error("Registration error:", error);
        
        if (error.code === 'auth/email-already-in-use') {
            displayEmailExistsMessage(email);
        } else {
            alert("Registration Failed: " + error.message);
        }
    }
});

// Function to display message for existing email with verification options
function displayEmailExistsMessage(email) {
    const registerForm = document.getElementById("register-form");
    
    // Check if message already exists and remove it
    const existingMessage = document.querySelector(".email-exists-message");
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("email-exists-message");
    messageDiv.style.backgroundColor = "#FFF3CD";
    messageDiv.style.color = "#856404";
    messageDiv.style.border = "1px solid #FFEEBA";
    messageDiv.style.borderRadius = "5px";
    messageDiv.style.padding = "15px";
    messageDiv.style.marginTop = "20px";
    messageDiv.innerHTML = `
        <h3 style="margin-top: 0;">Email Already Registered</h3>
        <p>The email <strong>${email}</strong> is already registered but not verified.</p>
        <p>Please check your inbox for the verification email or use the options below:</p>
        <div style="display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap;">
            <button id="resend-verification-btn" style="flex: 1; background-color: #007BFF; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer; min-width: 180px;">Resend Verification Email</button>
            <button id="go-to-login-btn" style="flex: 1; background-color: #6C757D; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer; min-width: 180px;">Go to Login</button>
        </div>
    `;
    
    // Insert message before the form
    registerForm.parentNode.insertBefore(messageDiv, registerForm);
    
    // Hide the registration form
    registerForm.style.display = "none";
    
    // Add event listeners for buttons
    document.getElementById("resend-verification-btn").addEventListener("click", async () => {
        try {
            // Try to sign in to get the user object - this will fail without password
            // So we use password reset as an alternative verification method
            await auth.sendPasswordResetEmail(email);
            alert("Password reset email sent. You can use this to verify your account and set a new password.");
        } catch (error) {
            alert("Failed to send email: " + error.message);
        }
    });
    
    document.getElementById("go-to-login-btn").addEventListener("click", () => {
        window.location.href = "login.html";
    });
}

// Handle verification status update when user signs in
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // Force reload user before checking status
        await user.reload();
        // Always call our robust function to check and update verification status
        await checkAndUpdateVerificationStatus(user.uid);
        
        // Show/hide verification options based on current status
        if (!user.emailVerified) {
            const resendVerification = document.getElementById("resend-verification");
            const deleteUnverified = document.getElementById("delete-unverified");
            
            if (resendVerification) resendVerification.classList.remove("hidden");
            if (deleteUnverified) deleteUnverified.classList.remove("hidden");
        } else {
            const resendVerification = document.getElementById("resend-verification");
            const deleteUnverified = document.getElementById("delete-unverified");
            
            if (resendVerification) resendVerification.classList.add("hidden");
            if (deleteUnverified) deleteUnverified.classList.add("hidden");
        }
    }
});

// Resend verification email
const resendButton = document.getElementById("resend-verification");
if (resendButton) {
    resendButton.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (user && !user.emailVerified) {
            try {
                await sendEmailVerification(user);
                alert("Verification email sent again!");
                
                // Refresh token and update verification status in case it changed
                setTimeout(async () => {
                    await user.reload();
                    await user.getIdToken(true);
                    await checkAndUpdateVerificationStatus(user.uid);
                }, 2000);
            } catch (error) {
                alert("Failed to send verification email: " + error.message);
            }
        }
    });
}

// Delete unverified account
const deleteButton = document.getElementById("delete-unverified");
if (deleteButton) {
    deleteButton.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (user && !user.emailVerified) {
            try {
                // Get user info before deletion
                const userDoc = await getDoc(doc(db, "users", user.uid));
                const username = userDoc.exists() ? userDoc.data().username : null;
                
                // Delete from usernames collection first
                if (username) {
                    await deleteDoc(doc(db, "usernames", username));
                }
                
                // Delete from users collection
                await deleteDoc(doc(db, "users", user.uid));
                
                // Delete the auth user last
                await deleteUser(user);
                
                alert("Unverified account deleted successfully.");
                location.reload();
            } catch (error) {
                alert("Failed to delete account: " + error.message);
            }
        }
    });
}

// Add listener for login page if it exists
const loginForm = document.getElementById("login-form");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Force reload user and refresh token
            await user.reload();
            await user.getIdToken(true);
            await checkAndUpdateVerificationStatus(user.uid);
            
            // Redirect or show appropriate UI based on verification status
            if (user.emailVerified) {
                window.location.href = "dashboard.html";
            } else {
                // Show verification required message
                const loginContainer = document.querySelector(".login-container") || loginForm.parentElement;
                
                const verifyMessage = document.createElement("div");
                verifyMessage.classList.add("verify-message");
                verifyMessage.style.backgroundColor = "#FFF3CD";
                verifyMessage.style.color = "#856404";
                verifyMessage.style.border = "1px solid #FFEEBA";
                verifyMessage.style.borderRadius = "5px";
                verifyMessage.style.padding = "15px";
                verifyMessage.style.marginTop = "20px";
                verifyMessage.innerHTML = `
                    <h3 style="margin-top: 0;">Email Verification Required</h3>
                    <p>Please verify your email before continuing.</p>
                    <button id="verify-resend-btn" style="background-color: #007BFF; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; margin-top: 10px;">Resend Verification Email</button>
                `;
                
                loginContainer.appendChild(verifyMessage);
                
                document.getElementById("verify-resend-btn").addEventListener("click", async () => {
                    try {
                        await sendEmailVerification(user);
                        alert("Verification email sent!");
                    } catch (error) {
                        alert("Failed to send verification email: " + error.message);
                    }
                });
            }
        } catch (error) {
            console.error("Login error:", error);
            alert("Login failed: " + error.message);
        }
    });
}