import { useAuth } from "../context/AuthContext";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "../assets/krishimitra.png";
import "./LoginModal.css";

const GOOGLE_CLIENT_ID =
  "618760627892-3sigk02k7pphk907pnc475j2fr0au0h1.apps.googleusercontent.com";

export default function LoginModal({ onClose }) {
  const { login, loginAsGuest } = useAuth();
  const [loading, setLoading] = useState(false);
  const googleBtnRef = useRef(null);

  useEffect(() => {
    // Wait for the Google Identity Services script to load, then render the button
    const initGoogleBtn = () => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
        });
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: 360,
        });
      }
    };

    // If GIS is already loaded, render immediately; otherwise poll for it
    if (window.google?.accounts?.id) {
      initGoogleBtn();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          initGoogleBtn();
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, []);

  const handleCredentialResponse = (response) => {
    try {
      setLoading(true);
      const payload = JSON.parse(atob(response.credential.split(".")[1]));
      login({
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
        token: response.credential,
      });
      onClose?.();
    } catch (e) {
      console.error("Sign-in failed", e);
      setLoading(false);
    }
  };

  const handleGuest = () => {
    loginAsGuest();
    onClose?.();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="login-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="login-card"
          initial={{ opacity: 0, scale: 0.85, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 40 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="login-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times"></i>
          </button>

          <img src={logo} alt="KrishiMitra" className="login-logo" />
          <h2>Welcome to KrishiMitra AI</h2>
          <p className="login-tagline">Login to Access Your Farm Dashboard</p>

          {/* Google renders its own button here */}
          <div className="google-signin-wrapper" ref={googleBtnRef}></div>
          {loading && <p className="signing-in-text">Signing in...</p>}

          <div className="login-divider">
            <span>or</span>
          </div>

          <button className="guest-btn" onClick={handleGuest}>
            <i className="fas fa-user-secret"></i>
            <span>Continue as Guest</span>
          </button>

          <p className="login-note">
            Guest mode has limited access to features
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
