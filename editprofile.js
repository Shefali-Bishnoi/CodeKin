import { auth, db } from "./firebase-config.js";
import { updatePassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            alert("No user logged in.");
            window.location.href = "index.html";
            return;
        }

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            document.getElementById("edit-username").value = userData.username || "";
            document.getElementById("edit-institute").value = userData.institute || "";
            document.getElementById("edit-fullname").value = userData.name || "";
            document.getElementById("edit-age").value = userData.age || "";
            // document.getElementById("edit-gender").value = userData.gender || "";
            const genderValue = userData.gender ? userData.gender.charAt(0).toUpperCase() + userData.gender.slice(1).toLowerCase() : "";
            document.getElementById("edit-gender").value = genderValue;

        }
    });
});

window.enableEdit = (fieldId) => {
    document.getElementById(fieldId).disabled = false;
};

document.getElementById("edit-profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const user = auth.currentUser;
    if (!user) {
        alert("No user logged in.");
        return;
    }

    const userRef = doc(db, "users", user.uid);
    const newUsername = document.getElementById("edit-username").value.trim();
    const newInstitute = document.getElementById("edit-institute").value.trim();
    const newFullname = document.getElementById("edit-fullname").value.trim();
    const newAge = document.getElementById("edit-age").value.trim();
    const newGender = document.getElementById("edit-gender").value;
    const newPassword = document.getElementById("edit-password").value.trim();
    const confirmPassword = document.getElementById("confirm-password").value.trim();

    try {
        // Validate password inputs
        if (newPassword || confirmPassword) {
            if (newPassword.length < 6 || confirmPassword !== newPassword) {
                alert("Passwords do not match or are too short (minimum 6 characters).");
                return;
            }
        }

        // Update Firestore user data
        let updates = {};
        if (newUsername) updates.username = newUsername;
        if (newInstitute) updates.institute = newInstitute;
        if (newFullname) updates.name = newFullname;
        if (newAge) updates.age = newAge;
        if (newGender) updates.gender = newGender;

        if (Object.keys(updates).length > 0) {
            await updateDoc(userRef, updates);
        }

        // Update password if provided
        if (newPassword.length >= 6 && confirmPassword === newPassword) {
            await updatePassword(user, newPassword);
            alert("Password updated successfully.");
        }

        alert("Profile updated successfully!");
        window.location.href = "Profile.html";

    } catch (error) {
        alert("Error updating profile: " + error.message);
        console.error(error);
    }
});
