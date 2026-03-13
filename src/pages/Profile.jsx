import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useBlockchain } from "../context/BlockchainContext";
import "./Profile.css";

// ─── Push Notification Helpers ───

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeToPush(user) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push notifications are not supported in this browser.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission denied.");
  }

  const registration = await navigator.serviceWorker.ready;

  // Check for existing subscription
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  // Save subscription to backend
  const subJson = subscription.toJSON();
  const res = await fetch("/api/save-subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: subJson,
      userId: user?.dbId || null,
      userEmail: user?.email || null,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save subscription");
  }

  return subscription;
}

async function sendTestNotification(user, subscription) {
  const res = await fetch("/api/send-notification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: user?.dbId || null,
      userEmail: user?.email || null,
      endpoint: subscription?.endpoint || null,
      title: "🌾 KrishiMitra AI",
      body: "Hey! This is a test notification. Push notifications are working on your device! 🚜🌱",
      url: "/dashboard/profile",
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to send notification");
  return data;
}

// ─── Profile Component ───

export default function Profile() {
  const { user, updateUser, logout, hasDevice, toggleDevice } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const blockchain = useBlockchain();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || "",
    location: user?.location || "",
    email: user?.email || "",
  });

  const [detectingLocation, setDetectingLocation] = useState(false);

  // Push notification state
  const [notifStatus, setNotifStatus] = useState("idle"); // idle | subscribing | sending | sent | error
  const [notifMessage, setNotifMessage] = useState("");
  const [pushSupported, setPushSupported] = useState(true);

  useEffect(() => {
    // Check if push is supported
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushSupported(false);
    }
  }, []);

  // Auto-detect location on mount if not already set
  useEffect(() => {
    if (!user?.location && navigator.geolocation) {
      setDetectingLocation(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
              { headers: { "User-Agent": "krishimitraai/2.0" } },
            );
            const data = await res.json();
            const city =
              data.address?.city ||
              data.address?.town ||
              data.address?.village ||
              data.address?.county ||
              "";
            const state = data.address?.state || "";
            const loc = [city, state].filter(Boolean).join(", ");
            if (loc) {
              setForm((prev) => ({ ...prev, location: loc }));
              updateUser({ location: loc });
            }
          } catch (e) {
            console.error("Reverse geocode failed:", e);
          } finally {
            setDetectingLocation(false);
          }
        },
        () => setDetectingLocation(false),
        { timeout: 8000 },
      );
    }
  }, []);

  const handleSave = () => {
    updateUser(form);
    setEditing(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleSendNotification = async () => {
    setNotifStatus("subscribing");
    setNotifMessage("Requesting permission & subscribing...");

    try {
      // Step 1: Subscribe to push (will ask permission if needed)
      const subscription = await subscribeToPush(user);
      setNotifStatus("sending");
      setNotifMessage("Sending test notification...");

      // Step 2: Send the actual notification via backend
      const result = await sendTestNotification(user, subscription);
      setNotifStatus("sent");
      setNotifMessage(
        `✅ Notification sent to ${result.sent} device(s)! Check your notification tray.`
      );

      // Reset status after 5 seconds
      setTimeout(() => {
        setNotifStatus("idle");
        setNotifMessage("");
      }, 5000);
    } catch (err) {
      console.error("Notification error:", err);
      setNotifStatus("error");
      setNotifMessage(`❌ ${err.message}`);

      setTimeout(() => {
        setNotifStatus("idle");
        setNotifMessage("");
      }, 5000);
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
          <i className="fas fa-user-circle"></i>
          <h1>Profile</h1>
        </div>
        <p className="page-desc">Manage your account and preferences</p>
      </motion.div>

      <motion.div
        className="profile-card card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="profile-avatar">
          {user?.picture ? (
            <img src={user.picture} alt={user.name} />
          ) : (
            <div className="avatar-placeholder">
              <i className="fas fa-user"></i>
            </div>
          )}
        </div>

        {editing ? (
          <div className="profile-edit">
            <div className="form-group">
              <label>Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Location</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={!!user?.token}
              />
            </div>
            <div className="profile-actions">
              <button className="btn-primary" onClick={handleSave}>
                <i className="fas fa-save"></i> Save
              </button>
              <button className="btn-outline" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="profile-info">
            <h2>{user?.name || "Guest"}</h2>
            <p className="profile-email">{user?.email || "No email"}</p>
            <p className="profile-location">
              <i className="fas fa-map-marker-alt"></i>{" "}
              {detectingLocation
                ? "Detecting location..."
                : user?.location || "Location not set"}
            </p>
            <button className="btn-outline" onClick={() => setEditing(true)}>
              <i className="fas fa-edit"></i> Edit Profile
            </button>
          </div>
        )}
      </motion.div>

      {/* ─── Your Data Section ─── */}
      {blockchain?.walletAddress && (
        <motion.div
          className="settings-card card wallet-premium-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="wallet-card-header">
            <h3>
              <i className="fas fa-database"></i> Your Data Access
            </h3>
            <div className="blockchain-secured-badge">
              <i className="fas fa-shield-alt"></i> Encrypted
            </div>
          </div>
          
          <div className="blockchain-wallet-info">
            <div className="wallet-row wallet-address-row">
              <span className="wallet-label">Decryption Key (Wallet)</span>
              <span className="wallet-value wallet-address">{blockchain.walletAddress}</span>
            </div>
            
            <div className="wallet-stats-grid">
              <div className="wallet-stat-box">
                <span className="wallet-label">$KRISHI Balance</span>
                <span className="wallet-value token-balance">
                  <i className="fas fa-coins" style={{ color: "#ffd700" }}></i> {blockchain.tokenBalance.toFixed(0)}
                </span>
              </div>
              <div className="wallet-stat-box">
                <span className="wallet-label">Encrypted Records</span>
                <span className="wallet-value">
                  <i className="fas fa-file-contract" style={{ color: "#3b82f6" }}></i> {blockchain.recordCount}
                </span>
              </div>
            </div>
          </div>
          
          <Link to="/dashboard/blockchain" className="btn-primary wallet-dashboard-link">
            <i className="fas fa-chart-line"></i> Go to Your Data
          </Link>
        </motion.div>
      )}

      <motion.div
        className="settings-card card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3>Settings</h3>
        <div className="setting-item">
          <div>
            <strong>IoT Device Connected</strong>
            <p>Toggle if you have a KrishiMitra sensor device</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={hasDevice}
              onChange={(e) => toggleDevice(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        <div className="setting-item">
          <div>
            <strong>{isDark ? "Dark Mode" : "Light Mode"}</strong>
            <p>Switch between dark and light appearance</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={isDark}
              onChange={toggleTheme}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </motion.div>

      {/* ─── Push Notification Test Section ─── */}
      <motion.div
        className="settings-card card notification-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <h3>
          <i className="fas fa-bell"></i> Push Notifications
        </h3>
        <p className="notif-desc">
          Test browser push notifications. They work even when the site is
          closed — on both desktop and mobile!
        </p>

        {!pushSupported ? (
          <div className="notif-unsupported">
            <i className="fas fa-exclamation-triangle"></i>
            <span>Push notifications are not supported in this browser.</span>
          </div>
        ) : (
          <>
            <button
              className="notif-send-btn"
              onClick={handleSendNotification}
              disabled={notifStatus === "subscribing" || notifStatus === "sending"}
            >
              {notifStatus === "subscribing" || notifStatus === "sending" ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  {notifStatus === "subscribing"
                    ? "Subscribing..."
                    : "Sending..."}
                </>
              ) : (
                <>
                  <i className="fas fa-paper-plane"></i>
                  Send Notification
                </>
              )}
            </button>

            {notifMessage && (
              <motion.p
                className={`notif-feedback ${notifStatus === "error" ? "notif-error" : notifStatus === "sent" ? "notif-success" : ""}`}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {notifMessage}
              </motion.p>
            )}
          </>
        )}
      </motion.div>

      <motion.div
        className="profile-bottom-actions"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Link to="/" className="home-btn-full">
          <i className="fas fa-home"></i> Go to Home
        </Link>
        <button className="logout-btn-full" onClick={handleLogout}>
          <i className="fas fa-sign-out-alt"></i> Logout
        </button>
      </motion.div>
    </div>
  );
}
