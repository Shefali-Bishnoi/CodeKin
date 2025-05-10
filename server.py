import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
# More specific CORS setup - add your GitHub Pages URL
CORS(app, origins=["https://shefali-bishnoi.github.io", "http://localhost:5000"])

# Optional root route to confirm deployment
@app.route("/", methods=["GET"])
def home():
    return "Code execution backend is live!"

@app.route("/run", methods=["POST"])
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
    
    try:
        response = requests.post("https://api.jdoodle.com/v1/execute", json={
            "script": code,
            "language": "cpp17",
            "versionIndex": "1",
            "stdin": stdin,
            "clientId": client_id,
            "clientSecret": client_secret
        })
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Production-safe server launch
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # Use Render-assigned port
    app.run(host="0.0.0.0", port=port)
