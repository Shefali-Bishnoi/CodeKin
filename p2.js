import { auth, db } from "./firebase-config.js";
import { doc, setDoc, serverTimestamp, getDoc, increment } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";

let testCases = [];
let activeTestCaseId = 0;
let userId = null;
let problemId = null;
let problemDifficulty = null;
let runningAllTests = false;
let userInputValues = {};
let currentProblem = null;

// Map statuses to emojis, consistent with problems.js
const statusMap = {
    Solved: "✅",
    Attempted: "🔄",
    "To-Do": "⏳"
};

// Initialize CodeMirror
let cppEditor = null;
try {
    cppEditor = CodeMirror.fromTextArea(document.getElementById("cppEditor"), {
        mode: "text/x-c++src",
        theme: "dracula",
        lineNumbers: true,
        autoCloseBrackets: true,
        matchBrackets: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        lineWrapping: true,
        extraKeys: {
            "Ctrl-Space": "autocomplete",
            "Tab": function(cm) {
                if (cm.somethingSelected()) {
                    cm.indentSelection("add");
                } else {
                    cm.replaceSelection("    ", "end");
                }
            }
        }
    });
    console.log("CodeMirror initialized successfully");
} catch (error) {
    console.error("Failed to initialize CodeMirror:", error.message);
    displayError("Error initializing code editor. Please refresh the page.");
}

// Initialize Split.js
try {
    Split(['#split-0', '#split-1'], {
        sizes: [50, 50],
        minSize: [300, 300],
        gutterSize: 10,
        direction: 'horizontal'
    });
    Split(['#nested-0', '#nested-1'], {
        sizes: [60, 40],
        minSize: [200, 200],
        gutterSize: 10,
        direction: 'vertical'
    });
    console.log("Split.js initialized successfully");
} catch (error) {
    console.error("Failed to initialize Split.js:", error.message);
    displayError("Error initializing layout. Please refresh the page.");
}

// Display error message to user
function displayError(message) {
    const errorDiv = document.createElement("div");
    errorDiv.style.color = "red";
    errorDiv.style.padding = "10px";
    errorDiv.textContent = message;
    document.getElementById("split-0").prepend(errorDiv);
}

// Parse test cases from problem description
function parseTestCases(description) {
    console.log("Parsing test cases from description:", description);
    const testCases = [];
    const exampleRegex = /Example \d+:\s*\n\s*Input:\s*([^\n]+)\s*\n\s*Output:\s*([^\n]+)/g;
    let match;

    while ((match = exampleRegex.exec(description)) !== null) {
        const inputStr = match[1].trim();
        const outputStr = match[2].trim();
        console.log("Found test case - Input:", inputStr, "Output:", outputStr);

        const inputs = {};
        const keyValueRegex = /(\w+)\s*=\s*(\[.*?\]|[^,]+)(?:,|$)/g;
        let kvMatch;
        let idx = 0;

        while ((kvMatch = keyValueRegex.exec(inputStr)) !== null) {
            const key = kvMatch[1].trim();
            let value = kvMatch[2].trim();
            console.log(`Parsing input - Key: ${key}, Value: ${value}`);
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            inputs[key] = value;
            idx++;
        }

        if (idx === 0 && inputStr.trim() !== "") {
            inputs["input"] = inputStr;
            console.log("No key-value pairs found, using raw input:", inputStr);
        }

        testCases.push({
            id: testCases.length + 1,
            ...inputs,
            outputText: outputStr,
            rawInputText: inputStr
        });
    }

    if (testCases.length === 0) {
        console.warn("No test cases found in description");
    } else {
        console.log("Parsed test cases:", testCases);
    }

    return testCases.map(tc => {
        const normalizedInputs = {};
        Object.keys(tc).forEach(key => {
            if (key === "id" || key === "outputText" || key === "rawInputText") return;
            let value = tc[key];
            console.log(`Normalizing input - Key: ${key}, Value: ${value}`);
            if (value.match(/^\[.*\]$/)) {
                normalizedInputs[key] = value;
            } else if (!isNaN(value)) {
                normalizedInputs[key] = value;
            } else {
                normalizedInputs[key] = `"${value}"`;
            }
        });
        return {
            ...normalizedInputs,
            id: tc.id,
            outputText: tc.outputText,
            rawInputText: tc.rawInputText
        };
    });
}

