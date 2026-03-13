import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  logService,
  hasGuestUsedService,
  markGuestServiceUsed,
  saveSprinklerPlan,
  getUserFields,
} from "../lib/supabase";
import { useBlockchain } from "../context/BlockchainContext";
import AddFieldModal from "../components/AddFieldModal";
import ImageUploader from "../components/ImageUploader";
import jsPDF from "jspdf";
import { applyPlugin } from "jspdf-autotable";
applyPlugin(jsPDF);
import "./Sprinkler.css";

function generateDiseasePDF(result) {
  const date = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const green = [0, 166, 118];

  const s = (text) => {
    if (text == null) return "N/A";
    return String(text)
      .replace(/₹/g, "Rs.")
      .replace(/°/g, " deg")
      .replace(/–/g, "-")
      .replace(/—/g, "-")
      .replace(/\u2018/g, "'")
      .replace(/\u2019/g, "'")
      .replace(/\u201c/g, '"')
      .replace(/\u201d/g, '"')
      .replace(/…/g, "...")
      .replace(/[^\x00-\x7F]/g, "");
  };

  const sevColors = {
    none: [40, 167, 69],
    low: [40, 167, 69],
    medium: [255, 193, 7],
    high: [220, 53, 69],
  };
  const sevKey = (result.severity || "none").toLowerCase();
  const sevColor = sevColors[sevKey] || [136, 136, 136];

  doc.setFillColor(...green);
  doc.rect(0, 0, pageWidth, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("KrishiMitra AI - Disease Detection Report", pageWidth / 2, 15, {
    align: "center",
  });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("AI-Powered Smart Farming Platform", pageWidth / 2, 24, {
    align: "center",
  });

  doc.setFillColor(248, 250, 248);
  doc.setDrawColor(...sevColor);
  doc.setLineWidth(0.8);
  doc.roundedRect(14, 38, pageWidth - 28, 20, 3, 3, "FD");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 29, 35);
  doc.text(s(result.diseaseName || "Unknown"), 20, 48);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Confidence: ${s(result.confidence || "N/A")}`, 20, 54);
  doc.setFillColor(...sevColor);
  const badgeText = (result.severity || "N/A").toUpperCase();
  const badgeW = doc.getTextWidth(badgeText) + 10;
  doc.roundedRect(pageWidth - 18 - badgeW, 43, badgeW, 10, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(badgeText, pageWidth - 18 - badgeW / 2, 49.5, { align: "center" });

  let y = 66;

  const drawSectionTitle = (title) => {
    if (y > 265) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...green);
    doc.text(title, 14, y);
    y += 2;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, y, pageWidth - 14, y);
    y += 5;
  };

  const drawList = (items) => {
    if (!items || !items.length) return;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    items.forEach((item) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      const lines = doc.splitTextToSize(`- ${s(item)}`, pageWidth - 34);
      doc.text(lines, 18, y);
      y += lines.length * 4.5;
    });
    y += 3;
  };

  const drawInfoTable = (rows) => {
    doc.autoTable({
      startY: y,
      body: rows,
      theme: "plain",
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { fontStyle: "bold", textColor: green, cellWidth: 45 },
        1: { textColor: [50, 50, 50] },
      },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;
  };

  if (result.symptoms?.length || result.causes?.length) {
    drawSectionTitle("Symptoms");
    drawList(result.symptoms);
    drawSectionTitle("Causes");
    drawList(result.causes);
  }

  if (result.treatment?.length || result.prevention?.length) {
    drawSectionTitle("Treatment");
    drawList(result.treatment);
    drawSectionTitle("Prevention");
    drawList(result.prevention);
  }

  if (result.additionalTips?.length) {
    drawSectionTitle("Additional Tips");
    drawList(result.additionalTips);
  }

  if (result.irrigationPlan) {
    drawSectionTitle("Irrigation Plan");
    drawInfoTable([
      ["Frequency", s(result.irrigationPlan.frequency)],
      ["Quantity", s(result.irrigationPlan.quantity)],
      ["Best Time", s(result.irrigationPlan.bestTime)],
      ["Method", s(result.irrigationPlan.method)],
    ]);
  }

  if (result.pesticide) {
    drawSectionTitle("Pesticide Details");
    drawInfoTable([
      ["Type", s(result.pesticide.type)],
      ["Amount", s(result.pesticide.amount)],
      ["Application", s(result.pesticide.applicationMethod)],
      ["Frequency", s(result.pesticide.frequency)],
      ["Safety Period", s(result.pesticide.safetyPeriod)],
    ]);
  }

  if (result.soilSuggestions) {
    drawSectionTitle("Soil Suggestions");
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    const soilLines = doc.splitTextToSize(
      s(result.soilSuggestions),
      pageWidth - 34,
    );
    if (y + soilLines.length * 4.5 > 275) {
      doc.addPage();
      y = 20;
    }
    doc.text(soilLines, 18, y);
    y += soilLines.length * 4.5 + 5;
  }

  if (result.sprinklerSchedule?.length) {
    drawSectionTitle("Sprinkler Schedule");
    doc.autoTable({
      startY: y,
      head: [["Day", "Time", "Action"]],
      body: result.sprinklerSchedule.map((item) => [
        s(item.day),
        s(item.time),
        s(item.action),
      ]),
      theme: "grid",
      headStyles: {
        fillColor: green,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9, textColor: [50, 50, 50] },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 4, lineColor: [226, 232, 240], lineWidth: 0.3 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  if (y > 270) {
    doc.addPage();
    y = 20;
  }
  doc.setDrawColor(226, 232, 240);
  doc.line(14, y, pageWidth - 14, y);
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated by KrishiMitra AI on ${date}`, pageWidth / 2, y + 7, {
    align: "center",
  });
  doc.text(
    "This report is AI-generated. Please consult local agricultural experts before making decisions.",
    pageWidth / 2,
    y + 13,
    { align: "center" },
  );

  doc.save(
    `Disease_Report_${(result.diseaseName || "Unknown").replace(/\s+/g, "_")}_${Date.now()}.pdf`,
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });
}

