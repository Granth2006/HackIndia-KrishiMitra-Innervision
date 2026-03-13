import { motion, AnimatePresence } from "framer-motion";
import { useBlockchain } from "../context/BlockchainContext";
import "./BlockchainRewardToast.css";

export default function BlockchainRewardToast() {
  const blockchain = useBlockchain();
  const lastReward = blockchain?.lastReward;

  const reasonLabels = {
    disease_scan: "Disease Detection",
    crop_recommendation: "Crop Recommendation",
    chat_interaction: "AI Chat",
    weather_check: "Weather Check",
    marketplace_listing: "Marketplace Listing",
    field_created: "Field Created",
    crop_passport_created: "Crop Passport",
  };

  return (
    <AnimatePresence>
      {lastReward && (
        <motion.div
          className="blockchain-reward-toast"
          initial={{ opacity: 0, y: 60, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <div className="reward-toast-icon">
            <i className="fas fa-coins"></i>
          </div>
          <div className="reward-toast-content">
            <span className="reward-toast-amount">+{lastReward.amount} $KRISHI</span>
            <span className="reward-toast-reason">
              {reasonLabels[lastReward.reason] || lastReward.reason}
            </span>
          </div>
          <div className="reward-toast-chain">
            <i className="fas fa-link"></i>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
