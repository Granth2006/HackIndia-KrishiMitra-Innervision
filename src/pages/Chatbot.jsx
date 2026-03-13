import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import {
  getChatHistory,
  saveChatMessage,
  hasGuestUsedService,
  markGuestServiceUsed,
} from "../lib/supabase";
import { useBlockchain } from "../context/BlockchainContext";
import "./Chatbot.css";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });
}

export default function Chatbot() {
  const { user } = useAuth();
  const blockchain = useBlockchain();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [guestBlocked, setGuestBlocked] = useState(false);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load chat history from Supabase (or localStorage fallback)
  useEffect(() => {
    const loadHistory = async () => {
      if (user?.dbId) {
        const { messages: cloudMsgs } = await getChatHistory(user.dbId);
        if (cloudMsgs.length > 0) {
          setMessages(
            cloudMsgs.map((m) => ({
              role: m.role,
              text: m.text,
              timestamp: m.created_at,
              imageUrl: m.image_url,
            })),
          );
          return;
        }
      }
      // Fallback to localStorage
      if (user?.email) {
        try {
          const h = JSON.parse(
            localStorage.getItem(`chatHistory_${user.email}`) || "[]",
          );
          setMessages(h);
        } catch {
          /* ignore */
        }
      }
    };
    loadHistory();
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveHistory = (msgs) => {
    if (user?.email)
      localStorage.setItem(`chatHistory_${user.email}`, JSON.stringify(msgs));
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const clearImage = () => {
    setImage(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() && !image) return;

    // Guest limit check (localStorage)
    if (user?.isGuest && hasGuestUsedService("chatbot")) {
      setGuestBlocked(true);
      const errMsg = {
        role: "ai",
        text: "Guest users can only use the chatbot once. Please sign in with Google to continue chatting.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
      return;
    }
    if (guestBlocked) return;

    const userMsg = {
      role: "user",
      text: input.trim() || "Photo uploaded",
      timestamp: new Date().toISOString(),
    };
    if (imagePreview) userMsg.imageUrl = imagePreview;

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // Save user message to Supabase
    if (user?.dbId) {
      saveChatMessage(
        user.dbId,
        "user",
        userMsg.text,
        image ? "[image]" : null,
      );
    }

    try {
      const body = {
        messages: messages.slice(-10),
        userMessage:
          input.trim() ||
          "Analyze this plant image for health, diseases, or farming issues.",
      };

      if (image) {
        const b64 = await fileToBase64(image);
        body.imageBase64 = b64.split(",")[1];
        body.mimeType = image.type;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      let responseText = "";
      if (res.ok) {
        const data = await res.json();
        responseText = data.reply || "";
      }

      if (!responseText)
        responseText =
          "I'm having trouble connecting. Please try again in a moment.";

      const aiMsg = {
        role: "ai",
        text: responseText,
        timestamp: new Date().toISOString(),
      };
      const updated = [...newMessages, aiMsg];
      setMessages(updated);
      saveHistory(updated);

      // Save AI response to Supabase
      if (user?.dbId) {
        saveChatMessage(user.dbId, "ai", responseText);
        // Blockchain: record on-chain + award tokens
        if (blockchain) {
          blockchain.addRecord("chat", { userMessage: userMsg.text, aiResponse: responseText });
          blockchain.awardTokens(2, "chat_interaction");
        }
      } else if (user?.isGuest) {
        markGuestServiceUsed("chatbot");
      }
    } catch {
      const errMsg = {
        role: "ai",
        text: "Sorry, something went wrong. Please try again.",
        timestamp: new Date().toISOString(),
      };
      const updated = [...newMessages, errMsg];
      setMessages(updated);
      saveHistory(updated);
    } finally {
      clearImage();
      setLoading(false);
    }
  };

  const speakText = (text) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    window.speechSynthesis.speak(u);
  };

  const startSpeechRecognition = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "en-US";
    r.onresult = (e) => setInput(e.results[0][0].transcript.trim());
    r.start();
  };

  return (
    <div className="page-container chatbot-page">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-header"
      >
        <div className="page-title">
          <i className="fas fa-robot"></i>
          <h1>AI Chatbot</h1>
        </div>
        <p className="page-desc">
          Chat with KrishiMitra AI about farming, crops, soil, pests, and more
        </p>
      </motion.div>

      <div className="chat-container card">
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-welcome">
              <i className="fas fa-robot"></i>
              <h3>Hello! I'm KrishiMitra AI</h3>
              <p>
                Ask me about crops, soil, weather, pests, or upload a plant
                photo for analysis!
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`chat-msg ${msg.role}`}>
              <div className="msg-avatar">
                <i
                  className={`fas ${msg.role === "user" ? "fa-user" : "fa-robot"}`}
                ></i>
              </div>
              <div className="msg-content">
                <p>{msg.text}</p>
                {msg.imageUrl && (
                  <img src={msg.imageUrl} alt="Upload" className="msg-image" />
                )}
                {msg.role === "ai" && (
                  <button
                    className="speak-btn"
                    onClick={() => speakText(msg.text)}
                    aria-label="Read aloud"
                  >
                    <i className="fas fa-volume-up"></i>
                  </button>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="chat-msg ai">
              <div className="msg-avatar">
                <i className="fas fa-robot"></i>
              </div>
              <div className="msg-content typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {imagePreview && (
          <div className="image-preview-bar">
            <img src={imagePreview} alt="Preview" />
            <button onClick={clearImage}>
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}

        <form className="chat-input-bar" onSubmit={sendMessage}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden-input"
            onChange={handleImageSelect}
          />
          <button
            type="button"
            className="chat-action-btn"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach image"
          >
            <i className="fas fa-image"></i>
          </button>
          <button
            type="button"
            className="chat-action-btn"
            onClick={startSpeechRecognition}
            aria-label="Voice input"
          >
            <i className="fas fa-microphone"></i>
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about crops, soil, pests..."
            disabled={loading || guestBlocked}
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={(loading && !input.trim() && !image) || guestBlocked}
          >
            <i className="fas fa-paper-plane"></i>
          </button>
        </form>
      </div>
    </div>
  );
}