// Detect linked list problems
function isLinkedListProblem(description) {
    const isLinkedList = description.toLowerCase().includes("linked list") || description.includes("ListNode");
    console.log("Linked list problem detected:", isLinkedList);
    return isLinkedList;
}

// Render input boxes
function renderInputBoxes(inputs) {
    const inputContainer = document.getElementById("input-container");
    if (!inputContainer) {
        console.error("input-container element not found");
        return;
    }
    inputContainer.innerHTML = "";
    console.log("Rendering input boxes for inputs:", inputs);

    Object.keys(inputs).sort().forEach((key) => {
        if (key === "id" || key === "outputText" || key === "rawInputText") return;

        const containerDiv = document.createElement("div");
        containerDiv.className = "input-group";

        const label = document.createElement("label");
        label.className = "test-label";
        label.textContent = `${key} =`;

        if (inputs[key].includes("[")) {
            const sizeLabel = document.createElement("label");
            sizeLabel.textContent = `${key} size:`;
            const sizeInput = document.createElement("input");
            sizeInput.type = "number";
            sizeInput.className = "test-input size-input";
            sizeInput.id = `size-input-${key}`;
            sizeInput.min = "0";
            sizeInput.value = inputs[key].replace(/[\[\]]/g, "").split(",").filter(x => x.trim()).length || 0;

            const elementsLabel = document.createElement("label");
            elementsLabel.textContent = `${key} elements:`;
            const elementsInput = document.createElement("input");
            elementsInput.className = "test-input";
            elementsInput.id = `input-field-${key}`;
            elementsInput.value = inputs[key].replace(/[\[\]]/g, "");

            sizeInput.addEventListener("change", (e) => {
                const size = parseInt(e.target.value);
                if (size < 0) {
                    e.target.value = 0;
                    alert("Array size cannot be negative.");
                    return;
                }
                userInputValues[activeTestCaseId] = userInputValues[activeTestCaseId] || {};
                userInputValues[activeTestCaseId][key] = Array(size).fill(0).join(",");
                elementsInput.value = userInputValues[activeTestCaseId][key];
                testCases[activeTestCaseId][key] = `[${userInputValues[activeTestCaseId][key]}]`;
            });

            elementsInput.addEventListener("change", (e) => {
                let values = e.target.value.split(",").map(x => x.trim()).filter(x => x);
                if (values.length !== parseInt(sizeInput.value)) {
                    alert(`Please enter exactly ${sizeInput.value} elements.`);
                    e.target.value = userInputValues[activeTestCaseId][key] || inputs[key].replace(/[\[\]]/g, "");
                    return;
                }
                if (!values.every(v => !isNaN(v))) {
                    alert("Array elements must be numbers.");
                    e.target.value = userInputValues[activeTestCaseId][key] || inputs[key].replace(/[\[\]]/g, "");
                    return;
                }
                userInputValues[activeTestCaseId] = userInputValues[activeTestCaseId] || {};
                userInputValues[activeTestCaseId][key] = e.target.value;
                testCases[activeTestCaseId][key] = `[${e.target.value}]`;
            });

            containerDiv.appendChild(sizeLabel);
            containerDiv.appendChild(sizeInput);
            containerDiv.appendChild(elementsLabel);
            containerDiv.appendChild(elementsInput);
        } else {
            const input = document.createElement("input");
            input.className = "test-input";
            input.id = `input-field-${key}`;
            input.value = inputs[key].replace(/^"|"$/g, "");

            input.addEventListener("change", (e) => {
                let value = e.target.value;
                if (key === "target" && isNaN(value)) {
                    alert("Target must be a number.");
                    e.target.value = inputs[key].replace(/^"|"$/g, "");
                    return;
                }
                if (!isNaN(value)) {
                    testCases[activeTestCaseId][key] = value;
                } else {
                    testCases[activeTestCaseId][key] = `"${value}"`;
                }
                userInputValues[activeTestCaseId] = userInputValues[activeTestCaseId] || {};
                userInputValues[activeTestCaseId][key] = value;
            });

            containerDiv.appendChild(label);
            containerDiv.appendChild(input);
        }

        const helpText = document.createElement("div");
        helpText.className = "input-help";
        helpText.innerHTML = inputs[key].includes("[") ? "Format: comma-separated numbers" : isNaN(inputs[key].replace(/^"|"$/g, "")) ? "Enter a string" : "Enter a number";
        containerDiv.appendChild(helpText);
        inputContainer.appendChild(containerDiv);
    });

    const hint = document.createElement("p");
    hint.className = "test-hint";
    hint.textContent = "Edit inputs to test custom cases.";
    inputContainer.appendChild(hint);
}

