import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import "./ImageUploader.css";

export default function ImageUploader({
  onImageSelect,
  label = "Upload Plant Image",
}) {
  const [preview, setPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFile = useCallback(
    (file) => {
      if (!file || !file.type.startsWith("image/")) return;
      setPreview(URL.createObjectURL(file));
      onImageSelect(file);
    },
    [onImageSelect],
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      handleFile(file);
    },
    [handleFile],
  );

  const clearImage = () => {
    setPreview(null);
    onImageSelect(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
    <div className="image-uploader">
      <motion.div
        className={`upload-zone${isDragging ? " dragging" : ""}${preview ? " has-preview" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        {preview ? (
          <div className="preview-wrapper">
            <img src={preview} alt="Preview" className="upload-preview" />
            <button
              className="clear-btn"
              onClick={(e) => {
                e.stopPropagation();
                clearImage();
              }}
              aria-label="Remove image"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        ) : (
          <div className="upload-placeholder">
            <i className="fas fa-cloud-upload-alt"></i>
            <p>{label}</p>
            <span className="upload-hint">Drag & drop or click to browse</span>
          </div>
        )}
      </motion.div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden-input"
        onChange={(e) => handleFile(e.target.files[0])}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden-input"
        onChange={(e) => handleFile(e.target.files[0])}
      />

      <button
        className="camera-btn"
        onClick={() => cameraInputRef.current?.click()}
        aria-label="Take photo"
      >
        <i className="fas fa-camera"></i>
        <span>Camera</span>
      </button>
    </div>
  );
}
