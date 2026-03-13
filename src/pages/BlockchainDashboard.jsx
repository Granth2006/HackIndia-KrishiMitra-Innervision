import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useBlockchain } from "../context/BlockchainContext";
import {
  getTokenTransactions,
  getBlockchainStats,
} from "../lib/blockchain";
import jsPDF from "jspdf";
import { applyPlugin } from "jspdf-autotable";
import "./BlockchainDashboard.css";

applyPlugin(jsPDF);

const RECORD_ICONS = {
  disease_scan: "fa-virus",
  crop_recommendation: "fa-seedling",
  chat: "fa-robot",
  weather: "fa-cloud-sun",
  marketplace: "fa-store",
  field: "fa-map-marked-alt",
  profile: "fa-user",
};

const REASON_LABELS = {
  disease_scan: "Disease Detection",
  crop_recommendation: "Crop Recommendation",
  chat_interaction: "AI Chat",
  weather_check: "Weather Check",
  marketplace_listing: "Marketplace Listing",
  field_created: "Field Created",
  premium_unlock: "Premium Feature",
};

const EARN_OPPORTUNITIES = [
  { action: "Detect a crop disease", tokens: 10, icon: "fa-virus", color: "#e74c3c" },
  { action: "Get crop recommendations", tokens: 5, icon: "fa-seedling", color: "#2ecc71" },
  { action: "Chat with AI assistant", tokens: 2, icon: "fa-robot", color: "#3498db" },
  { action: "Check weather data", tokens: 3, icon: "fa-cloud-sun", color: "#f39c12" },
  { action: "List on marketplace", tokens: 15, icon: "fa-store", color: "#9b59b6" },
  { action: "Add a new field", tokens: 20, icon: "fa-map-marked-alt", color: "#1abc9c" },
];

