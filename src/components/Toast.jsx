import { motion, AnimatePresence } from "framer-motion";
import "./Toast.css";

export default function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="toast-container" aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            className={`toast toast-${toast.type}`}
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            onClick={() => removeToast(toast.id)}
          >
            <i
              className={`fas fa-${toast.type === "success" ? "check-circle" : toast.type === "error" ? "exclamation-circle" : "info-circle"}`}
            ></i>
            <span>{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
