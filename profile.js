import { auth, db } from "./firebase-config.js";
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
    console.log("Profile.js loaded");

    const elements = {
        username: document.getElementById("username"),
        email: document.getElementById("user-email"),
        avatar: document.getElementById("profile-avatar"),
        globalRank: document.getElementById("global-rank"),
        globalRankStat: document.getElementById("global-rank-stat"),
        joinDate: document.getElementById("join-date"),
        institute: document.getElementById("institute-name"),
        universityRank: document.getElementById("university-rank"),
        timeSpent: document.getElementById("time-spent"),
        problemsSolved: document.getElementById("total-problems-solved"),
        coins: document.querySelector(".coins p"),
        streak: document.querySelector(".streak p"),
        progressLine: document.querySelector(".progress-line"),
        activityGrid: document.getElementById("activity-grid-map")
    };

    const formatDateKey = (date) => {
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    };

    const calculateStreak = (activityDates) => {
        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let currentDate = new Date(today);

        while (activityDates.has(formatDateKey(currentDate))) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        }
        return streak;
    };

    const renderActivityMap = (activityCounts) => {
        if (!elements.activityGrid) {
            console.warn("Activity grid element not found");
            return;
        }
        elements.activityGrid.innerHTML = "";

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const oneYearAgo = new Date(today);
        oneYearAgo.setDate(today.getDate() - 364);

        for (let i = 0; i <= 364; i++) {
            const date = new Date(oneYearAgo);
            date.setDate(oneYearAgo.getDate() + i);
            const dateKey = formatDateKey(date);
            const count = activityCounts[dateKey] || 0;
            const activityClass = count >= 5 ? "high" : count >= 3 ? "medium" : count >= 1 ? "low" : "";

            const square = document.createElement("div");
            square.className = `activity-square ${activityClass}`;
            square.title = `${date.toLocaleDateString()}: ${count} problem${count !== 1 ? "s" : ""}`;
            elements.activityGrid.appendChild(square);
        }
    };

    const updateUserProfile = async (user) => {
        if (!user) {
            console.warn("No user logged in");
            window.location.href = "index.html";
            return;
        }

        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            let solvedCount = 0, coins = 0;
            const activityDates = new Set();
            const activityCounts = {};

            const progressRef = collection(db, "users", user.uid, "progress");
            const progressSnap = await getDocs(progressRef);
            progressSnap.forEach((doc) => {
                const data = doc.data();
                if (data.status === "Accepted") {
                    solvedCount++;
                    coins += data.difficulty === "Easy" ? 50 : data.difficulty === "Medium" ? 100 : 200;
                    if (data.timestamp?.toDate) {
                        const date = data.timestamp.toDate();
                        const key = formatDateKey(date);
                        activityDates.add(key);
                        activityCounts[key] = (activityCounts[key] || 0) + 1;
                    } else {
                        console.warn(`Missing timestamp in progress doc: ${doc.id}`);
                    }
                }
            });

            renderActivityMap(activityCounts);

            // if (elements.progressLine) {
            //     const moveUpPx = Math.min(coins, 2000);
            //     elements.progressLine.style.top = `calc(100% - ${moveUpPx}px)`;
            // } else {
            //     console.warn("Progress line element not found");
            // }
            
            if (elements.progressLine) {
                const maxCoins = 5000; // Match the y-axis max value
                const graphHeight = 300; // Match the .goal-graph height in CSS
                const moveUpPx = Math.min(coins, maxCoins) * (graphHeight / maxCoins); // Scale coins to graph height
                elements.progressLine.style.top = `calc(100% - ${moveUpPx}px)`;
            } else {
                console.warn("Progress line element not found");
            }

            // Tooltip setup for progress-line
            const tooltip = document.getElementById("progress-tooltip");
            const tooltipCoins = document.getElementById("tooltip-coins");

            if (tooltip && elements.progressLine) {
                tooltipCoins.textContent = coins;

                elements.progressLine.addEventListener("mouseenter", () => {
                    tooltip.style.display = "block";
                });

                elements.progressLine.addEventListener("mouseleave", () => {
                    tooltip.style.display = "none";
                });

                elements.progressLine.addEventListener("mousemove", (e) => {
                    const graphRect = elements.progressLine.parentElement.getBoundingClientRect();
                    tooltip.style.left = `${e.clientX - graphRect.left + 10}px`;
                    tooltip.style.top = `${e.clientY - graphRect.top - 40}px`;
                });
            }

            const streak = calculateStreak(activityDates);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                const creationTime = user.metadata.creationTime ? new Date(user.metadata.creationTime) : null;
                let timeSpentText = "0 hours";
                if (creationTime) {
                    const diffMs = Date.now() - creationTime;
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    timeSpentText = diffDays < 1 ? `${Math.floor(diffMs / (1000 * 60 * 60))} hours` :
                        diffDays < 30 ? `${diffDays} days` :
                        `${Math.floor(diffDays / 30)} months${diffDays % 30 > 0 ? ` ${diffDays % 30} days` : ""}`;
                }

                elements.username.textContent = userData.username || "User";
                elements.email.textContent = user.email || "No email";
                elements.avatar.textContent = userData.username?.charAt(0).toUpperCase() || "U";
                elements.joinDate.textContent = creationTime?.toLocaleDateString() || "Unknown";
                elements.institute.textContent = userData.institute || "Not specified";
                elements.timeSpent.textContent = timeSpentText;
            } else {
                console.warn(`User document not found for UID: ${user.uid}`);
            }

            elements.problemsSolved.textContent = solvedCount;
            elements.coins.textContent = coins;
            elements.streak.textContent = streak;

            const usersCollectionRef = collection(db, "users");
            const usersSnapshot = await getDocs(usersCollectionRef);
            const usersData = [];

            for (const userDoc of usersSnapshot.docs) {
                const userData = userDoc.data();
                let userCoins = 0;
                const progressRef = collection(db, "users", userDoc.id, "progress");
                const progressSnap = await getDocs(progressRef);
                progressSnap.forEach((doc) => {
                    const data = doc.data();
                    if (data.status === "Accepted") {
                        userCoins += data.difficulty === "Easy" ? 50 : data.difficulty === "Medium" ? 100 : 200;
                    }
                });
                usersData.push({ uid: userDoc.id, username: userData.username || "User", institute: userData.institute || "Unknown", coins: userCoins });
            }

            const currentUserData = usersData.find(u => u.uid === user.uid);
            if (currentUserData) currentUserData.coins = coins;

            usersData.sort((a, b) => b.coins - a.coins);
            const globalRank = usersData.findIndex(u => u.uid === user.uid) + 1;
            const sameInstituteUsers = usersData.filter(u => u.institute === currentUserData?.institute);
            sameInstituteUsers.sort((a, b) => b.coins - a.coins);
            const instituteRank = sameInstituteUsers.findIndex(u => u.uid === user.uid) + 1;

            elements.globalRank.textContent = globalRank || "N/A";
            elements.globalRankStat.textContent = globalRank || "N/A";
            elements.universityRank.textContent = instituteRank || "N/A";

            console.log(`Solved: ${solvedCount} | Coins: ${coins} | Streak: ${streak} | Global Rank: ${globalRank} | Institute Rank: ${instituteRank}`);
        } catch (error) {
            console.error("Error updating profile:", error);
            elements.globalRank.textContent = "N/A";
            elements.globalRankStat.textContent = "N/A";
            elements.universityRank.textContent = "N/A";
            if (elements.activityGrid) elements.activityGrid.innerHTML = "<p>Error loading activity map</p>";
        }
    };

    onAuthStateChanged(auth, (user) => {
        console.log("Auth state changed:", user ? user.uid : "No user");
        updateUserProfile(user);
    });
});