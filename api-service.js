// api-service.js - Place this in your js folder

// Configuration
const API_URL = 'https://codekin-l4a6.onrender.com/run';

// API Functions
const CodeRunnerAPI = {
  /**
   * Sends code to the backend for execution
   * @param {string} code - The C++ code to execute
   * @param {string} input - Standard input for the program
   * @returns {Promise} - Response from the API
   */
  runCode: async function(code, input) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          input: input
        })
      });
      
      return await response.json();
    } catch (error) {
      console.error('Error connecting to API:', error);
      return { error: 'Failed to connect to API' };
    }
  }
  
  // Add other API functions here if needed
};

// Make it available globally
window.CodeRunnerAPI = CodeRunnerAPI;