// Render test case buttons
function renderTestCases() {
    const casesContainer = document.getElementById("cases-container");
    if (!casesContainer) {
        console.error("cases-container element not found");
        return;
    }
    casesContainer.innerHTML = "";
    console.log("Rendering test cases:", testCases);

    const runAllButton = document.createElement("div");
    runAllButton.className = "run-all-btn";
    runAllButton.textContent = "Run All Tests";
    runAllButton.onclick = runAllTestCases;
    casesContainer.appendChild(runAllButton);

    testCases.forEach((testCase, index) => {
        const button = document.createElement("div");
        button.className = `case-btn ${index === activeTestCaseId ? "active" : ""}`;
        button.textContent = `Case ${index + 1}`;
        button.onclick = () => selectTestCase(index);
        casesContainer.appendChild(button);
    });

    const customButton = document.createElement("div");
    customButton.className = "custom-btn";
    customButton.textContent = "+ Custom Test";
    customButton.onclick = addCustomTestCase;
    casesContainer.appendChild(customButton);

    updateTestCaseView();
}

// Select a test case
function selectTestCase(index) {
    activeTestCaseId = index;
    renderTestCases();
}

// Add a custom test case
function addCustomTestCase() {
    if (testCases.length === 0) {
        console.warn("Cannot add custom test case: no existing test cases");
        return;
    }
    const newTestCase = { ...testCases[0], id: testCases.length + 1 };
    Object.keys(newTestCase).forEach(key => {
        if (key === "id") return;
        if (key === "outputText") newTestCase[key] = "";
        else if (key === "rawInputText") newTestCase[key] = "Custom input";
        else if (newTestCase[key].includes("[")) newTestCase[key] = "[0]";
        else if (!isNaN(newTestCase[key])) newTestCase[key] = "0";
        else newTestCase[key] = '""';
    });
    testCases.push(newTestCase);
    activeTestCaseId = testCases.length - 1;
    renderTestCases();
}

// Update test case view
async function updateTestCaseView() {
    const activeTestCase = testCases[activeTestCaseId];
    if (!activeTestCase) {
        console.warn("No active test case");
        return;
    }

    console.log("Updating test case view for case:", activeTestCase);
    renderInputBoxes(activeTestCase);
    const expectedOutputBox = document.getElementById("expected-output-box");
    if (expectedOutputBox) {
        expectedOutputBox.textContent = activeTestCase.outputText || "No expected output";
    } else {
        console.error("expected-output-box element not found");
    }

    if (userId && problemId) {
        try {
            const resultDocRef = doc(db, "users", userId, "problems", problemId, "testCases", `case_${activeTestCaseId + 1}`);
            const resultDoc = await getDoc(resultDocRef);
            if (resultDoc.exists()) {
                const data = resultDoc.data();
                const resultBox = document.getElementById("result-box");
                const verdictBox = document.getElementById("verdict-box");
                if (resultBox && verdictBox) {
                    resultBox.textContent = data.output || "";
                    verdictBox.textContent = data.verdict || "";
                    verdictBox.className = `verdict-box ${data.verdict === "Accepted" ? "accepted" : data.verdict === "Wrong Answer" ? "wrong" : "error"}`;
                }
            } else {
                clearResultBoxes();
            }
        } catch (error) {
            console.error("updateTestCaseView: Error:", error.message);
            clearResultBoxes();
        }
    }
    await showProblemStatus();
}

// Clear result boxes
function clearResultBoxes() {
    const resultBox = document.getElementById("result-box");
    const verdictBox = document.getElementById("verdict-box");
    if (resultBox && verdictBox) {
        resultBox.textContent = "";
        verdictBox.textContent = "";
        verdictBox.className = "verdict-box";
    } else {
        console.error("Result or verdict box elements not found");
    }
}

// Save code to Firestore
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

// Load code from Firestore
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
        } else {
            generateTemplateCode();
            console.log("loadCodeFromFirestore: No saved code, generated template - path:", path);
        }
    } catch (error) {
        console.error("loadCodeFromFirestore: Failed - path:", path, "error:", error.message);
        generateTemplateCode();
    }
}

