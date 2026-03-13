import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import {
  getSprinklerPlans,
  updatePlanSprayCount,
  deleteSprinklerPlan,
} from "../lib/supabase";
import "./SprinklerDashboard.css";

export default function SprinklerDashboard() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Load plans from Supabase (or localStorage fallback)
  useEffect(() => {
    const loadPlans = async () => {
      setLoadingPlans(true);
      if (user?.dbId) {
        const { plans: cloudPlans } = await getSprinklerPlans(user.dbId);
        if (cloudPlans.length > 0) {
          // Map snake_case DB fields to camelCase for the UI
          const mapped = cloudPlans.map((p) => ({
            id: p.id,
            createdAt: p.created_at,
            diseaseName: p.disease_name,
            severity: p.severity,
            confidence: p.confidence,
            symptoms: p.symptoms,
            causes: p.causes,
            treatment: p.treatment,
            prevention: p.prevention,
            additionalTips: p.additional_tips,
            irrigationPlan: p.irrigation_plan,
            pesticide: p.pesticide,
            soilSuggestions: p.soil_suggestions,
            sprinklerSchedule: p.sprinkler_schedule,
            imageBase64: p.image_url,
            userCoords: p.user_coords,
            sprayCount: p.spray_count,
            status: p.status,
            fieldName: p.field_name,
          }));
          setPlans(mapped);
          setLoadingPlans(false);
          return;
        }
      }
      // Fallback: localStorage
      const stored = JSON.parse(
        localStorage.getItem("krishimitra_sprinkler_plans") || "[]",
      );
      stored.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setPlans(stored);
      setLoadingPlans(false);
    };
    loadPlans();
  }, [user]);

  const deletePlan = async (id) => {
    const updated = plans.filter((p) => p.id !== id);
    setPlans(updated);
    if (selectedPlan?.id === id) setSelectedPlan(null);

    // Delete from Supabase
    if (user?.dbId) {
      await deleteSprinklerPlan(id);
    }
    // Also clean localStorage
    const localPlans = JSON.parse(
      localStorage.getItem("krishimitra_sprinkler_plans") || "[]",
    ).filter((p) => p.id !== id);
    localStorage.setItem(
      "krishimitra_sprinkler_plans",
      JSON.stringify(localPlans),
    );
  };

  const incrementSpray = async (id) => {
    const updated = plans.map((p) =>
      p.id === id ? { ...p, sprayCount: (p.sprayCount || 0) + 1 } : p,
    );
    setPlans(updated);
    if (selectedPlan?.id === id) {
      setSelectedPlan({
        ...selectedPlan,
        sprayCount: (selectedPlan.sprayCount || 0) + 1,
      });
    }

    // Sync to Supabase
    const plan = updated.find((p) => p.id === id);
    if (user?.dbId && plan) {
      await updatePlanSprayCount(id, plan.sprayCount);
    }
    // Also update localStorage
    const localPlans = JSON.parse(
      localStorage.getItem("krishimitra_sprinkler_plans") || "[]",
    ).map((p) =>
      p.id === id ? { ...p, sprayCount: (p.sprayCount || 0) + 1 } : p,
    );
    localStorage.setItem(
      "krishimitra_sprinkler_plans",
      JSON.stringify(localPlans),
    );
  };

  const formatDate = (iso) => {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderList = (items) => (
    <ul className="sd-list">
      {(items || []).map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );

  // ========= DETAIL VIEW =========
  if (selectedPlan) {
    return (
      <div className="page-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="page-header"
        >
          <button className="sd-back-btn" onClick={() => setSelectedPlan(null)}>
            <i className="fas fa-arrow-left"></i> Back to Dashboard
          </button>
          <div className="page-title">
            <i className="fas fa-tachometer-alt"></i>
            <h1>Plan Details</h1>
          </div>
          <p className="page-desc">
            Created on {formatDate(selectedPlan.createdAt)}
          </p>
        </motion.div>

        <div className="sd-detail-grid">
          {selectedPlan.imageBase64 && (
            <motion.div
              className="sd-detail-card sd-image-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <div className="sd-detail-card-header">
                <i className="fas fa-image"></i>
                <h3>Uploaded Image</h3>
              </div>
              <div className="sd-detail-card-body sd-image-body">
                <img
                  src={selectedPlan.imageBase64}
                  alt="Plant"
                  className="sd-plant-image"
                />
              </div>
            </motion.div>
          )}

          <motion.div
            className="sd-detail-card sd-disease-detail"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="sd-detail-card-header">
              <i className="fas fa-virus"></i>
              <h3>Disease Information</h3>
              <span
                className={`severity-badge ${(selectedPlan.severity || "none").toLowerCase()}`}
              >
                {selectedPlan.severity}
              </span>
            </div>
            <div className="sd-detail-card-body">
              <div className="sd-row">
                <span className="sd-label">Disease</span>
                <span className="sd-value">{selectedPlan.diseaseName}</span>
              </div>
              <div className="sd-row">
                <span className="sd-label">Confidence</span>
                <span className="sd-value">{selectedPlan.confidence}</span>
              </div>
              <div className="sd-row">
                <span className="sd-label">Status</span>
                <span className={`sd-status-badge ${selectedPlan.status}`}>
                  <i className="fas fa-circle"></i>{" "}
                  {selectedPlan.status === "active" ? "Active" : "Completed"}
                </span>
              </div>
              {selectedPlan.userCoords && (
                <div className="sd-row">
                  <span className="sd-label">Coordinates</span>
                  <span className="sd-value">
                    {selectedPlan.userCoords.lat?.toFixed(4)},{" "}
                    {selectedPlan.userCoords.lng?.toFixed(4)}
                  </span>
                </div>
              )}
              {selectedPlan.fieldName && (
                <div className="sd-row">
                  <span className="sd-label">Field</span>
                  <span className="sd-value">
                    <span className="sd-field-badge">
                      <i className="fas fa-seedling"></i>
                      {selectedPlan.fieldName}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            className="sd-detail-card sd-spray-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="sd-detail-card-header">
              <i className="fas fa-spray-can"></i>
              <h3>Pesticide Application Tracker</h3>
            </div>
            <div className="sd-detail-card-body sd-spray-body">
              <div className="sd-spray-counter">
                <div className="sd-spray-number">
                  {selectedPlan.sprayCount || 0}
                </div>
                <div className="sd-spray-label">Times Sprinkled</div>
              </div>
              <button
                className="sd-spray-btn"
                onClick={() => incrementSpray(selectedPlan.id)}
              >
                <i className="fas fa-plus"></i> Record Spray
              </button>
            </div>
          </motion.div>

          {selectedPlan.symptoms?.length > 0 && (
            <motion.div
              className="sd-detail-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="sd-detail-card-header">
                <i className="fas fa-stethoscope"></i>
                <h3>Symptoms</h3>
              </div>
              <div className="sd-detail-card-body">
                {renderList(selectedPlan.symptoms)}
              </div>
            </motion.div>
          )}

          {selectedPlan.treatment?.length > 0 && (
            <motion.div
              className="sd-detail-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <div className="sd-detail-card-header">
                <i className="fas fa-medkit"></i>
                <h3>Treatment</h3>
              </div>
              <div className="sd-detail-card-body">
                {renderList(selectedPlan.treatment)}
              </div>
            </motion.div>
          )}

          {selectedPlan.irrigationPlan && (
            <motion.div
              className="sd-detail-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="sd-detail-card-header">
                <i className="fas fa-tint"></i>
                <h3>Irrigation Plan</h3>
              </div>
              <div className="sd-detail-card-body">
                <div className="sd-row">
                  <span className="sd-label">💧 Frequency</span>
                  <span className="sd-value">
                    {selectedPlan.irrigationPlan.frequency}
                  </span>
                </div>
                <div className="sd-row">
                  <span className="sd-label">💧 Quantity</span>
                  <span className="sd-value">
                    {selectedPlan.irrigationPlan.quantity}
                  </span>
                </div>
                <div className="sd-row">
                  <span className="sd-label">🕐 Best Time</span>
                  <span className="sd-value">
                    {selectedPlan.irrigationPlan.bestTime}
                  </span>
                </div>
                <div className="sd-row">
                  <span className="sd-label">🔧 Method</span>
                  <span className="sd-value">
                    {selectedPlan.irrigationPlan.method}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {selectedPlan.pesticide && (
            <motion.div
              className="sd-detail-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <div className="sd-detail-card-header">
                <i className="fas fa-flask"></i>
                <h3>Pesticide Details</h3>
              </div>
              <div className="sd-detail-card-body">
                <div className="sd-row">
                  <span className="sd-label">🧪 Type</span>
                  <span className="sd-value">
                    {selectedPlan.pesticide.type}
                  </span>
                </div>
                <div className="sd-row">
                  <span className="sd-label">📏 Amount</span>
                  <span className="sd-value">
                    {selectedPlan.pesticide.amount}
                  </span>
                </div>
                <div className="sd-row">
                  <span className="sd-label">💉 Application</span>
                  <span className="sd-value">
                    {selectedPlan.pesticide.applicationMethod}
                  </span>
                </div>
                <div className="sd-row">
                  <span className="sd-label">📅 Frequency</span>
                  <span className="sd-value">
                    {selectedPlan.pesticide.frequency}
                  </span>
                </div>
                <div className="sd-row">
                  <span className="sd-label">⏳ Safety Period</span>
                  <span className="sd-value">
                    {selectedPlan.pesticide.safetyPeriod}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {selectedPlan.soilSuggestions && (
            <motion.div
              className="sd-detail-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="sd-detail-card-header">
                <i className="fas fa-leaf"></i>
                <h3>Soil Suggestions</h3>
              </div>
              <div className="sd-detail-card-body">
                <p className="sd-soil-text">{selectedPlan.soilSuggestions}</p>
              </div>
            </motion.div>
          )}

          {selectedPlan.sprinklerSchedule?.length > 0 && (
            <motion.div
              className="sd-detail-card sd-schedule-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <div className="sd-detail-card-header">
                <i className="fas fa-calendar-alt"></i>
                <h3>Sprinkler Schedule</h3>
              </div>
              <div className="sd-detail-card-body">
                <div className="sd-schedule-timeline">
                  {selectedPlan.sprinklerSchedule.map((item, i) => (
                    <div className="sd-schedule-item" key={i}>
                      <div className="sd-schedule-dot"></div>
                      <div className="sd-schedule-content">
                        <div className="sd-schedule-day">{item.day}</div>
                        <div className="sd-schedule-time">{item.time}</div>
                        <div className="sd-schedule-action">{item.action}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {selectedPlan.prevention?.length > 0 && (
            <motion.div
              className="sd-detail-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="sd-detail-card-header">
                <i className="fas fa-shield-alt"></i>
                <h3>Prevention</h3>
              </div>
              <div className="sd-detail-card-body">
                {renderList(selectedPlan.prevention)}
              </div>
            </motion.div>
          )}

          <motion.div
            className="sd-delete-section"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
          >
            <button
              className="sd-delete-btn"
              onClick={() => deletePlan(selectedPlan.id)}
            >
              <i className="fas fa-trash-alt"></i> Remove Plan
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // ========= TILES VIEW (DEFAULT) =========
  return (
    <div className="page-container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-header"
      >
        <div className="page-title">
          <i className="fas fa-tachometer-alt"></i>
          <h1>Sprinkler Dashboard</h1>
        </div>
        <p className="page-desc">
          View and manage your automated sprinkler plans created from disease
          detections
        </p>
      </motion.div>

      {loadingPlans ? (
        <div className="sd-empty">
          <i
            className="fas fa-spinner fa-spin"
            style={{ fontSize: "2rem", color: "var(--primary)" }}
          ></i>
          <p>Loading plans...</p>
        </div>
      ) : plans.length === 0 ? (
        <motion.div
          className="sd-empty"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="sd-empty-icon">
            <i className="fas fa-tachometer-alt"></i>
          </div>
          <h2>No Automated Plans Yet</h2>
          <p>
            Go to <strong>Disease Detection</strong>, analyze a plant, and click{" "}
            <strong>"Make this Automatic"</strong> to create your first
            automated sprinkler plan.
          </p>
        </motion.div>
      ) : (
        <div className="sd-tiles-grid">
          <AnimatePresence>
            {plans.map((plan, index) => (
              <motion.div
                key={plan.id}
                className="sd-tile"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.06 }}
                onClick={() => setSelectedPlan(plan)}
              >
                <div className="sd-tile-header">
                  <span
                    className={`severity-badge ${(plan.severity || "none").toLowerCase()}`}
                  >
                    {plan.severity}
                  </span>
                  <span className={`sd-status-dot ${plan.status}`}></span>
                </div>

                {plan.imageBase64 && (
                  <div className="sd-tile-image">
                    <img src={plan.imageBase64} alt="Plant" />
                  </div>
                )}

                <div className="sd-tile-body">
                  <h3 className="sd-tile-disease">{plan.diseaseName}</h3>
                  <p className="sd-tile-date">{formatDate(plan.createdAt)}</p>
                  {plan.fieldName && (
                    <span className="sd-field-badge" style={{ marginBottom: '0.5rem' }}>
                      <i className="fas fa-seedling"></i>
                      {plan.fieldName}
                    </span>
                  )}
                  <div className="sd-tile-stats">
                    <div className="sd-tile-stat">
                      <i className="fas fa-spray-can"></i>
                      <span>{plan.sprayCount || 0} sprays</span>
                    </div>
                    <div className="sd-tile-stat">
                      <i className="fas fa-tint"></i>
                      <span>{plan.irrigationPlan?.method || "N/A"}</span>
                    </div>
                  </div>
                </div>

                <div className="sd-tile-footer">
                  <span className="sd-tile-view">
                    View Details <i className="fas fa-chevron-right"></i>
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
