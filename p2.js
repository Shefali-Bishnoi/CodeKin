import { auth, db } from "./firebase-config.js";
import { doc, setDoc, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";

let testCases = [];
let activeTestCaseId = 0;
let userId = null;
let problemId = null;
let problemDifficulty = null;

// Map statuses to emojis, same as problems.js
const statusMap = {
    Solved: "✅",
    Attempted: "🔄",
    "To-Do": "⏳"
};

var cppEditor = CodeMirror.fromTextArea(document.getElementById("cppEditor"), {
    mode: "text/x-c++src",
    theme: "dracula",
    lineNumbers: true,
    autoCloseBrackets: true,
    matchBrackets: true
});

cppEditor.setValue(`#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, CodeMirror C++!" << endl;\n    return 0;\n}`);

function parseTestCases(description) {
    const testCases = [];
    const exampleRegex = /Example \d+:\nInput: ([^\n]+)\nOutput: ([^\n]+)/g;
    let match;

    while ((match = exampleRegex.exec(description)) !== null) {
        const inputStr = match[1];
        const outputStr = match[2];

        const inputs = inputStr.split(", ").reduce((acc, curr) => {
            const [key, value] = curr.split(" = ");
            acc[key.trim()] = value.trim();
            return acc;
        }, {});

        testCases.push({
            id: testCases.length + 1,
            ...inputs,
            outputText: outputStr,
        });
    }
    return testCases;
}

function renderInputBoxes(inputs) {
    const inputContainer = document.getElementById("input-container");
    inputContainer.innerHTML = "";

    Object.keys(inputs).forEach((key) => {
        if (key !== "id" && key !== "outputText") {
            const label = document.createElement("p");
            label.className = "test-label";
            label.textContent = `${key} =`;

            const box = document.createElement("div");
            box.className = "test-box";
            box.id = `input-box-${key}`;
            box.textContent = inputs[key];

            inputContainer.appendChild(label);
            inputContainer.appendChild(box);
        }
    });
}

function renderTestCases() {
    const casesContainer = document.getElementById("cases-container");
    casesContainer.innerHTML = "";

    testCases.forEach((testCase, index) => {
        let button = document.createElement("div");
        button.className = `case-btn ${index === activeTestCaseId ? "active" : ""}`;
        button.textContent = `Case ${index + 1}`;
        button.onclick = () => selectTestCase(index);
        casesContainer.appendChild(button);
    });

    updateTestCaseView();
}

function selectTestCase(index) {
    activeTestCaseId = index;
    renderTestCases();
}

async function updateTestCaseView() {
    const activeTestCase = testCases[activeTestCaseId];
    renderInputBoxes(activeTestCase);
    document.getElementById("expected-output-box").textContent = activeTestCase.outputText || "No expected output";

    if (userId && problemId) {
        try {
            const resultDocRef = doc(db, "users", userId, "problems", problemId, "testCases", `case_${activeTestCaseId + 1}`);
            const resultDoc = await getDoc(resultDocRef);
            if (resultDoc.exists()) {
                const data = resultDoc.data();
                document.getElementById("result-box").textContent = data.output || "";
                document.getElementById("verdict-box").textContent = data.verdict || "";
            } else {
                document.getElementById("result-box").textContent = "";
                document.getElementById("verdict-box").textContent = "";
            }
        } catch (error) {
            console.error("updateTestCaseView: Error:", error.message);
        }
    }
    await showProblemStatus();
}

async function saveCodeToFirestore(code) {
    if (!userId || !problemId) {
        console.log("saveCodeToFirestore: Skipping - userId:", userId, "problemId:", problemId);
        return false;
    }

    try {
        const path = `users/${userId}/problems/${problemId}`;
        const docRef = doc(db, "users", userId, "problems", problemId);
        await setDoc(docRef, { code, updatedAt: serverTimestamp() }, { merge: true });
        console.log("saveCodeToFirestore: Saved - path:", path);
        return true;
    } catch (error) {
        console.error("saveCodeToFirestore: Failed - path:", path, "error:", error.message);
        return false;
    }
}

async function loadCodeFromFirestore() {
    if (!userId || !problemId) {
        console.log("loadCodeFromFirestore: Skipping - userId:", userId, "problemId:", problemId);
        return;
    }

    try {
        const path = `users/${userId}/problems/${problemId}`;
        const docRef = doc(db, "users", userId, "problems", problemId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().code) {
            cppEditor.setValue(docSnap.data().code);
            console.log("loadCodeFromFirestore: Loaded - path:", path);
        }
    } catch (error) {
        console.error("loadCodeFromFirestore: Failed - path:", path, "error:", error.message);
    }
}

async function runCppCode() {
    console.log("runCppCode: Starting...");
    if (!auth.currentUser || !userId) {
        document.getElementById("result-box").textContent = "Sign in to save your solution.";
        document.getElementById("verdict-box").textContent = "Sign-in required";
        console.error("runCppCode: No user - userId:", userId, "auth.currentUser:", auth.currentUser);
        return;
    }
    if (!problemId) {
        document.getElementById("result-box").textContent = "No problem selected.";
        console.error("runCppCode: No problemId");
        return;
    }
    if (auth.currentUser.uid !== userId) {
        console.error("runCppCode: UID mismatch - userId:", userId, "auth.uid:", auth.currentUser.uid);
        return;
    }

    let code = cppEditor.getValue();
    const activeTestCase = testCases[activeTestCaseId];
    console.log("runCppCode: Code:", code.slice(0, 50) + "...", "Test case:", activeTestCase, "uid:", auth.currentUser.uid);

    await saveCodeToFirestore(code);

    let inputTexts = Object.keys(activeTestCase)
        .filter(key => key !== "id" && key !== "outputText")
        .map(key => activeTestCase[key]);

    let input = inputTexts
        .map(text => text.replace(/\[|\]/g, "").replace(/,\s*/g, "\n"))
        .join("\n");
    console.log("runCppCode: API input:", input);

    try {
        // console.log("runCppCode: Fetching http://localhost:5000/run");
        // let response = await fetch("http://localhost:5000/run", {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json" },
        //     body: JSON.stringify({ code, input }),
        // });
        
        console.log("runCppCode: Fetching from Render backend");
        let response = await fetch("https://codekin-l4a6.onrender.com/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, input }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        let result = await response.json();
        const output = result.output?.trim() || "No output";
        document.getElementById("result-box").textContent = output;
        console.log("runCppCode: API output:", output);

        const verdict = checkVerdict(output);
        const savedTestCase = await saveTestCaseResult(output, verdict);
        const savedStatus = await saveProblemStatus(verdict);

        const points = problemDifficulty === "Easy" ? 50 : problemDifficulty === "Medium" ? 100 : problemDifficulty === "Hard" ? 200 : 0;
        if (verdict === "Accepted" && points > 0) {
            alert(`You earned ${points} points!`);
        }

        if (savedTestCase && savedStatus) {
            document.getElementById("verdict-box").textContent = `${verdict} (Saved for problem list)`;
        } else {
            document.getElementById("verdict-box").textContent = `${verdict} (Save failed - check permissions)`;
            alert("Failed to save status to Firebase. See console for details.");
        }
    } catch (error) {
        const errorMessage = "Run failed: " + error.message;
        document.getElementById("result-box").textContent = errorMessage;
        document.getElementById("verdict-box").textContent = "Error (Save failed)";
        console.error("runCppCode: Failed - error:", error.message);
        await saveTestCaseResult(errorMessage, "Error");
        await saveProblemStatus("Error");
    }
    await showProblemStatus();
}

function checkVerdict(userOutput) {
    const expectedOutput = testCases[activeTestCaseId].outputText.trim();
    const normalizedUserOutput = userOutput.trim().replace(/\s+/g, " ");
    const normalizedExpected = expectedOutput.trim().replace(/\s+/g, " ");
    const verdict = normalizedUserOutput === normalizedExpected ? "Accepted" : "Wrong Answer";
    console.log("checkVerdict: User:", normalizedUserOutput, "Expected:", normalizedExpected, "Verdict:", verdict);
    return verdict;
}

async function saveTestCaseResult(output, verdict) {
    if (!userId || !problemId || !auth.currentUser || auth.currentUser.uid !== userId) {
        console.error("saveTestCaseResult: Cannot save - userId:", userId, "problemId:", problemId, "auth:", auth.currentUser);
        return false;
    }

    try {
        const path = `users/${userId}/problems/${problemId}/testCases/case_${activeTestCaseId + 1}`;
        const resultDocRef = doc(db, "users", userId, "problems", problemId, "testCases", `case_${activeTestCaseId + 1}`);
        await setDoc(resultDocRef, {
            output,
            verdict,
            testCaseId: `case_${activeTestCaseId + 1}`,
            updatedAt: serverTimestamp()
        }, { merge: true });
        console.log("saveTestCaseResult: Saved - path:", path, "verdict:", verdict);
        return true;
    } catch (error) {
        console.error("saveTestCaseResult: Failed - path:", path, "error:", error.message);
        return false;
    }
}

async function saveProblemStatus(verdict) {
    if (!userId || !problemId || !auth.currentUser || auth.currentUser.uid !== userId) {
        console.error("saveProblemStatus: Cannot save - userId:", userId, "problemId:", problemId, "auth:", auth.currentUser);
        return false;
    }

    try {
        const status = verdict === "Accepted" ? "Accepted" : "Attempted";
        const data = {
            problemId,
            status,
            verdict,
            difficulty: problemDifficulty,
            timestamp: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        console.log("saveProblemStatus: Attempting save - uid:", auth.currentUser.uid, "data:", data);

        const progressPath = `users/${userId}/progress/${problemId}`;
        const progressDocRef = doc(db, "users", userId, "progress", problemId);
        await setDoc(progressDocRef, data, { merge: true });
        console.log("saveProblemStatus: Saved - path:", progressPath, "status:", status, "verdict:", verdict, "difficulty:", problemDifficulty);

        const submissionsPath = `users/${userId}/submissions/${problemId}`;
        const submissionsDocRef = doc(db, "users", userId, "submissions", problemId);
        await setDoc(submissionsDocRef, data, { merge: true });
        console.log("saveProblemStatus: Saved - path:", submissionsPath, "status:", status, "verdict:", verdict, "difficulty:", problemDifficulty);

        return true;
    } catch (error) {
        console.error("saveProblemStatus: Failed - progress path:", progressPath, ", submissions path:", submissionsPath, ", error:", error.message);
        return false;
    }
}

async function showProblemStatus() {
    const statusBox = document.getElementById("status-box") || createStatusBox();
    if (!userId || !problemId || !auth.currentUser) {
        statusBox.textContent = "Status: Sign in to view";
        console.log("showProblemStatus: No userId, problemId, or auth - userId:", userId, "auth:", auth.currentUser);
        return;
    }

    try {
        const path = `users/${userId}/progress/${problemId}`;
        const statusDocRef = doc(db, "users", userId, "progress", problemId);
        console.log("showProblemStatus: Fetching - path:", path);

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("getDoc timeout")), 5000);
        });
        const statusDoc = await Promise.race([getDoc(statusDocRef), timeoutPromise]);

        console.log("showProblemStatus: Doc exists:", statusDoc.exists(), "Data:", statusDoc.data());
        if (statusDoc.exists()) {
            const data = statusDoc.data();
            // Map status to match problems.js
            const displayStatus = data.status === "Accepted" ? "Solved" : data.status === "Attempted" ? "Attempted" : "To-Do";
            const emoji = statusMap[displayStatus] || "❌";
            statusBox.textContent = `Status: ${displayStatus} ${emoji}`;
            console.log("showProblemStatus: Loaded - path:", path, "displayStatus:", displayStatus, "emoji:", emoji);
        } else {
            statusBox.textContent = `Status: To-Do ${statusMap["To-Do"]}`;
            console.log("showProblemStatus: No status - path:", path);
        }
    } catch (error) {
        console.error("showProblemStatus: Failed - path:", path, "error:", error.message, "code:", error.code);
        statusBox.textContent = `Status: Error loading - ${error.message}`;
    }
}

