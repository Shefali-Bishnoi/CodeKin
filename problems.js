import { db, auth } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";

let allProblems = [];
const problemsPerPage = 20;
let currentPage = 1;
let userId = null;
let statusCache = new Map();

// Map statuses to emojis
const statusMap = {
    Solved: "✅",
    Attempted: "🔄",
    "To-Do": "⏳"
};

// Reverse map for filtering
const emojiToStatus = {
    "✅": "Solved",
    "🔄": "Attempted",
    "⏳": "To-Do"
};

async function fetchProblemStatuses(problems) {
    if (!userId) {
        console.log("fetchProblemStatuses: No userId, defaulting to To-Do");
        return problems.map(problem => ({ ...problem, status: "To-Do" }));
    }

    try {
        const progressRef = collection(db, "users", userId, "progress");
        const progressSnapshot = await getDocs(progressRef);
        statusCache.clear();

        progressSnapshot.forEach(doc => {
            const data = doc.data();
            const status = data.status === "Accepted" ? "Solved" : data.status === "Attempted" ? "Attempted" : "To-Do";
            statusCache.set(doc.id, status);
        });

        console.log(`fetchProblemStatuses: Fetched ${progressSnapshot.size} progress records`);

        return problems.map(problem => ({
            ...problem,
            status: statusCache.get(problem.id.toString()) || "To-Do"
        }));
    } catch (error) {
        console.error("fetchProblemStatuses: Failed:", error.message);
        return problems.map(problem => ({ ...problem, status: "To-Do" }));
    }
}

async function renderProblems(page) {
    try {
        const list = document.getElementById("problems");
        while (list.children.length > 2) {
            list.removeChild(list.lastChild);
        }

        let problemsToRender = allProblems;
        if (userId) {
            problemsToRender = await fetchProblemStatuses(allProblems);
        } else {
            problemsToRender = allProblems.map(p => ({ ...p, status: "To-Do" }));
        }

        if (problemsToRender.length === 0) {
            list.innerHTML += '<div class="problem">No problems available</div>';
            return;
        }

        const start = (page - 1) * problemsPerPage;
        const end = Math.min(start + problemsPerPage, problemsToRender.length);

        for (let i = start; i < end; i++) {
            const problem = problemsToRender[i];
            const div = document.createElement("div");
            div.classList.add("problem", `p${problem.id}`);

            const span1 = document.createElement("span");
            const emoji = statusMap[problem.status] || "❌";
            span1.innerHTML = `<span class="problem-status ${problem.status.toLowerCase().replace(' ', '-')}" data-status="${problem.status}">${emoji}</span>`;
            div.appendChild(span1);

            const span2 = document.createElement("span");
            span2.innerHTML = `<a href="p2.html?id=${problem.id}">${problem.title}</a>`;
            div.appendChild(span2);

            const span3 = document.createElement("span");
            span3.textContent = problem.difficulty || "N/A";
            div.appendChild(span3);

            const span4 = document.createElement("span");
            const topics = problem.related_topics ? problem.related_topics.split(",") : [];
            const limitedTopics = topics.slice(0, Math.min(2, topics.length));
            span4.textContent = limitedTopics.join(", ") || "N/A";
            div.appendChild(span4);

            const span5 = document.createElement("span");
            const companies = problem.companies ? problem.companies.split(",") : [];
            const limitedCompanies = companies.slice(0, Math.min(2, companies.length));
            span5.textContent = limitedCompanies.join(", ") || "N/A";
            div.appendChild(span5);

            list.appendChild(div);
        }

        applyJSEffects();
    } catch (error) {
        console.error("renderProblems: Failed:", error.message);
        const list = document.getElementById("problems");
        list.innerHTML += '<div class="problem">Error rendering problems</div>';
    }
}

function applyJSEffects() {
    const problems = document.getElementsByClassName("problem");
    updateRowColors();

    for (let i = 0; i < problems.length; i++) {
        const spans = problems[i].getElementsByTagName("span");
        if (spans.length >= 3) {
            if (spans[2].innerText === "Easy") spans[2].style.color = "#389754";
            else if (spans[2].innerText === "Medium") spans[2].style.color = "yellow";
            else if (spans[2].innerText === "Hard") spans[2].style.color = "red";
        }
    }
}

function updateRowColors() {
    const problems = document.getElementsByClassName("problem");
    let ct = 0;
    for (let i = 0; i < problems.length; i++) {
        if (problems[i].style.display === "none") continue;
        problems[i].style.backgroundColor = ct % 2 === 0 ? "#1a0b2e" : "#ba51e0";
        ct++;
    }
}

function filterProblems() {
    const problems = document.querySelectorAll(".problem:not(.p0)");
    const selectedTag = document.getElementById("Tag").value;
    const selectedDifficulty = document.getElementById("Difficulty").value;
    const selectedStatus = document.getElementById("Status").value;
    const searchQuery = document.getElementById("text").value.toLowerCase().trim();

    problems.forEach(problem => {
        const title = problem.children[1].innerText.toLowerCase();
        const difficulty = problem.children[2].innerText;
        const category = problem.children[3].innerText;
        const statusEmoji = problem.children[0].querySelector(".problem-status").innerText;
        const status = emojiToStatus[statusEmoji] || "To-Do";

        const tagMatch = selectedTag === "Choose" || category.includes(selectedTag);
        const difficultyMatch = selectedDifficulty === "Choose" || difficulty === selectedDifficulty;
        const statusMatch = selectedStatus === "Choose" || status === selectedStatus;
        const searchMatch = searchQuery === "" || title.includes(searchQuery);

        problem.style.display = (tagMatch && difficultyMatch && statusMatch && searchMatch) ? "" : "none";
    });

    updateRowColors();
}

function updatePaginationControls() {
    const totalPages = Math.ceil(allProblems.length / problemsPerPage);
    const pageInfo = document.getElementById("page-info");
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");

    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}

async function loadProblems() {
    try {
        const response = await fetch("problems.json");
        if (!response.ok) {
            throw new Error(`Failed to fetch problems.json: ${response.status}`);
        }
        allProblems = await response.json();
        console.log("loadProblems: Fetched", allProblems.length, "problems");
        await renderProblems(currentPage);
        updatePaginationControls();
    } catch (error) {
        console.error("loadProblems: Failed:", error.message);
        document.getElementById("problems").innerHTML = '<div class="problem">Error loading problems</div>';
    }
}

// Event listeners
document.getElementById("prev-btn").addEventListener("click", () => {
    if (currentPage > 1) {
        currentPage--;
        renderProblems(currentPage);
        updatePaginationControls();
    }
});

document.getElementById("next-btn").addEventListener("click", () => {
    const totalPages = Math.ceil(allProblems.length / problemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderProblems(currentPage);
        updatePaginationControls();
    }
});

document.getElementById("Tag").addEventListener("change", filterProblems);
document.getElementById("Difficulty").addEventListener("change", filterProblems);
document.getElementById("Status").addEventListener("change", filterProblems);
document.getElementById("text").addEventListener("input", filterProblems);

// MutationObserver for dynamic updates
const observer = new MutationObserver(() => {
    console.log("Problems updated, reapplying JS effects...");
    applyJSEffects();
});

const list = document.getElementById("problems");
if (list) {
    observer.observe(list, { childList: true, subtree: true });
}

// Auth state handling
auth.onAuthStateChanged(user => {
    userId = user ? user.uid : null;
    console.log("auth.onAuthStateChanged: userId:", userId);
    loadProblems();
});

// Initial load
document.addEventListener("DOMContentLoaded", () => {
    loadProblems();
});