// Generate template code
function generateTemplateCode() {
    if (!testCases.length || !currentProblem) {
        console.warn("Cannot generate template: no test cases or problem data");
        return;
    }
    console.log("Generating template code for problemId:", problemId);
    const isLinkedList = isLinkedListProblem(currentProblem.description);
    const firstTestCase = testCases[0];

    // Custom template for "Two Sum" (problemId === "1")
    if (problemId === "1") {
        const templateCode = `#include <iostream>
#include <vector>
#include <unordered_map>
using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    // TODO: Implement your solution
    return {};
}

int main() {
    int size;
    cin >> size;
    if (size < 2) { cout << "Invalid size"; return 1; }
    vector<int> nums(size);
    for (int i = 0; i < size; i++) { cin >> nums[i]; }
    int target;
    cin >> target;
    vector<int> result = twoSum(nums, target);
    if (result.size() != 2) { cout << "No solution"; return 1; }
    cout << "[" << result[0] << "," << result[1] << "]" << endl;
    return 0;
}`;
        cppEditor.setValue(templateCode);
        console.log("Template code set for Two Sum");
        return;
    }

    // Generic template for other problems
    let templateCode = `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <unordered_map>
#include <iomanip>
using namespace std;
`;

    if (isLinkedList) {
        templateCode += `struct ListNode {
    int val;
    ListNode* next;
    ListNode(int x) : val(x), next(nullptr) {}
};
`;
    }

    let functionName = "solution";
    let returnType;
    if (firstTestCase.outputText.includes("[")) {
        returnType = "vector<int>";
    } else if (!isNaN(parseFloat(firstTestCase.outputText))) {
        returnType = "double";
    } else if (firstTestCase.outputText.toLowerCase() === "true" || firstTestCase.outputText.toLowerCase() === "false") {
        returnType = "bool";
    } else {
        returnType = "string";
    }

    let params = [];
    Object.keys(firstTestCase).forEach(key => {
        if (key === "id" || key === "outputText" || key === "rawInputText") return;
        const value = firstTestCase[key];
        if (isLinkedList && value.includes("[")) {
            params.push(`ListNode* ${key}`);
        } else if (value.includes("[")) {
            params.push(`vector<int> ${key}`);
        } else if (!isNaN(value)) {
            params.push(`int ${key}`);
        } else {
            params.push(`string ${key}`);
        }
    });

    templateCode += `${returnType} ${functionName}(${params.join(", ")}) {
    // TODO: Implement your solution
    ${returnType === "vector<int>" ? "return {};" : returnType === "double" ? "return 0.0;" : returnType === "bool" ? "return false;" : "return true;"}
}
`;

    templateCode += `int main() {
    // Input handling
`;
    Object.keys(firstTestCase).forEach(key => {
        if (key === "id" || key === "outputText" || key === "rawInputText") return;
        const value = firstTestCase[key];
        if (isLinkedList && value.includes("[")) {
            templateCode += `    // Read linked list ${key}
    int ${key}_size;
    cin >> ${key}_size;
    ListNode* ${key} = nullptr;
    ListNode* ${key}_curr = nullptr;
    for (int i = 0; i < ${key}_size; i++) {
        int val;
        cin >> val;
        ListNode* node = new ListNode(val);
        if (!${key}) {
            ${key} = ${key}_curr = node;
        } else {
            ${key}_curr->next = node;
            ${key}_curr = node;
        }
    }
`;
        } else if (value.includes("[")) {
            templateCode += `    // Read array ${key}
    int ${key}_size;
    cin >> ${key}_size;
    vector<int> ${key}(${key}_size);
    for (int i = 0; i < ${key}_size; i++) {
        cin >> ${key}[i];
    }
`;
        } else if (!isNaN(value)) {
            templateCode += `    // Read ${key}
    int ${key};
    cin >> ${key};
`;
        } else {
            templateCode += `    // Read ${key}
    string ${key};
    cin >> ${key};
`;
        }
    });

    templateCode += `    // Call solution
    auto result = ${functionName}(${params.map(p => p.split(" ")[1]).join(", ")});
    
    // Output
`;
    if (returnType === "vector<int>") {
        templateCode += `    cout << "[";
    for (size_t i = 0; i < result.size(); i++) {
        cout << result[i];
        if (i < result.size() - 1) cout << ",";
    }
    cout << "]";
`;
    } else if (returnType === "bool") {
        templateCode += `    cout << (result ? "true" : "false");
`;
    } else if (returnType === "double") {
        templateCode += `    cout << fixed << setprecision(5) << result;
`;
    } else {
        templateCode += `    cout << result;
`;
    }
    templateCode += `
    cout << endl;
    return 0;
}`;
    cppEditor.setValue(templateCode);
    console.log("Template code set in editor");
}

