import { useState, useEffect, useRef } from "react";
import "./LanguageSelector.css";

const LANGUAGES = [
  { code: "en", name: "English", native: "English" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "or", name: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "as", name: "Assamese", native: "অসমীয়া" },
  { code: "mai", name: "Maithili", native: "मैथिली" },
  { code: "sa", name: "Sanskrit", native: "संस्कृतम्" },
  { code: "sd", name: "Sindhi", native: "سنڌي" },
  { code: "ur", name: "Urdu", native: "اردو" },
  { code: "ne", name: "Nepali", native: "नेपाली" },
  { code: "ks", name: "Kashmiri", native: "کٲشُر" },
];

function getStoredLang() {
  return localStorage.getItem("krishimitra_lang") || "en";
}

function translatePage(langCode) {
  localStorage.setItem("krishimitra_lang", langCode);

  if (langCode === "en") {
    // Remove any existing Google Translate frame
    const frame = document.querySelector(".goog-te-banner-frame");
    if (frame) frame.style.display = "none";

    // Try to restore original
    const combo = document.querySelector(".goog-te-combo");
    if (combo) {
      combo.value = "en";
      combo.dispatchEvent(new Event("change"));
    }

    // Fallback: reload page to clear translation artifacts
    if (document.querySelector(".translated-ltr, .translated-rtl")) {
      window.location.reload();
    }
    return;
  }

  // Use Google Translate widget
  const check = () => {
    const combo = document.querySelector(".goog-te-combo");
    if (combo) {
      combo.value = langCode;
      combo.dispatchEvent(new Event("change"));
    } else {
      setTimeout(check, 300);
    }
  };
  check();
}

// Inject Google Translate script once
function injectGoogleTranslate() {
  if (document.getElementById("google-translate-script")) return;

  // Add the hidden element
  const div = document.createElement("div");
  div.id = "google_translate_element";
  div.style.display = "none";
  document.body.appendChild(div);

  // Define the callback
  window.googleTranslateElementInit = () => {
    new window.google.translate.TranslateElement(
      {
        pageLanguage: "en",
        includedLanguages: LANGUAGES.map((l) => l.code).join(","),
        layout: 0, // SIMPLE
        autoDisplay: false,
      },
      "google_translate_element"
    );

    // Auto-apply stored language after init
    const stored = getStoredLang();
    if (stored !== "en") {
      setTimeout(() => translatePage(stored), 1000);
    }
  };

  const script = document.createElement("script");
  script.id = "google-translate-script";
  script.src =
    "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  document.body.appendChild(script);
}