function createStatusBox() {
    const container = document.createElement("div");
    container.style.margin = "10px";
    container.style.padding = "10px";
    container.style.border = "1px solid #ccc";

    const statusBox = document.createElement("div");
    statusBox.id = "status-box";
    statusBox.textContent = "Status: Loading...";
    container.appendChild(statusBox);

    const checkButton = document.createElement("button");
    checkButton.textContent = "Check Status";
    checkButton.style.marginTop = "5px";
    // Debounce to prevent multiple rapid clicks
    let isChecking = false;
    checkButton.onclick = async () => {
        if (isChecking) return;
        isChecking = true;
        statusBox.textContent = "Status: Refreshing...";
        await showProblemStatus();
        isChecking = false;
    };
    container.appendChild(checkButton);

    document.getElementById("split-0").appendChild(container);
    return statusBox;
}

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

fetch("problems.json")
    .then((response) => response.json())
    .then((problems) => {
        problemId = getQueryParam("id");
        if (!problemId) {
            document.body.innerHTML = "<h1>No Problem ID</h1>";
            console.error("fetch problems: No problemId");
            return;
        }

        const problem = problems.find((p) => p.id === problemId);
        if (!problem) {
            document.body.innerHTML = "<h1>Problem Not Found</h1>";
            console.error("fetch problems: No problem for id:", problemId);
            return;
        }

        problemDifficulty = problem.difficulty;
        document.getElementById("IDandTitle").innerText = problem.title;
        document.getElementById("statement").innerText = problem.description;

        const coinPoints = problemDifficulty === "Easy" ? 50 : problemDifficulty === "Medium" ? 100 : problemDifficulty === "Hard" ? 200 : 0;
        document.getElementById("coin-points").innerText = `Coins: ${coinPoints}`;

        testCases = parseTestCases(problem.description);
        if (testCases.length === 0) {
            console.error("fetch problems: No test cases for problem:", problemId);
            return;
        }

        console.log("fetch problems: Loaded problem:", problemId, "difficulty:", problemDifficulty);
        renderTestCases();
        if (userId) {
            loadCodeFromFirestore();
        }
    })
    .catch((error) => {
        console.error("fetch problems: Failed:", error.message);
        document.body.innerHTML = "<h1>Error Loading Problem</h1>";
    });

auth.onAuthStateChanged((user) => {
    userId = user ? user.uid : null;
    console.log("auth.onAuthStateChanged: userId:", userId);
    if (userId && problemId) {
        loadCodeFromFirestore();
        showProblemStatus();
    }
});

cppEditor.on("change", () => {
    if (userId && problemId) {
        saveCodeToFirestore(cppEditor.getValue());
    }
});

if (typeof window !== "undefined") {
    window.runCppCode = runCppCode;
    window.runcppcode = runCppCode;
    window.runCode = runCppCode;
}