// Run code for current test case
async function runCppCode() {
    updateRunButton(true);
    if (!auth.currentUser || !userId || !problemId || auth.currentUser.uid !== userId) {
        document.getElementById("result-box").textContent = "Sign in required.";
        document.getElementById("verdict-box").textContent = "Sign-in required";
        updateRunButton(false);
        console.error("runCppCode: No user - userId:", userId, "auth.currentUser:", auth.currentUser);
        return;
    }

    const code = cppEditor.getValue();
    const activeTestCase = testCases[activeTestCaseId];
    await saveCodeToFirestore(code);

    const input = prepareTestCaseInput(activeTestCase);
    console.log("runCppCode: Sending input to backend:", input);
    try {
        document.getElementById("result-box").textContent = "Running...";
        document.getElementById("verdict-box").textContent = "Evaluating";

        console.log("runCppCode: Fetching https://codekin-l4a6.onrender.com/run");
        const response = await fetch("https://codekin-l4a6.onrender.com/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, input })
        });

        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const result = await response.json();
        const output = result.output?.trim() || "No output";
        document.getElementById("result-box").textContent = output;
        console.log("runCppCode: API output:", output);

        const verdict = checkVerdict(output, activeTestCase.outputText);
        const savedTestCase = await saveTestCaseResult(output, verdict);
        const savedStatus = await saveProblemStatus(verdict);

        const points = problemDifficulty === "Easy" ? 50 : problemDifficulty === "Medium" ? 100 : problemDifficulty === "Hard" ? 200 : 0;
        if (verdict === "Accepted" && points > 0 && !runningAllTests) {
            await updateUserPoints(points);
            showSuccessModal(`You earned ${points} points!`);
        }

        const verdictBox = document.getElementById("verdict-box");
        verdictBox.textContent = savedTestCase && savedStatus ? `${verdict} (Saved)` : `${verdict} (Save failed - check permissions)`;
        verdictBox.className = `verdict-box ${verdict === "Accepted" ? "accepted" : verdict === "Wrong Answer" ? "wrong" : "error"}`;
    } catch (error) {
        console.error("runCppCode: Error:", error.message);
        document.getElementById("result-box").textContent = "Run failed: " + error.message;
        document.getElementById("verdict-box").textContent = "Error (Save failed)";
        document.getElementById("verdict-box").className = "verdict-box error";
        await saveTestCaseResult(error.message, "Error");
        await saveProblemStatus("Error");
    }
    await showProblemStatus();
    updateRunButton(false);
}

// Run all test cases
async function runAllTestCases() {
    if (!testCases.length || !auth.currentUser || !userId || !problemId) {
        console.error("runAllTestCases: Cannot run - testCases:", testCases.length, "userId:", userId, "problemId:", problemId);
        return;
    }
    runningAllTests = true;
    updateRunButton(true);

    const resultsContainer = document.getElementById("results-container") || createResultsContainer();
    resultsContainer.style.display = "block";
    const resultsTable = document.getElementById("results-table");
    resultsTable.innerHTML = `<tr><th>Test Case</th><th>Input</th><th>Expected Output</th><th>Your Output</th><th>Status</th></tr>`;

    let allAccepted = true;
    const code = cppEditor.getValue();
    await saveCodeToFirestore(code);

    for (let i = 0; i < testCases.length; i++) {
        activeTestCaseId = i;
        const testCase = testCases[i];
        const row = resultsTable.insertRow(-1);
        row.innerHTML = `<td>Case ${i + 1}</td><td>${testCase.rawInputText}</td><td>${testCase.outputText || "N/A"}</td><td>Running...</td><td><span class="status-running">Running</span></td>`;

        try {
            const input = prepareTestCaseInput(testCase);
            console.log(`runAllTestCases: Running test case ${i + 1}, input:`, input);
            const response = await fetch("https://codekin-l4a6.onrender.com/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, input })
            });

            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            const result = await response.json();
            const output = result.output?.trim() || "No output";
            const verdict = checkVerdict(output, testCase.outputText);
            console.log(`runAllTestCases: Test case ${i + 1} verdict: ${verdict}, Output: ${output}, Expected: ${testCase.outputText}`);

            row.cells[3].textContent = output;
            const statusSpan = document.createElement("span");
            statusSpan.className = `status-${verdict.toLowerCase().replace(" ", "-")}`;
            statusSpan.textContent = verdict;
            row.cells[4].innerHTML = "";
            row.cells[4].appendChild(statusSpan);

            await saveTestCaseResult(output, verdict);
            await saveProblemStatus(verdict);
            if (verdict !== "Accepted") allAccepted = false;
        } catch (error) {
            console.error(`runAllTestCases: Test case ${i + 1} error:`, error.message);
            row.cells[3].textContent = error.message;
            row.cells[4].innerHTML = '<span class="status-error">Error</span>';
            allAccepted = false;
            await saveTestCaseResult(error.message, "Error");
            await saveProblemStatus("Error");
        }
    }

    if (allAccepted) {
        const points = problemDifficulty === "Easy" ? 50 : problemDifficulty === "Medium" ? 100 : problemDifficulty === "Hard" ? 200 : 0;
        if (points > 0) {
            await updateUserPoints(points);
            showSuccessModal(`All test cases passed! You earned ${points} points!`);
        }
    }

    activeTestCaseId = 0;
    renderTestCases();
    runningAllTests = false;
    updateRunButton(false);
}