// ─── Floating version (for Landing page) ───
export function FloatingLanguageButton() {
  const [open, setOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState(getStoredLang());
  const menuRef = useRef(null);

  useEffect(() => {
    injectGoogleTranslate();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = (code) => {
    setCurrentLang(code);
    translatePage(code);
    setOpen(false);
  };

  const activeLang = LANGUAGES.find((l) => l.code === currentLang);

  return (
    <div className="lang-floating notranslate" ref={menuRef} translate="no">
      {open && (
        <div className="lang-floating-menu">
          <div className="lang-floating-menu-header">
            <i className="fas fa-language"></i>
            <span>Select Language</span>
          </div>
          <div className="lang-floating-menu-list">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                className={`lang-floating-item${currentLang === lang.code ? " active" : ""}`}
                onClick={() => handleSelect(lang.code)}
              >
                <span className="lang-native">{lang.native}</span>
                <span className="lang-english">{lang.name}</span>
                {currentLang === lang.code && (
                  <i className="fas fa-check"></i>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        className="lang-floating-btn"
        onClick={() => setOpen(!open)}
        aria-label="Change language"
        title="Change language"
      >
        <i className="fas fa-language"></i>
        <span className="lang-floating-btn-label">
          {activeLang?.native || "EN"}
        </span>
      </button>
    </div>
  );
}

// ─── Header version (for Landing page header) ───
export function HeaderLanguageButton() {
  const [open, setOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState(getStoredLang());
  const menuRef = useRef(null);

  useEffect(() => {
    injectGoogleTranslate();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = (code) => {
    setCurrentLang(code);
    translatePage(code);
    setOpen(false);
  };

  const activeLang = LANGUAGES.find((l) => l.code === currentLang);

  return (
    <div className="lang-header notranslate" ref={menuRef} translate="no">
      <button
        className="lang-header-btn"
        onClick={() => setOpen(!open)}
        aria-label="Change language"
        title="Change language"
      >
        <i className="fas fa-language"></i>
        <span className="lang-header-label">{activeLang?.native || "EN"}</span>
        <i className={`fas fa-chevron-${open ? "up" : "down"} lang-header-arrow`}></i>
      </button>
      {open && (
        <div className="lang-header-menu">
          <div className="lang-header-menu-title">
            <i className="fas fa-language"></i>
            <span>Select Language</span>
          </div>
          <div className="lang-header-menu-list">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                className={`lang-header-item${currentLang === lang.code ? " active" : ""}`}
                onClick={() => handleSelect(lang.code)}
              >
                <span className="lang-native">{lang.native}</span>
                <span className="lang-english">{lang.name}</span>
                {currentLang === lang.code && (
                  <i className="fas fa-check"></i>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard Floating version (top-right, synced with profile) ───
export function DashboardFloatingLanguageButton() {
  const [open, setOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState(getStoredLang());
  const menuRef = useRef(null);

  useEffect(() => {
    injectGoogleTranslate();
  }, []);

  // Sync with localStorage changes (e.g. from Profile inline selector)
  useEffect(() => {
    const syncLang = () => {
      const stored = getStoredLang();
      if (stored !== currentLang) {
        setCurrentLang(stored);
      }
    };
    window.addEventListener("storage", syncLang);
    // Also poll for same-tab changes (storage event doesn't fire for same tab)
    const interval = setInterval(syncLang, 1000);
    return () => {
      window.removeEventListener("storage", syncLang);
      clearInterval(interval);
    };
  }, [currentLang]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = (code) => {
    setCurrentLang(code);
    translatePage(code);
    setOpen(false);
  };

  const activeLang = LANGUAGES.find((l) => l.code === currentLang);

  return (
    <div className="lang-dashboard-float notranslate" ref={menuRef} translate="no">
      <button
        className="lang-dashboard-float-btn"
        onClick={() => setOpen(!open)}
        aria-label="Change language"
        title="Change language"
      >
        <i className="fas fa-language"></i>
        <span className="lang-dashboard-float-label">{activeLang?.native || "EN"}</span>
      </button>
      {open && (
        <div className="lang-dashboard-float-menu">
          <div className="lang-floating-menu-header">
            <i className="fas fa-language"></i>
            <span>Select Language</span>
          </div>
          <div className="lang-floating-menu-list">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                className={`lang-floating-item${currentLang === lang.code ? " active" : ""}`}
                onClick={() => handleSelect(lang.code)}
              >
                <span className="lang-native">{lang.native}</span>
                <span className="lang-english">{lang.name}</span>
                {currentLang === lang.code && (
                  <i className="fas fa-check"></i>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inline version (for Profile / Dashboard) ───
export function LanguageSelectorInline() {
  const [currentLang, setCurrentLang] = useState(getStoredLang());
  const [search, setSearch] = useState("");

  useEffect(() => {
    injectGoogleTranslate();
  }, []);

  const handleSelect = (code) => {
    setCurrentLang(code);
    translatePage(code);
  };

  const filtered = LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.native.includes(search)
  );

  return (
    <div className="lang-inline notranslate" translate="no">
      <h3>
        <i className="fas fa-language"></i> Language / भाषा
      </h3>
      <p className="lang-inline-desc">
        Translate the entire website into your preferred language
      </p>
      <div className="lang-inline-search">
        <i className="fas fa-search"></i>
        <input
          type="text"
          placeholder="Search language..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="lang-inline-grid">
        {filtered.map((lang) => (
          <button
            key={lang.code}
            className={`lang-inline-item${currentLang === lang.code ? " active" : ""}`}
            onClick={() => handleSelect(lang.code)}
          >
            <span className="lang-native">{lang.native}</span>
            <span className="lang-english">{lang.name}</span>
            {currentLang === lang.code && (
              <i className="fas fa-check-circle"></i>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