async function analyzeDisease(imageFile) {
  const base64 = await fileToBase64(imageFile);
  const base64Data = base64.split(",")[1];

  const response = await fetch("/api/analyze-plant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "disease",
      imageBase64: base64Data,
      mimeType: imageFile.type,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Analysis failed");
  }

  return {
    analysis: await response.json(),
    imageBase64: `data:${imageFile.type};base64,${base64Data}`,
  };
}

export default function Disease() {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [userCoords, setUserCoords] = useState(null);
  const [error, setError] = useState("");
  const [automating, setAutomating] = useState(false);
  const [guestBlocked, setGuestBlocked] = useState(false);
  const [showFieldPopup, setShowFieldPopup] = useState(false);
  const [fields, setFields] = useState([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [showAddField, setShowAddField] = useState(false);
  const { user, hasDevice } = useAuth();
  const blockchain = useBlockchain();
  const navigate = useNavigate();

  // Fetch user fields when popup opens
  useEffect(() => {
    if (!showFieldPopup || !user?.dbId) return;
    refreshFields();
  }, [showFieldPopup, user?.dbId]);

  const refreshFields = async () => {
    if (!user?.dbId) return;
    setFieldsLoading(true);
    const { fields: data } = await getUserFields(user.dbId);
    setFields(data || []);
    setFieldsLoading(false);
  };

  const handleAnalyze = async () => {
    if (!image) return;

    // Guest limit check (localStorage)
    if (user?.isGuest && hasGuestUsedService("disease_detection")) {
      setGuestBlocked(true);
      setError(
        "Guest users can only use each service once. Please sign in with Google to continue.",
      );
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setImageBase64(null);
    setUserCoords(null);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {},
        { timeout: 5000 },
      );
    }

    try {
      const { analysis, imageBase64: imgB64 } = await analyzeDisease(image);
      setResult(analysis);
      setImageBase64(imgB64);

      // Log to Supabase
      const userId = user?.dbId || null;
      if (userId) {
        logService(userId, "disease_detection", null, analysis);
        // Blockchain: record on-chain + award tokens
        if (blockchain) {
          blockchain.addRecord("disease_scan", analysis);
          blockchain.awardTokens(10, "disease_scan");
        }
      } else if (user?.isGuest) {
        markGuestServiceUsed("disease_detection");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFieldPopup = () => {
    setSelectedFieldId(null);
    setShowFieldPopup(true);
  };

  const handleConfirmAutomate = async () => {
    if (!result || !selectedFieldId) return;
    setAutomating(true);
    setShowFieldPopup(false);

    const selectedField = fields.find((f) => f.id === selectedFieldId);

    const plan = {
      diseaseName: result.diseaseName,
      severity: result.severity,
      confidence: result.confidence,
      symptoms: result.symptoms,
      causes: result.causes,
      treatment: result.treatment,
      prevention: result.prevention,
      additionalTips: result.additionalTips,
      irrigationPlan: result.irrigationPlan,
      pesticide: result.pesticide,
      soilSuggestions: result.soilSuggestions,
      sprinklerSchedule: result.sprinklerSchedule,
      imageBase64: imageBase64,
      userCoords: userCoords,
      fieldName: selectedField?.name || "Unknown Field",
    };

    // Save to Supabase if logged in
    if (user?.dbId) {
      await saveSprinklerPlan(user.dbId, plan);
    }

    // Also save to localStorage as fallback
    const localPlan = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      ...plan,
      sprayCount: 0,
      status: "active",
    };
    const existing = JSON.parse(
      localStorage.getItem("krishimitra_sprinkler_plans") || "[]",
    );
    existing.push(localPlan);
    localStorage.setItem(
      "krishimitra_sprinkler_plans",
      JSON.stringify(existing),
    );

    setTimeout(() => {
      setAutomating(false);
      navigate("/dashboard/sprinkler-dashboard");
    }, 800);
  };

  const renderList = (items) => (
    <ul className="tips-list">
      <ul>
        {(items || []).map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </ul>
  );

  return (
    <div className="page-container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-header"
      >
        <div className="page-title">
          <i className="fas fa-virus"></i>
          <h1>Disease Detection</h1>
        </div>
        <p className="page-desc">
          Upload a plant photo for instant disease diagnosis with treatment,
          prevention tips, and automated sprinkler plan
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
            disabled={!image || loading || guestBlocked}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Analyzing...
              </>
            ) : (
              <>
                <i className="fas fa-search"></i> Detect Disease
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
          >
            <div className="result-card disease-card">
              <div className="result-card-header">
                <i className="fas fa-virus"></i>
                <h3>Diagnosis</h3>
                <span
                  className={`severity-badge ${(result.severity || "none").toLowerCase()}`}
                >
                  {result.severity}
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

            <div className="result-card">
              <div className="result-card-header">
                <i className="fas fa-stethoscope"></i>
                <h3>Symptoms</h3>
              </div>
              <div className="result-card-body">
                {renderList(result.symptoms)}
              </div>
            </div>

            <div className="result-card">
              <div className="result-card-header">
                <i className="fas fa-exclamation-circle"></i>
                <h3>Causes</h3>
              </div>
              <div className="result-card-body">
                {renderList(result.causes)}
              </div>
            </div>

            <div className="result-card">
              <div className="result-card-header">
                <i className="fas fa-medkit"></i>
                <h3>Treatment</h3>
              </div>
              <div className="result-card-body">
                {renderList(result.treatment)}
              </div>
            </div>

            <div className="result-card">
              <div className="result-card-header">
                <i className="fas fa-shield-alt"></i>
                <h3>Prevention</h3>
              </div>
              <div className="result-card-body">
                {renderList(result.prevention)}
              </div>
            </div>

            {result.additionalTips?.length > 0 && (
              <div className="result-card">
                <div className="result-card-header">
                  <i className="fas fa-lightbulb"></i>
                  <h3>Additional Tips</h3>
                </div>
                <div className="result-card-body">
                  {renderList(result.additionalTips)}
                </div>
              </div>
            )}

            {result.irrigationPlan && (
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
                    <span className="value">
                      {result.irrigationPlan?.method}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {result.pesticide && (
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
            )}

            {result.soilSuggestions && (
              <div className="result-card tips-card">
                <div className="result-card-header">
                  <i className="fas fa-leaf"></i>
                  <h3>Soil Suggestions</h3>
                </div>
                <div className="result-card-body">
                  <div className="soil-info">
                    <p>{result.soilSuggestions}</p>
                  </div>
                </div>
              </div>
            )}

            {result.sprinklerSchedule?.length > 0 && (
              <div className="result-card schedule-card">
                <div className="result-card-header">
                  <i className="fas fa-calendar-alt"></i>
                  <h3>Sprinkler Schedule</h3>
                </div>
                <div className="result-card-body">
                  {result.sprinklerSchedule.map((item, i) => (
                    <div className="result-row" key={i}>
                      <span className="label">
                        {item.day} — {item.time}
                      </span>
                      <span className="value">{item.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="disease-action-row">
              <button
                className="pdf-btn"
                onClick={() => generateDiseasePDF(result)}
              >
                <i className="fas fa-file-pdf"></i> Download PDF Report
              </button>

              {hasDevice && (
                <button
                  className="automate-btn"
                  onClick={handleOpenFieldPopup}
                  disabled={automating}
                >
                  {automating ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i> Setting up...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-magic"></i> Make this Automatic
                    </>
                  )}
                </button>
              )}
            </div>

            {hasDevice && (
              <p className="automate-hint" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>
                <i className="fas fa-info-circle"></i> This will create an
                automated sprinkler plan based on this diagnosis and send it
                to your Sprinkler Dashboard
              </p>
            )}

            {/* ──── Field Selection Popup ──── */}
            {showFieldPopup && (
              <div className="field-popup-overlay" onClick={() => { setShowFieldPopup(false); setShowAddField(false); }}>
                <motion.div
                  className={`field-popup ${showAddField ? "field-popup--creating" : ""}`}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {showAddField ? (
                    /* Full field creation flow */
                    <>
                      <div className="field-popup-header">
                        <div className="field-popup-title">
                          <i className="fas fa-map-marked-alt"></i>
                          <h3>Add a Field</h3>
                        </div>
                        <div className="field-popup-header-actions">
                          <button className="field-popup-close" onClick={() => { setShowFieldPopup(false); setShowAddField(false); }}>
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      </div>
                      <div className="field-popup-body">
                        <AddFieldModal
                          onFieldCreated={() => {
                            setShowAddField(false);
                            refreshFields();
                          }}
                          onCancel={() => setShowAddField(false)}
                        />
                      </div>
                    </>
                  ) : (
                    /* Field selection list */
                    <>
                      <div className="field-popup-header">
                        <div className="field-popup-title">
                          <i className="fas fa-map-marked-alt"></i>
                          <h3>Select a Field</h3>
                        </div>
                        <div className="field-popup-header-actions">
                          <button
                            className="field-popup-refresh"
                            onClick={refreshFields}
                            disabled={fieldsLoading}
                            title="Refresh fields"
                          >
                            <i className={`fas fa-sync-alt ${fieldsLoading ? "fa-spin" : ""}`}></i>
                          </button>
                          <button className="field-popup-close" onClick={() => setShowFieldPopup(false)}>
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      </div>
                      <div className="field-popup-body">
                        {fieldsLoading ? (
                          <div className="field-popup-loading">
                            <i className="fas fa-spinner fa-spin"></i>
                            <p>Loading your fields...</p>
                          </div>
                        ) : fields.length === 0 ? (
                          <div className="field-popup-empty">
                            <div className="field-popup-empty-icon">
                              <i className="fas fa-map"></i>
                            </div>
                            <h4>No Fields Added Yet</h4>
                            <p>Add a field to get started with automation.</p>
                            <button
                              className="field-popup-add-btn"
                              onClick={() => setShowAddField(true)}
                            >
                              <i className="fas fa-plus"></i> Add a Field
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="field-popup-desc">Choose the field where this plan should be applied:</p>
                            <div className="field-popup-list">
                              {fields.map((field) => (
                                <div
                                  key={field.id}
                                  className={`field-popup-item ${selectedFieldId === field.id ? "selected" : ""}`}
                                  onClick={() => setSelectedFieldId(field.id)}
                                >
                                  <div className="field-popup-item-icon">
                                    <i className="fas fa-seedling"></i>
                                  </div>
                                  <div className="field-popup-item-info">
                                    <span className="field-popup-item-name">{field.name || "Unnamed Field"}</span>
                                    <span className="field-popup-item-meta">
                                      {field.area_sqm
                                        ? field.area_sqm >= 10000
                                          ? `${(field.area_sqm / 10000).toFixed(2)} ha`
                                          : field.area_sqm >= 4046.86
                                            ? `${(field.area_sqm / 4046.86).toFixed(2)} acres`
                                            : `${field.area_sqm.toFixed(0)} m²`
                                        : "—"}
                                      {" · "}
                                      {field.coordinates?.length || 0} points
                                    </span>
                                  </div>
                                  <div className="field-popup-item-check">
                                    {selectedFieldId === field.id && <i className="fas fa-check-circle"></i>}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="field-popup-bottom-actions">
                              <button
                                className="field-popup-add-more-btn"
                                onClick={() => setShowAddField(true)}
                              >
                                <i className="fas fa-plus"></i> Add New Field
                              </button>
                              <button
                                className="field-popup-confirm-btn"
                                disabled={!selectedFieldId}
                                onClick={handleConfirmAutomate}
                              >
                                <i className="fas fa-magic"></i> Automate for Selected Field
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
