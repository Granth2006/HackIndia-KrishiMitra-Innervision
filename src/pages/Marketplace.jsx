import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { logService } from "../lib/supabase";
import { useBlockchain } from "../context/BlockchainContext";
import { getBlockchainRecords, decryptData } from "../lib/blockchain";
import "./Marketplace.css";

const SAMPLE_PRODUCTS = [
  {
    id: 1,
    name: "Organic Fertilizer (NPK)",
    seller: "Ravi Kumar",
    quantity: "50 kg",
    price: "₹1,200",
    location: "Delhi",
    mobile: "9876543210",
    hasPassport: true,
    healthScore: 92,
    organic: true,
  },
  {
    id: 2,
    name: "Wheat Seeds (HD-2967)",
    seller: "Priya Sharma",
    quantity: "25 kg",
    price: "₹800",
    location: "Punjab",
    mobile: "8765432109",
    hasPassport: true,
    healthScore: 88,
    organic: true,
  },
  {
    id: 3,
    name: "Neem Oil Pesticide",
    seller: "Arjun Singh",
    quantity: "5L",
    price: "₹450",
    location: "Rajasthan",
    mobile: "7654321098",
    hasPassport: false,
  },
  {
    id: 4,
    name: "Drip Irrigation Kit",
    seller: "Meena Devi",
    quantity: "1 set",
    price: "₹3,500",
    location: "Maharashtra",
    mobile: "6543210987",
    hasPassport: false,
  },
];

