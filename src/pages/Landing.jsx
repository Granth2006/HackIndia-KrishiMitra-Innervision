import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import LoginModal from "../components/LoginModal";
import { HeaderLanguageButton } from "../components/LanguageSelector";
import logo from "../assets/krishimitra.png";
import "./Landing.css";

const developers = [
  {
    name: "Granth Kumar",
    initials: "GK",
    email: "granthkumar2006@gmail.com",
    linkedin: "https://www.linkedin.com/in/granth-kumar",
    color: "#00a676",
  },
  {
    name: "Yash Sharma",
    initials: "YS",
    email: "yashsharma@gmail.com",
    linkedin: "https://www.linkedin.com/in/yash-sharma",
    color: "#00b4d8",
  },
  {
    name: "Shreeya Nayak",
    initials: "SN",
    email: "shreeyanayak@gmail.com",
    linkedin: "https://www.linkedin.com/in/shreeya-nayak",
    color: "#8b5cf6",
  },
];

const mentors = [
  {
    name: "Ms. Shallu Hassija",
    initials: "SH",
    email: "shallu.hassija@example.com",
    linkedin: "https://www.linkedin.com/in/shallu-hassija",
    color: "#f59e0b",
  },
  {
    name: "Ms. Sunita Deshwal",
    initials: "SD",
    email: "sunita.deshwal@example.com",
    linkedin: "https://www.linkedin.com/in/sunita-deshwal",
    color: "#ec4899",
  },
  {
    name: "Dr. Stuti Saxena",
    initials: "SS",
    email: "stuti.saxena@example.com",
    linkedin: "https://www.linkedin.com/in/stuti-saxena",
    color: "#06b6d4",
  },
];

const features = [
  {
    icon: "fa-tint",
    title: "Auto Sprinkler",
    desc: "AI-powered irrigation scheduling based on plant health analysis",
    primary: true,
  },
  {
    icon: "fa-virus",
    title: "Disease Detection",
    desc: "Upload plant photos for instant disease diagnosis and treatment",
  },
  {
    icon: "fa-seedling",
    title: "Crop Advisor",
    desc: "Get personalized crop suggestions based on soil and weather",
  },
  {
    icon: "fa-robot",
    title: "AI Chatbot",
    desc: "Chat with our farming expert AI assistant anytime",
  },
  {
    icon: "fa-cloud-sun",
    title: "Weather Insights",
    desc: "Real-time weather forecasts tailored for farming",
  },
  {
    icon: "fa-store",
    title: "Marketplace",
    desc: "Buy and sell agricultural products directly",
  },
];

const faqs = [
  {
    q: "How does the Automatic Sprinkler work?",
    a: "Upload a photo of your plant. Our AI detects diseases and recommends optimal watering schedules, pesticide types, and application methods.",
  },
  {
    q: "Is KrishiMitra free to use?",
    a: "Yes! KrishiMitra AI is completely free for all Indian farmers. Just sign in with Google to access all features.",
  },
  {
    q: "Do I need an IoT device?",
    a: "No hardware required. The AI works with just a photo from your phone camera.",
  },
  {
    q: "Which languages are supported?",
    a: "We support 18 Indian languages through Google Translate integration.",
  },
  {
    q: "How accurate is the disease detection?",
    a: "Our AI is powered by Google Gemini and provides reliable results. Always confirm with local agricultural experts for critical decisions.",
  },
];

const testimonials = [
  {
    name: "Rajesh Patel",
    location: "Gujarat",
    avatar: "RP",
    text: "KrishiMitra detected blight on my tomato crop 3 days before I could see it. Saved my entire harvest worth ₹2 lakhs!",
    rating: 5,
  },
  {
    name: "Sunita Deshwal",
    location: "Haryana",
    avatar: "SD",
    text: "The automatic sprinkler scheduling reduced my water usage by 40%. My fields are greener than ever with less effort.",
    rating: 5,
  },
  {
    name: "Arun Kumar",
    location: "Maharashtra",
    avatar: "AK",
    text: "Being able to use it in Marathi makes all the difference. Finally, an AI tool that speaks my language!",
    rating: 5,
  },
  {
    name: "Priya Sharma",
    location: "Punjab",
    avatar: "PS",
    text: "The crop advisor feature suggested I switch to mustard this season. My yield increased by 30%!",
    rating: 4,
  },
];