export default function BlockchainDashboard() {
  const { user } = useAuth();
  const blockchain = useBlockchain();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadData = async () => {
    setDownloading(true);
    try {
      const { supabase } = await import("../lib/supabase");
      
      const { data: userRecord } = await supabase.from("users").select("*").eq("id", user.dbId).single();
      const { data: services } = await supabase.from("service_logs").select("*").eq("user_id", user.dbId);
      const { data: fields } = await supabase.from("user_fields").select("*").eq("user_id", user.dbId);
      const { data: plans } = await supabase.from("sprinkler_plans").select("*").eq("user_id", user.dbId);
      const { data: chats } = await supabase.from("chat_messages").select("*").eq("user_id", user.dbId);
      const { data: bcRecords } = await supabase.from("blockchain_records").select("*").eq("user_id", user.dbId);
      const { data: txs } = await supabase.from("token_transactions").select("*").eq("user_id", user.dbId);

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFillColor(0, 166, 118);
      doc.rect(0, 0, pageWidth, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("KrishiMitra AI - Immutable User Data Report", pageWidth / 2, 14, { align: "center" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Full Account Export", pageWidth / 2, 21, { align: "center" });

      let currentY = 35;
      
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Profile Information", 14, currentY);
      currentY += 8;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Name: ${userRecord?.name || "N/A"}`, 14, currentY);
      currentY += 6;
      doc.text(`Email: ${userRecord?.email || "N/A"}`, 14, currentY);
      currentY += 6;
      doc.text(`Location: ${userRecord?.location || "N/A"}`, 14, currentY);
      currentY += 6;
      doc.text(`Wallet Address: ${blockchain?.walletAddress || "N/A"}`, 14, currentY);
      currentY += 10;

      // Token Transactions
      if (txs && txs.length > 0) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Token Transactions ($KRISHI)", 14, currentY);
        currentY += 5;
        
        const txData = txs.map(t => [
          new Date(t.created_at).toLocaleDateString(),
          REASON_LABELS[t.reason] || t.reason,
          t.amount > 0 ? `+${t.amount}` : String(t.amount)
        ]);
        
        doc.autoTable({
          startY: currentY,
          head: [["Date", "Reason", "Amount"]],
          body: txData,
          theme: "grid",
          headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255] },
          styles: { fontSize: 9 }
        });
        currentY = doc.lastAutoTable.finalY + 10;
      }

      // Action Logs
      if (services && services.length > 0) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("AI Service Logs", 14, currentY);
        currentY += 5;
        
        const serviceData = services.map(s => [
          new Date(s.created_at).toLocaleDateString(),
          s.service,
          "Completed"
        ]);
        
        doc.autoTable({
          startY: currentY,
          head: [["Date", "Service Type", "Status"]],
          body: serviceData,
          theme: "grid",
          headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255] },
          styles: { fontSize: 9 }
        });
        currentY = doc.lastAutoTable.finalY + 10;
      }

      // Automated Sprinklers
      if (plans && plans.length > 0) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Automated Sprinkler Plans", 14, currentY);
        currentY += 5;
        
        const planData = plans.map(p => [
          p.field_name || "N/A",
          p.disease_name || "N/A",
          p.status || "Active"
        ]);
        
        doc.autoTable({
          startY: currentY,
          head: [["Field Name", "Disease Analyzed", "Status"]],
          body: planData,
          theme: "grid",
          headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255] },
          styles: { fontSize: 9 }
        });
        currentY = doc.lastAutoTable.finalY + 10;
      }

      // Generate Footer
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Generated on ${new Date().toLocaleDateString()} | KrishiMitra Platform | Page ${i} of ${totalPages}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" }
        );
      }

      doc.save(`KrishiMitra_Data_${new Date().getTime()}.pdf`);
    } catch (err) {
      console.error("Error downloading data:", err);
      alert("Failed to download your data. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (!user?.dbId) return;
    const fetchData = async () => {
      setLoading(true);
      const [txRes, statsRes] = await Promise.all([
        getTokenTransactions(user.dbId),
        getBlockchainStats(user.dbId),
      ]);
      setTransactions(txRes.transactions || []);
      setStats(statsRes);
      setLoading(false);
    };
    fetchData();
  }, [user?.dbId]);

  if (loading) {
    return (
      <div className="page-container blockchain-page">
        <div className="blockchain-loading">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Loading your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container blockchain-page">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-header"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="page-title" style={{ margin: 0 }}>
            <i className="fas fa-database"></i>
            <h1>Your Data</h1>
          </div>
          <button 
            className="btn-primary" 
            onClick={handleDownloadData}
            disabled={downloading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.2rem', borderRadius: '12px', border: 'none', background: 'var(--primary)', color: 'white', cursor: downloading ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: downloading ? 0.7 : 1 }}
          >
            {downloading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-download"></i>}
            {downloading ? "Downloading..." : "Download your data"}
          </button>
        </div>
        <p className="page-desc">
          Manage your secured access and tokenize your interactions. 
        </p>
      </motion.div>

      {/* ── Wallet Overview Cards ── */}
      <div className="bc-overview-grid">
        <motion.div
          className="bc-card bc-wallet-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="bc-card-icon wallet-icon">
            <i className="fas fa-wallet"></i>
          </div>
          <div className="bc-card-info">
            <span className="bc-card-label">Wallet Address</span>
            <span className="bc-card-value bc-address">
              {blockchain?.walletAddress || "—"}
            </span>
          </div>
        </motion.div>

        <motion.div
          className="bc-card bc-token-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="bc-card-icon token-icon">
            <i className="fas fa-coins"></i>
          </div>
          <div className="bc-card-info">
            <span className="bc-card-label">$KRISHI Balance</span>
            <span className="bc-card-value bc-balance">
              {blockchain?.tokenBalance?.toFixed(0) || "0"}
            </span>
          </div>
        </motion.div>

      </div>

      {/* ── Token Economy Section ── */}
        <motion.div
          className="bc-section"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {/* Stats Grid */}
          {stats && (
            <div className="bc-stats-grid">
              <div className="bc-stat-card">
                <div className="bc-stat-icon" style={{ background: "linear-gradient(135deg, #ffd700, #ff8c00)" }}>
                  <i className="fas fa-arrow-up"></i>
                </div>
                <div className="bc-stat-info">
                  <span className="bc-stat-value">{stats.totalEarned?.toFixed(0) || 0}</span>
                  <span className="bc-stat-label">Total Earned</span>
                </div>
              </div>
              <div className="bc-stat-card">
                <div className="bc-stat-icon" style={{ background: "linear-gradient(135deg, #e74c3c, #c0392b)" }}>
                  <i className="fas fa-arrow-down"></i>
                </div>
                <div className="bc-stat-info">
                  <span className="bc-stat-value">{stats.totalSpent?.toFixed(0) || 0}</span>
                  <span className="bc-stat-label">Total Spent</span>
                </div>
              </div>
              <div className="bc-stat-card">
                <div className="bc-stat-icon" style={{ background: "linear-gradient(135deg, #3498db, #2980b9)" }}>
                  <i className="fas fa-exchange-alt"></i>
                </div>
                <div className="bc-stat-info">
                  <span className="bc-stat-value">{stats.totalTransactions || 0}</span>
                  <span className="bc-stat-label">Transactions</span>
                </div>
              </div>
            </div>
          )}

          {/* Earn Opportunities */}
          <h2 className="bc-section-title">
            <i className="fas fa-star"></i> How to Earn $KRISHI
          </h2>
          <div className="bc-earn-grid">
            {EARN_OPPORTUNITIES.map((opp, i) => (
              <motion.div
                key={i}
                className="bc-earn-card"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="bc-earn-icon" style={{ background: opp.color }}>
                  <i className={`fas ${opp.icon}`}></i>
                </div>
                <span className="bc-earn-action">{opp.action}</span>
                <span className="bc-earn-amount">+{opp.tokens} $KRISHI</span>
              </motion.div>
            ))}
          </div>

          {/* Transaction History */}
          <h2 className="bc-section-title">
            <i className="fas fa-history"></i> Token Activity
          </h2>
          {transactions.length === 0 ? (
            <div className="bc-empty">
              <i className="fas fa-coins"></i>
              <p>No token transactions yet. Use KrishiMitra services to earn $KRISHI tokens!</p>
            </div>
          ) : (
            <div className="bc-tx-list">
              {transactions.map((tx) => (
                <div key={tx.id} className={`bc-tx-item ${tx.amount < 0 ? "bc-tx-spend" : ""}`}>
                  <div className="bc-tx-icon">
                    <i className={`fas ${RECORD_ICONS[tx.reason] || "fa-exchange-alt"}`}></i>
                  </div>
                  <div className="bc-tx-info">
                    <span className="bc-tx-reason">
                      {REASON_LABELS[tx.reason] || tx.reason}
                    </span>
                    <span className="bc-tx-hash" title={tx.tx_hash}>
                      tx: {tx.tx_hash?.substring(0, 16)}...
                    </span>
                  </div>
                  <div className={`bc-tx-amount ${tx.amount < 0 ? "bc-tx-negative" : ""}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount}
                  </div>
                  <div className="bc-tx-time">
                    {new Date(tx.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
        
        {/* ── Architecture Banner ── */}
      <motion.div
        className="bc-arch-banner"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="bc-arch-flow">
          <div className="bc-arch-step">
            <div className="bc-arch-step-icon"><i className="fas fa-lock"></i></div>
            <span>AES-256 Encrypt</span>
          </div>
          <i className="fas fa-chevron-right bc-arch-arrow"></i>
          <div className="bc-arch-step">
            <div className="bc-arch-step-icon"><i className="fas fa-database"></i></div>
            <span>IPFS CID</span>
          </div>
          <i className="fas fa-chevron-right bc-arch-arrow"></i>
          <div className="bc-arch-step">
            <div className="bc-arch-step-icon"><i className="fas fa-file-contract"></i></div>
            <span>Smart Contract</span>
          </div>
          <i className="fas fa-chevron-right bc-arch-arrow"></i>
          <div className="bc-arch-step">
            <div className="bc-arch-step-icon"><i className="fas fa-link"></i></div>
            <span>On-Chain</span>
          </div>
        </div>
        <p className="bc-arch-label">Your data flow: encrypted → content-addressed → immutably recorded</p>
      </motion.div>
    </div>
  );
}