export default function Marketplace() {
  const { user } = useAuth();
  const blockchain = useBlockchain();
  const [sellItems, setSellItems] = useState([]);
  const [showSellForm, setShowSellForm] = useState(false);
  const [sellForm, setSellForm] = useState({
    product: "",
    quantity: "",
    price: "",
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [userHasPassport, setUserHasPassport] = useState(false);
  const [userPassportData, setUserPassportData] = useState(null);

  // Check if user has a crop passport
  useEffect(() => {
    if (!user?.dbId) return;
    const checkPassport = async () => {
      const { records } = await getBlockchainRecords(user.dbId);
      const passports = (records || []).filter((r) => r.record_type === "crop_passport");
      if (passports.length > 0) {
        setUserHasPassport(true);
        // Try to decrypt the latest passport
        if (blockchain?.walletAddress && passports[0].encrypted_data) {
          const decrypted = await decryptData(
            passports[0].encrypted_data,
            passports[0].encryption_iv,
            blockchain.walletAddress
          );
          if (decrypted) {
            setUserPassportData(decrypted);
          }
        }
      }
    };
    checkPassport();
  }, [user?.dbId, blockchain?.walletAddress]);

  const handleSell = (e) => {
    e.preventDefault();
    if (!sellForm.product || !sellForm.quantity || !sellForm.price) return;
    const newItem = {
      ...sellForm,
      id: Date.now(),
      seller: user?.name || "You",
      hasPassport: userHasPassport,
      healthScore: userPassportData?.lifecycle?.healthScore || null,
      organic: userPassportData?.lifecycle?.organicCompliant || false,
    };
    setSellItems([...sellItems, newItem]);
    setSellForm({ product: "", quantity: "", price: "" });
    setShowSellForm(false);

    // Log to Supabase
    if (user?.dbId) {
      logService(user.dbId, "marketplace", sellForm, null);
      // Blockchain: record on-chain + award tokens
      if (blockchain) {
        blockchain.addRecord("marketplace", sellForm);
        blockchain.awardTokens(15, "marketplace_listing");
      }
    }
  };

  const removeSellItem = (id) => {
    setSellItems(sellItems.filter((i) => i.id !== id));
  };

  return (
    <div className="page-container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-header"
      >
        <div className="page-title">
          <i className="fas fa-store"></i>
          <h1>Marketplace</h1>
        </div>
        <p className="page-desc">
          Buy and sell agricultural products directly with other farmers
        </p>
      </motion.div>

      <div className="market-actions">
        <button
          className="btn-primary"
          onClick={() => setShowSellForm(!showSellForm)}
        >
          <i className="fas fa-plus"></i> Sell Product
        </button>
        {userHasPassport && (
          <span className="market-passport-status">
            <i className="fas fa-certificate"></i> Your listings show Crop Passport verification
          </span>
        )}
      </div>

      {showSellForm && (
        <motion.form
          className="sell-form card"
          onSubmit={handleSell}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
        >
          <h3>List Your Product</h3>
          <div className="form-grid">
            <input
              placeholder="Product name"
              value={sellForm.product}
              onChange={(e) =>
                setSellForm({ ...sellForm, product: e.target.value })
              }
              required
            />
            <input
              placeholder="Quantity (e.g. 50 kg)"
              value={sellForm.quantity}
              onChange={(e) =>
                setSellForm({ ...sellForm, quantity: e.target.value })
              }
              required
            />
            <input
              placeholder="Price (e.g. ₹1200)"
              value={sellForm.price}
              onChange={(e) =>
                setSellForm({ ...sellForm, price: e.target.value })
              }
              required
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">
              <i className="fas fa-check"></i> List
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => setShowSellForm(false)}
            >
              Cancel
            </button>
          </div>
        </motion.form>
      )}

      {sellItems.length > 0 && (
        <div className="my-listings">
          <h2>Your Listings</h2>
          <div className="product-grid">
            {sellItems.map((item) => (
              <div key={item.id} className="product-card card my-card">
                <h3>{item.product}</h3>
                {item.hasPassport && (
                  <div className="product-passport-badge">
                    <i className="fas fa-certificate"></i>
                    <span>Verified Crop Passport</span>
                    {item.healthScore && (
                      <span className="passport-health-pill">
                        <i className="fas fa-heartbeat"></i> {item.healthScore}%
                      </span>
                    )}
                    {item.organic && (
                      <span className="passport-organic-pill">
                        <i className="fas fa-leaf"></i> Organic
                      </span>
                    )}
                  </div>
                )}
                <div className="product-info">
                  <span>Qty: {item.quantity}</span>
                  <span className="price">{item.price}</span>
                </div>
                <button
                  className="remove-btn"
                  onClick={() => removeSellItem(item.id)}
                >
                  <i className="fas fa-trash"></i> Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="section-title">Available Products</h2>
      <div className="product-grid">
        {SAMPLE_PRODUCTS.map((product) => (
          <motion.div
            key={product.id}
            className="product-card card"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -3 }}
          >
            <div className="product-card-header">
              <h3>{product.name}</h3>
              <span className="price">{product.price}</span>
            </div>
            {product.hasPassport && (
              <div className="product-passport-badge">
                <i className="fas fa-certificate"></i>
                <span>Verified Crop Passport</span>
                {product.healthScore && (
                  <span className="passport-health-pill">
                    <i className="fas fa-heartbeat"></i> {product.healthScore}%
                  </span>
                )}
                {product.organic && (
                  <span className="passport-organic-pill">
                    <i className="fas fa-leaf"></i> Organic
                  </span>
                )}
              </div>
            )}
            <div className="product-details">
              <span>
                <i className="fas fa-user"></i> {product.seller}
              </span>
              <span>
                <i className="fas fa-box"></i> {product.quantity}
              </span>
              <span>
                <i className="fas fa-map-marker-alt"></i> {product.location}
              </span>
            </div>
            <button
              className="btn-primary buy-btn"
              onClick={() => setSelectedProduct(product)}
            >
              <i className="fas fa-shopping-cart"></i> Buy Now
            </button>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedProduct && (
          <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
            <motion.div
              className="modal-card card"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <button
                className="modal-close"
                onClick={() => setSelectedProduct(null)}
              >
                <i className="fas fa-times"></i>
              </button>
              <h2>Seller Details</h2>
              {selectedProduct.hasPassport && (
                <div className="modal-passport-section">
                  <div className="modal-passport-badge">
                    <i className="fas fa-shield-alt"></i>
                    <div>
                      <strong>Blockchain Verified Crop Passport</strong>
                      <p>This seller's crop history is immutably recorded on-chain.</p>
                    </div>
                  </div>
                  <div className="modal-passport-stats">
                    {selectedProduct.healthScore && (
                      <div className="modal-passport-stat">
                        <i className="fas fa-heartbeat"></i>
                        <span>Health Score: <strong>{selectedProduct.healthScore}%</strong></span>
                      </div>
                    )}
                    {selectedProduct.organic && (
                      <div className="modal-passport-stat organic">
                        <i className="fas fa-leaf"></i>
                        <span><strong>Organic Compliant</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="seller-info">
                <div>
                  <strong>Product:</strong> {selectedProduct.name}
                </div>
                <div>
                  <strong>Price:</strong> {selectedProduct.price}
                </div>
                <div>
                  <strong>Quantity:</strong> {selectedProduct.quantity}
                </div>
                <div>
                  <strong>Seller:</strong> {selectedProduct.seller}
                </div>
                <div>
                  <strong>Mobile:</strong> {selectedProduct.mobile}
                </div>
                <div>
                  <strong>Location:</strong> {selectedProduct.location}
                </div>
              </div>
              <a
                href={`tel:${selectedProduct.mobile}`}
                className="btn-primary"
                style={{ marginTop: "1rem", justifyContent: "center" }}
              >
                <i className="fas fa-phone"></i> Call Seller
              </a>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