// Create results container
function createResultsContainer() {
    const container = document.createElement("div");
    container.id = "results-container";
    container.className = "results-container";
    container.style.display = "none";

    const title = document.createElement("h3");
    title.textContent = "Test Case Results";
    container.appendChild(title);

    const table = document.createElement("table");
    table.id = "results-table";
    table.className = "results-table";
    container.appendChild(table);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.className = "close-btn";
    closeBtn.onclick = () => container.style.display = "none";
    container.appendChild(closeBtn);

    document.getElementById("split-0").appendChild(container);
    return container;
}

// Show success modal
function showSuccessModal(message) {
    let modal = document.getElementById("success-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "success-modal";
        modal.className = "modal";
        const content = document.createElement("div");
        content.className = "modal-content";
        const closeBtn = document.createElement("span");
        closeBtn.className = "close-modal";
        closeBtn.innerHTML = "×";
        closeBtn.onclick = () => modal.style.display = "none";
        const text = document.createElement("p");
        content.appendChild(closeBtn);
        content.appendChild(text);
        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    modal.querySelector("p").innerHTML = `<div class="success-message"><span class="success-emoji">🎉</span>${message}</div>`;
    modal.style.display = "block";
    setTimeout(() => modal.style.display = "none", 5000);
}

// Update run button state
function updateRunButton(isRunning) {
    const runButton = document.getElementById("run-button");
    if (runButton) {
        runButton.disabled = isRunning;
        runButton.textContent = isRunning ? "Running..." : "Run Code";
    } else {
        console.error("run-button element not found");
    }
}

// Prepare input for C++ program
function prepareTestCaseInput(testCase) {
    if (!testCase) return "";
    const activeUserInputs = userInputValues[activeTestCaseId] || {};
    const inputLines = Object.keys(testCase)
        .filter(key => key !== "id" && key !== "outputText" && key !== "rawInputText")
        .map(key => {
            const value = activeUserInputs[key] || testCase[key];
            if (value.includes("[")) {
                const elements = value.replace(/[\[\]]/g, "").split(",").filter(x => x.trim());
                return `${elements.length}\n${elements.join("\n")}`;
            }
            return value.replace(/^"|"$/g, "");
        });
    const input = inputLines.join("\n");
    console.log("Prepared input:", input);
    return input;
}

// Check verdict
function checkVerdict(userOutput, expectedOutput) {
    console.log("Checking verdict - User Output:", userOutput, "Expected Output:", expectedOutput);
    const normalizeOutput = output => output.trim().replace(/\s+/g, "").replace(/[\[\]]/g, "");
    const normalizedUserOutput = normalizeOutput(userOutput);
    const normalizedExpected = normalizeOutput(expectedOutput);
    console.log("Normalized - User Output:", normalizedUserOutput, "Expected Output:", normalizedExpected);

    if (!isNaN(parseFloat(normalizedUserOutput)) && !isNaN(parseFloat(normalizedExpected))) {
        const userNum = parseFloat(normalizedUserOutput);
        const expectedNum = parseFloat(normalizedExpected);
        console.log(`Floating-point comparison: |${userNum} - ${expectedNum}| < 1e-5`);
        return Math.abs(userNum - expectedNum) < 1e-5 ? "Accepted" : "Wrong Answer";
    }

    if (normalizedExpected.toLowerCase() === "true" || normalizedExpected.toLowerCase() === "false") {
        console.log("Boolean comparison:", normalizedUserOutput.toLowerCase(), normalizedExpected.toLowerCase());
        return normalizedUserOutput.toLowerCase() === normalizedExpected.toLowerCase() ? "Accepted" : "Wrong Answer";
    }

    console.log("String comparison:", normalizedUserOutput, normalizedExpected);
    return normalizedUserOutput === normalizedExpected ? "Accepted" : "Wrong Answer";
}

// Save test case result
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

// Save problem status
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
            timestamp: serverTimestamp()
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

// Show problem status
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

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("getDoc timeout")), 5000);
        });
        const statusDoc = await Promise.race([getDoc(statusDocRef), timeoutPromise]);

        console.log("showProblemStatus: Doc exists:", statusDoc.exists(), "Data:", statusDoc.data());
        if (statusDoc.exists()) {
            const data = statusDoc.data();
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

// Create status box
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

// Update user points
async function updateUserPoints(points) {
    if (!userId || !auth.currentUser || auth.currentUser.uid !== userId) {
        console.error("updateUserPoints: Cannot save - userId:", userId, "auth:", auth.currentUser);
        return false;
    }

    try {
        const path = `users/${userId}`;
        const userRef = doc(db, "users", userId);
        await setDoc(userRef, { points: increment(points) }, { merge: true });
        console.log("updateUserPoints: Added points:", points, "path:", path);
        return true;
    } catch (error) {
        console.error("updateUserPoints: Failed - path:", path, "error:", error.message);
        return false;
    }
}

// Get query parameter
function getQueryParam(param) {
    const value = new URLSearchParams(window.location.search).get(param);
    console.log(`Query param ${param}:`, value);
    return value;
}

// Load problem and initialize
console.log("Fetching problems.json...");
fetch("problems.json")
    .then(response => {
        if (!response.ok) {
            throw new Error(`Failed to fetch problems.json: ${response.status} ${response.statusText}`);
        }
        return response.json();
    })
    .then(problems => {
        console.log("Problems loaded:", problems);
        problemId = getQueryParam("id");
        if (!problemId) {
            console.error("No problem ID provided in URL");
            displayError("No problem ID provided in URL. Please use ?id=<number> (e.g., ?id=1)");
            return;
        }

        const problem = problems.find(p => p.id === problemId);
        if (!problem) {
            console.error(`Problem with ID ${problemId} not found`);
            displayError(`Problem with ID ${problemId} not found`);
            return;
        }

        currentProblem = problem;
        problemDifficulty = problem.difficulty;
        console.log("Selected problem:", problem.title, "Difficulty:", problemDifficulty);

        const titleElement = document.getElementById("IDandTitle");
        const statementElement = document.getElementById("statement");
        const coinPointsElement = document.getElementById("coin-points");
        if (titleElement && statementElement && coinPointsElement) {
            titleElement.innerText = problem.title;
            statementElement.innerText = problem.description;
            coinPointsElement.innerText = `Coins: ${problemDifficulty === "Easy" ? 50 : problemDifficulty === "Medium" ? 100 : 200}`;
            console.log("Updated DOM elements with problem data");
        } else {
            console.error("DOM elements (IDandTitle, statement, or coin-points) not found");
            displayError("Error rendering problem data. Please check page structure.");
        }

        testCases = parseTestCases(problem.description);
        if (!testCases.length) {
            console.error("No test cases found for problem");
            displayError("No test cases found for this problem");
            return;
        }

        renderTestCases();
        if (userId) {
            loadCodeFromFirestore();
            showProblemStatus();
        }
    })
    .catch(error => {
        console.error("Failed to load problems:", error.message);
        displayError(`Failed to load problem data: ${error.message}`);
    });

auth.onAuthStateChanged(user => {
    userId = user ? user.uid : null;
    console.log("Auth state changed, userId:", userId);
    if (userId && problemId) {
        loadCodeFromFirestore();
        showProblemStatus();
    }
});

cppEditor.on("change", () => {
    if (userId && problemId) saveCodeToFirestore(cppEditor.getValue());
});

if (typeof window !== "undefined") {
    window.runCppCode = runCppCode;
    window.runcppcode = runCppCode;
    window.runCode = runCppCode;
}
