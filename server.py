import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

@app.route('/run', methods=['POST'])
def run_code():
    data = request.json
    code = data.get("code", "")
    stdin = data.get("input", "")
    
    # Get credentials from environment variables
    client_id = os.environ.get('JDOODLE_CLIENT_ID')
    client_secret = os.environ.get('JDOODLE_CLIENT_SECRET')
    
    # Check if credentials are available
    if not client_id or not client_secret:
        return jsonify({"error": "API credentials not configured"}), 500
    
    response = requests.post("https://api.jdoodle.com/v1/execute", json={
        "script": code,
        "language": "cpp17",
        "versionIndex": "1",
        "stdin": stdin,
        "clientId": client_id,
        "clientSecret": client_secret
    })
    
    return jsonify(response.json())

# For local development only - this won't run in production
if __name__ == "__main__":
    app.run(debug=True)