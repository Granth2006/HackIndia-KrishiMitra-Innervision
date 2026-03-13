import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import {
  logService,
  hasGuestUsedService,
  markGuestServiceUsed,
} from "../lib/supabase";
import ImageUploader from "../components/ImageUploader";
import "./Sprinkler.css";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });
}

async function analyzeWithGroq(imageFile) {
  const base64 = await fileToBase64(imageFile);
  const base64Data = base64.split(",")[1];

  const response = await fetch("/api/analyze-plant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "sprinkler",
      imageBase64: base64Data,
      mimeType: imageFile.type,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Analysis failed");
  }

  return await response.json();
}

function generatePDF(data) {
  const content = `
KRISHIMITRA AI - AUTOMATIC SPRINKLER REPORT
=============================================
Date: ${new Date().toLocaleDateString()}

DISEASE ANALYSIS
Disease: ${data.diseaseName}
Severity: ${data.severity}
Confidence: ${data.confidence}

IRRIGATION PLAN
Frequency: ${data.irrigationPlan?.frequency || "N/A"}
Quantity: ${data.irrigationPlan?.quantity || "N/A"}
Best Time: ${data.irrigationPlan?.bestTime || "N/A"}
Method: ${data.irrigationPlan?.method || "N/A"}

PESTICIDE RECOMMENDATION
Type: ${data.pesticide?.type || "N/A"}
Amount: ${data.pesticide?.amount || "N/A"}
Application: ${data.pesticide?.applicationMethod || "N/A"}
Frequency: ${data.pesticide?.frequency || "N/A"}
Safety Period: ${data.pesticide?.safetyPeriod || "N/A"}

SOIL SUGGESTIONS
${data.soilSuggestions || "N/A"}

ADDITIONAL TIPS
${(data.additionalTips || []).map((t, i) => `${i + 1}. ${t}`).join("\n")}
  `.trim();

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sprinkler_report_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Sprinkler() {
  const { user } = useAuth();
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [guestBlocked, setGuestBlocked] = useState(false);

  const handleAnalyze = async () => {
    if (!image) return;

    // Guest limit check (localStorage)
    if (user?.isGuest && hasGuestUsedService("sprinkler_analysis")) {
      setGuestBlocked(true);
      setError(
        "Guest users can only use each service once. Please sign in with Google to continue.",
      );
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await analyzeWithGroq(image);
      setResult(data);

      // Log to Supabase
      const userId = user?.dbId || null;
      if (userId) {
        logService(userId, "sprinkler_analysis", null, data);
      } else if (user?.isGuest) {
        markGuestServiceUsed("sprinkler_analysis");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-header"
      >
        <div className="page-title">
          <i className="fas fa-tint"></i>
          <h1>Automatic Sprinkler System</h1>
        </div>
        <p className="page-desc">
          Upload a plant image to get AI-powered irrigation schedule, disease
          detection, and pesticide recommendations
        </p>
      </motion.div>

      <div className="sprinkler-grid">
        <motion.div
          className="upload-section card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <ImageUploader onImageSelect={setImage} label="Upload Plant Image" />
          <button
            className="analyze-btn"
            onClick={handleAnalyze}
            disabled={!image || loading}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Analyzing...
              </>
            ) : (
              <>
                <i className="fas fa-search"></i> Analyze Plant
              </>
            )}
          </button>
          {error && (
            <div className="error-msg">
              <i className="fas fa-exclamation-triangle"></i> {error}
            </div>
          )}
        </motion.div>

        {result && (
          <motion.div
            className="results-section"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {/* Disease Card */}
            <div className="result-card disease-card">
              <div className="result-card-header">
                <i className="fas fa-virus"></i>
                <h3>Disease Analysis</h3>
                <span
                  className={`severity-badge ${(result.severity || "none").toLowerCase()}`}
                >
                  {result.severity || "None"}
                </span>
              </div>
              <div className="result-card-body">
                <div className="result-row">
                  <span className="label">Disease</span>
                  <span className="value">{result.diseaseName}</span>
                </div>
                <div className="result-row">
                  <span className="label">Confidence</span>
                  <span className="value">{result.confidence}</span>
                </div>
              </div>
            </div>

            {/* Irrigation Card */}
            <div className="result-card irrigation-card">
              <div className="result-card-header">
                <i className="fas fa-tint"></i>
                <h3>Irrigation Plan</h3>
              </div>
              <div className="result-card-body">
                <div className="result-row">
                  <span className="label">💧 Frequency</span>
                  <span className="value">
                    {result.irrigationPlan?.frequency}
                  </span>
                </div>
                <div className="result-row">
                  <span className="label">💧 Quantity</span>
                  <span className="value">
                    {result.irrigationPlan?.quantity}
                  </span>
                </div>
                <div className="result-row">
                  <span className="label">🕐 Best Time</span>
                  <span className="value">
                    {result.irrigationPlan?.bestTime}
                  </span>
                </div>
                <div className="result-row">
                  <span className="label">🔧 Method</span>
                  <span className="value">{result.irrigationPlan?.method}</span>
                </div>
              </div>
            </div>

            {/* Pesticide Card */}
            <div className="result-card pesticide-card">
              <div className="result-card-header">
                <i className="fas fa-flask"></i>
                <h3>Pesticide Details</h3>
              </div>
              <div className="result-card-body">
                <div className="result-row">
                  <span className="label">🧪 Type</span>
                  <span className="value">{result.pesticide?.type}</span>
                </div>
                <div className="result-row">
                  <span className="label">📏 Amount</span>
                  <span className="value">{result.pesticide?.amount}</span>
                </div>
                <div className="result-row">
                  <span className="label">💉 Application</span>
                  <span className="value">
                    {result.pesticide?.applicationMethod}
                  </span>
                </div>
                <div className="result-row">
                  <span className="label">📅 Frequency</span>
                  <span className="value">{result.pesticide?.frequency}</span>
                </div>
                <div className="result-row">
                  <span className="label">⏳ Safety Period</span>
                  <span className="value">
                    {result.pesticide?.safetyPeriod}
                  </span>
                </div>
              </div>
            </div>

            {/* Soil & Tips */}
            <div className="result-card tips-card">
              <div className="result-card-header">
                <i className="fas fa-leaf"></i>
                <h3>Soil & Tips</h3>
              </div>
              <div className="result-card-body">
                {result.soilSuggestions && (
                  <div className="soil-info">
                    <strong>🌿 Soil Suggestions:</strong>
                    <p>{result.soilSuggestions}</p>
                  </div>
                )}
                {result.additionalTips?.length > 0 && (
                  <div className="tips-list">
                    <strong>💡 Additional Tips:</strong>
                    <ul>
                      {result.additionalTips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <button className="pdf-btn" onClick={() => generatePDF(result)}>
              <i className="fas fa-file-pdf"></i> Download Report
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