/* Animated counter hook */
function AnimatedCounter({ target, suffix = "", duration = 2000 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, target, duration]);

  return (
    <span ref={ref}>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  const handleGetStarted = () => {
    if (user) {
      navigate("/dashboard/sprinkler");
    } else {
      setShowLogin(true);
    }
  };

  const scrollToSection = (e, sectionId) => {
    e.preventDefault();
    setMobileMenu(false);
    if (sectionId === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      document
        .getElementById(sectionId)
        ?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <div className="landing">
      {/* Header */}
      <header className="landing-header">
        <div className="header-inner">
          <Link to="/" className="header-brand">
            <img src={logo} alt="KrishiMitra" />
            <span>KrishiMitra AI</span>
          </Link>

          <nav className={`header-nav${mobileMenu ? " open" : ""}`}>
            <button
              className="mobile-dashboard-btn"
              onClick={() => {
                setMobileMenu(false);
                handleGetStarted();
              }}
            >
              <i className={`fas ${user ? "fa-th-large" : "fa-rocket"}`}></i>
              {user ? "Go to Dashboard" : "Get Started Free"}
            </button>
            <a href="/" onClick={(e) => scrollToSection(e, "top")}>
              Home
            </a>
            <a href="/" onClick={(e) => scrollToSection(e, "about")}>
              About
            </a>
            <a href="/" onClick={(e) => scrollToSection(e, "features")}>
              Features
            </a>
            <a href="/" onClick={(e) => scrollToSection(e, "demo")}>
              Demo
            </a>
            <a href="/" onClick={(e) => scrollToSection(e, "faq")}>
              FAQ
            </a>
            <a href="/" onClick={(e) => scrollToSection(e, "contact")}>
              Contact
            </a>
          </nav>

          <div className="header-actions">
            <HeaderLanguageButton />
            <button className="btn-primary dashboard-btn" onClick={handleGetStarted}>
              {user ? "Dashboard" : "Get Started"}
            </button>
            <button
              className="hamburger"
              onClick={() => setMobileMenu(!mobileMenu)}
              aria-label="Menu"
            >
              <i className={`fas ${mobileMenu ? "fa-times" : "fa-bars"}`}></i>
            </button>
          </div>
        </div>
      </header>

      {/* Hero — Split Layout with Farmer Image */}
      <section className="hero">
        <div className="hero-bg"></div>
        {/* Decorative background shapes */}
        <div className="hero-shape hero-shape-1"></div>
        <div className="hero-shape hero-shape-2"></div>
        <div className="hero-shape hero-shape-3"></div>

        <div className="hero-split">
          <motion.div
            className="hero-content"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="hero-badge">🌾 AI-Powered Smart Farming</span>
            <h1>
              Revolutionize Your Farm with{" "}
              <span className="highlight">AI-Powered Irrigation</span>
            </h1>
            <p>
              Detect plant diseases, get watering schedules, pesticide
              recommendations, and expert farming tips — all from a single
              photo.
            </p>
            <div className="hero-actions">
              <button className="btn-primary btn-lg" onClick={handleGetStarted}>
                <i className="fas fa-rocket"></i> Get Started Free
              </button>
              <a
                href="/"
                className="btn-outline btn-lg"
                onClick={(e) => scrollToSection(e, "features")}
              >
                <i className="fas fa-play-circle"></i> See Features
              </a>
            </div>
            <div className="hero-stats">
              <div>
                <strong>
                  <AnimatedCounter target={10} suffix="K+" />
                </strong>
                <span>Farmers</span>
              </div>
              <div>
                <strong>
                  <AnimatedCounter target={50} suffix="K+" />
                </strong>
                <span>Scans</span>
              </div>
              <div>
                <strong>
                  <AnimatedCounter target={18} suffix="" />
                </strong>
                <span>Languages</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="hero-image"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <div className="hero-image-glow"></div>
            <img src="/farmer-hero.png" alt="Farmer using KrishiMitra AI" />
            {/* Floating stat cards on the image */}
            <div className="hero-float-card hero-float-1">
              <i className="fas fa-leaf"></i>
              <div>
                <strong>Disease Found</strong>
                <span>Early Blight Detected</span>
              </div>
            </div>
            <div className="hero-float-card hero-float-2">
              <i className="fas fa-tint"></i>
              <div>
                <strong>Water Schedule</strong>
                <span>Next: 6:00 AM</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Wave Divider */}
      <div className="wave-divider">
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
          <path
            d="M0,60 C360,120 720,0 1080,60 C1260,90 1380,60 1440,60 L1440,120 L0,120 Z"
            fill="var(--bg)"
          />
        </svg>
      </div>

      {/* About */}
      <section id="about" className="section-block">
        <motion.div
          className="section-inner"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <h2>Our Mission</h2>
          <p className="section-subtitle">
            Empowering Indian farmers with AI technology for sustainable and
            profitable farming
          </p>
          <div className="about-grid">
            <div className="about-card">
              <i className="fas fa-tint"></i>
              <h3>Smart Irrigation</h3>
              <p>
                Automated watering schedules based on plant health and weather
              </p>
            </div>
            <div className="about-card">
              <i className="fas fa-shield-virus"></i>
              <h3>Disease Detection</h3>
              <p>
                Instant plant disease diagnosis from photos with treatment plans
              </p>
            </div>
            <div className="about-card">
              <i className="fas fa-chart-line"></i>
              <h3>Crop Intelligence</h3>
              <p>
                Data-driven crop recommendations for maximum yield and profit
              </p>
            </div>
            <div className="about-card">
              <i className="fas fa-globe-asia"></i>
              <h3>Multilingual</h3>
              <p>
                Available in 18 Indian languages for nationwide accessibility
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="section-block section-alt how-it-works-section">
        {/* Dot pattern background */}
        <div className="dot-pattern"></div>
        <motion.div
          className="section-inner"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <h2>How It Works</h2>
          <p className="section-subtitle">
            Get started in 3 simple steps — no hardware needed
          </p>
          <div className="steps-container">
            <div className="steps-line"></div>
            {[
              {
                icon: "fa-camera",
                step: "01",
                title: "Snap a Photo",
                desc: "Take a picture of your plant or crop using your phone camera",
                color: "#00a676",
              },
              {
                icon: "fa-brain",
                step: "02",
                title: "AI Analyzes",
                desc: "Our AI instantly detects diseases, soil health, and plant conditions",
                color: "#00b4d8",
              },
              {
                icon: "fa-clipboard-list",
                step: "03",
                title: "Get Your Plan",
                desc: "Receive irrigation schedules, treatment plans, and crop recommendations",
                color: "#f59e0b",
              },
            ].map((s, i) => (
              <motion.div
                key={i}
                className="step-card"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
                viewport={{ once: true }}
                whileHover={{ y: -6 }}
              >
                <div
                  className="step-number"
                  style={{ background: s.color + "18", color: s.color }}
                >
                  {s.step}
                </div>
                <div
                  className="step-icon"
                  style={{ background: s.color + "18" }}
                >
                  <i className={`fas ${s.icon}`} style={{ color: s.color }}></i>
                </div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="section-block">
        <motion.div
          className="section-inner"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <h2>Powerful Features</h2>
          <p className="section-subtitle">
            Everything you need for smart farming, in one platform
          </p>
          <div className="features-grid">
            {features.map((f, i) => (
              <motion.div
                key={i}
                className={`feature-card${f.primary ? " feature-primary" : ""}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                viewport={{ once: true }}
                whileHover={{ y: -4 }}
              >
                {f.primary && <span className="badge-primary">★ PRIMARY</span>}
                <div className="feature-icon">
                  <i className={`fas ${f.icon}`}></i>
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Why KrishiMitra — Comparison Section */}
      <section className="section-block section-alt comparison-section">
        <div className="dot-pattern"></div>
        <motion.div
          className="section-inner"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <h2>Why KrishiMitra?</h2>
          <p className="section-subtitle">
            See how AI-powered smart farming compares to traditional methods
          </p>
          <div className="comparison-table">
            <div className="comparison-header">
              <div className="comparison-feature">Feature</div>
              <div className="comparison-old">Traditional Farming</div>
              <div className="comparison-new">KrishiMitra AI</div>
            </div>
            {[
              {
                feature: "Disease Detection",
                old: "Visual inspection, often too late",
                new: "AI detects early from a single photo",
              },
              {
                feature: "Irrigation",
                old: "Manual guesswork & fixed schedules",
                new: "Smart scheduling based on plant health",
              },
              {
                feature: "Crop Advice",
                old: "Word of mouth & tradition",
                new: "Data-driven soil & weather analysis",
              },
              {
                feature: "Language Support",
                old: "English-only resources",
                new: "18 Indian languages supported",
              },
              {
                feature: "Expert Access",
                old: "Expensive & limited availability",
                new: "24/7 AI chatbot expert — Free",
              },
              {
                feature: "Cost",
                old: "Expensive consultants & tools",
                new: "100% Free for all farmers",
              },
            ].map((row, i) => (
              <motion.div
                className="comparison-row"
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                viewport={{ once: true }}
              >
                <div className="comparison-feature">{row.feature}</div>
                <div className="comparison-old">
                  <i className="fas fa-times-circle"></i>
                  <span>{row.old}</span>
                </div>
                <div className="comparison-new">
                  <i className="fas fa-check-circle"></i>
                  <span>{row.new}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Demo Video */}
      <section id="demo" className="section-block demo-section">
        <motion.div
          className="section-inner"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <span className="demo-badge">
            <i className="fas fa-play-circle"></i> Watch in Action
          </span>
          <h2>See KrishiMitra in Action</h2>
          <p className="section-subtitle">
            Watch how our AI-powered platform helps farmers detect diseases,
            schedule irrigation, and boost productivity
          </p>
          <div className="demo-video-wrapper">
            <div className="demo-glow"></div>
            <div className="demo-video-container">
              <div className="demo-video-inner">
                {/* Replace the src below with your actual YouTube video ID */}
                <iframe
                  src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1"
                  title="KrishiMitra AI Demo Video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
            </div>
            {/* Decorative floating elements */}
            <div className="demo-float demo-float-1">
              <i className="fas fa-seedling"></i>
            </div>
            <div className="demo-float demo-float-2">
              <i className="fas fa-tint"></i>
            </div>
            <div className="demo-float demo-float-3">
              <i className="fas fa-sun"></i>
            </div>
          </div>
          <div className="demo-highlights">
            <div className="demo-highlight-item">
              <i className="fas fa-camera"></i>
              <span>Snap & Detect</span>
            </div>
            <div className="demo-highlight-item">
              <i className="fas fa-brain"></i>
              <span>AI Analysis</span>
            </div>
            <div className="demo-highlight-item">
              <i className="fas fa-clipboard-check"></i>
              <span>Get Recommendations</span>
            </div>
            <div className="demo-highlight-item">
              <i className="fas fa-chart-line"></i>
              <span>Track Progress</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Testimonials */}
      <section className="section-block testimonials-section">
        <div className="dot-pattern"></div>
        <motion.div
          className="section-inner"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <h2>Loved by Farmers</h2>
          <p className="section-subtitle">
            Hear from real farmers who transformed their farming with
            KrishiMitra
          </p>
          <div className="testimonials-grid">
            {testimonials.map((t, i) => (
              <motion.div
                className="testimonial-card"
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -4 }}
              >
                <div className="testimonial-stars">
                  {Array.from({ length: 5 }).map((_, si) => (
                    <i
                      key={si}
                      className={`fas fa-star${si < t.rating ? "" : " empty"}`}
                    ></i>
                  ))}
                </div>
                <p className="testimonial-text">"{t.text}"</p>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">{t.avatar}</div>
                  <div>
                    <strong>{t.name}</strong>
                    <span>{t.location}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* FAQ */}
      <section id="faq" className="section-block section-alt">
        <motion.div
          className="section-inner"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <h2>Frequently Asked Questions</h2>
          <div className="faq-list">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className={`faq-item${openFaq === i ? " open" : ""}`}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div className="faq-question">
                  <span>{faq.q}</span>
                  <i
                    className={`fas fa-chevron-${
                      openFaq === i ? "up" : "down"
                    }`}
                  ></i>
                </div>
                <div
                  className={`faq-answer${openFaq === i ? " faq-answer-open" : ""}`}
                >
                  <p>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <h2>Ready to Transform Your Farm?</h2>
          <p>Join thousands of Indian farmers using AI for smarter farming</p>
          <button className="btn-primary btn-lg" onClick={handleGetStarted}>
            Start Now — It's Free
          </button>
        </motion.div>
      </section>

      {/* Developed By */}
      <section className="section-block team-section">
        <motion.div
          className="section-inner"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <h2>Developed By</h2>
          <p className="section-subtitle">
            The passionate minds behind KrishiMitra AI
          </p>
          <div className="team-grid">
            {developers.map((person, i) => (
              <motion.div
                className="team-card"
                key={i}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12 }}
                viewport={{ once: true }}
                whileHover={{ y: -6 }}
              >
                <div
                  className="team-avatar"
                  style={{ background: `linear-gradient(135deg, ${person.color}, ${person.color}88)` }}
                >
                  {person.initials}
                </div>
                <h3>{person.name}</h3>
                <div className="team-links">
                  <a
                    href={`mailto:${person.email}`}
                    className="team-link-btn team-email"
                    title={`Email ${person.name}`}
                  >
                    <i className="fas fa-envelope"></i>
                  </a>
                  <a
                    href={person.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="team-link-btn team-linkedin"
                    title={`LinkedIn`}
                  >
                    <i className="fab fa-linkedin-in"></i>
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Mentored By */}
      <section className="section-block section-alt team-section">
        <div className="dot-pattern"></div>
        <motion.div
          className="section-inner"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <h2>Mentored By</h2>
          <p className="section-subtitle">
            Guided by distinguished educators and researchers
          </p>
          <div className="team-grid">
            {mentors.map((person, i) => (
              <motion.div
                className="team-card"
                key={i}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12 }}
                viewport={{ once: true }}
                whileHover={{ y: -6 }}
              >
                <div
                  className="team-avatar"
                  style={{ background: `linear-gradient(135deg, ${person.color}, ${person.color}88)` }}
                >
                  {person.initials}
                </div>
                <h3>{person.name}</h3>
                <div className="team-links">
                  <a
                    href={`mailto:${person.email}`}
                    className="team-link-btn team-email"
                    title={`Email ${person.name}`}
                  >
                    <i className="fas fa-envelope"></i>
                  </a>
                  <a
                    href={person.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="team-link-btn team-linkedin"
                    title={`LinkedIn`}
                  >
                    <i className="fab fa-linkedin-in"></i>
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer id="contact" className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <img src={logo} alt="KrishiMitra" />
            <div>
              <h3>KrishiMitra AI</h3>
              <p>Smart farming for every Indian farmer</p>
            </div>
          </div>
          <div className="footer-links">
            <a href="/" onClick={(e) => scrollToSection(e, "about")}>
              About
            </a>
            <a href="/" onClick={(e) => scrollToSection(e, "features")}>
              Features
            </a>
            <a href="/" onClick={(e) => scrollToSection(e, "demo")}>
              Demo
            </a>
            <a href="/" onClick={(e) => scrollToSection(e, "faq")}>
              FAQ
            </a>
          </div>
          <p className="footer-copy">
            © 2025 KrishiMitra AI. Built for Indian Farmers 🇮🇳
          </p>
        </div>
      </footer>


      {showLogin && (
        <LoginModal
          onClose={() => {
            setShowLogin(false);
            if (localStorage.getItem("krishimitra_user")) {
              navigate("/dashboard/sprinkler");
            }
          }}
        />
      )}
    </div>
  );
}
