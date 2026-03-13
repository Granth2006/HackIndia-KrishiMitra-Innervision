import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { saveUserField } from "../lib/supabase";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// ─── Helpers ───

function computeArea(coords) {
  if (coords.length < 3) return 0;
  const toRad = (d) => (d * Math.PI) / 180;
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const xi = coords[i].lng * Math.cos(toRad(coords[i].lat)) * 111320;
    const yi = coords[i].lat * 110540;
    const xj = coords[j].lng * Math.cos(toRad(coords[j].lat)) * 111320;
    const yj = coords[j].lat * 110540;
    area += xi * yj - xj * yi;
  }
  return Math.abs(area / 2);
}

function computeCenter(coords) {
  if (coords.length === 0) return { lat: 20.5937, lng: 78.9629 };
  const sum = coords.reduce(
    (acc, c) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / coords.length, lng: sum.lng / coords.length };
}

function formatArea(sqm) {
  if (sqm >= 10000) return `${(sqm / 10000).toFixed(2)} ha`;
  if (sqm >= 4046.86) return `${(sqm / 4046.86).toFixed(2)} acres`;
  return `${sqm.toFixed(0)} m²`;
}

// ─── Manual Mode Map ───

function PopupManualMap({ points }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const polygonRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const center =
      points.length > 0 ? [points[0].lat, points[0].lng] : [20.5937, 78.9629];

    const map = L.map(containerRef.current, {
      center,
      zoom: points.length > 0 ? 17 : 5,
    });

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19 }
    ).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (polygonRef.current) {
      polygonRef.current.remove();
      polygonRef.current = null;
    }

    points.forEach((p, i) => {
      const marker = L.marker([p.lat, p.lng])
        .addTo(map)
        .bindPopup(`Point ${i + 1}`);
      markersRef.current.push(marker);
    });

    if (points.length >= 3) {
      polygonRef.current = L.polygon(
        points.map((p) => [p.lat, p.lng]),
        { color: "#4caf50", weight: 3, fillOpacity: 0.2 }
      ).addTo(map);
    }

    if (points.length > 0) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 18 });
    }
  }, [points]);

  return (
    <div
      ref={containerRef}
      className="afm-map"
    />
  );
}

// ─── Automatic / Satellite Mode Map ───

function PopupAutoMap({ onPolygonComplete }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [locating, setLocating] = useState(true);
  const [locationInput, setLocationInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const handleLocationSearch = async () => {
    if (!locationInput.trim() || !mapRef.current) return;
    setSearching(true);
    setSearchError("");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationInput.trim())}&limit=1`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        mapRef.current.flyTo([parseFloat(lat), parseFloat(lon)], 17, { duration: 1.5 });
      } else {
        setSearchError("Location not found. Try a different name.");
      }
    } catch {
      setSearchError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
    });

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19 }
    ).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      draw: {
        polygon: {
          allowIntersection: false,
          shapeOptions: { color: "#4caf50", weight: 3, fillOpacity: 0.2 },
        },
        polyline: false,
        rectangle: {
          shapeOptions: { color: "#4caf50", weight: 3, fillOpacity: 0.2 },
        },
        circle: false,
        circlemarker: false,
        marker: false,
      },
      edit: { featureGroup: drawnItems, remove: true },
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (e) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);
      // Flatten nested arrays from rectangles/polygons until we reach LatLng objects
      let latlngs = e.layer.getLatLngs();
      while (latlngs && Array.isArray(latlngs) && latlngs.length > 0 && Array.isArray(latlngs[0])) {
        latlngs = latlngs[0];
      }
      const coords = latlngs.map((ll) => ({ lat: ll.lat, lng: ll.lng }));
      onPolygonComplete(coords);
    });

    map.on(L.Draw.Event.DELETED, () => {
      onPolygonComplete([]);
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.setView([pos.coords.latitude, pos.coords.longitude], 17);
          L.marker([pos.coords.latitude, pos.coords.longitude])
            .addTo(map)
            .bindPopup("You are here")
            .openPopup();
          setLocating(false);
        },
        () => setLocating(false),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocating(false);
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <>
      {locating && (
        <div className="afm-locating">
          <i className="fas fa-spinner fa-spin"></i> Getting your location…
        </div>
      )}
      <div className="afm-location-search">
        <i className="fas fa-search"></i>
        <input
          type="text"
          placeholder="Enter location (e.g. village, city, or address)"
          value={locationInput}
          onChange={(e) => setLocationInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLocationSearch()}
        />
        <button onClick={handleLocationSearch} disabled={searching || !locationInput.trim()}>
          {searching ? <i className="fas fa-spinner fa-spin"></i> : "Go"}
        </button>
      </div>
      {searchError && (
        <div className="afm-search-error">
          <i className="fas fa-exclamation-triangle"></i> {searchError}
        </div>
      )}
      <div
        ref={containerRef}
        className="afm-map afm-map--tall"
      />
    </>
  );
}

// ─── Main Component ───

export default function AddFieldModal({ onFieldCreated, onCancel }) {
  const { user } = useAuth();
  const [view, setView] = useState("choose"); // choose | manual | auto
  const [fieldName, setFieldName] = useState("My Field");
  const [saving, setSaving] = useState(false);

  // Manual mode
  const [manualPoints, setManualPoints] = useState([]);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [geoError, setGeoError] = useState("");

  // Auto mode
  const [autoCoords, setAutoCoords] = useState([]);

  const handleAddPoint = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    setGettingLocation(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setManualPoints((prev) => [
          ...prev,
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
        ]);
        setGettingLocation(false);
      },
      (err) => {
        setGeoError(
          err.code === 1
            ? "Location permission denied. Please allow location access."
            : "Unable to get your location. Please try again."
        );
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleRemovePoint = (index) => {
    setManualPoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (coords) => {
    if (!user?.dbId || coords.length < 3) return;
    setSaving(true);
    const area = computeArea(coords);
    const center = computeCenter(coords);
    const { field } = await saveUserField(user.dbId, {
      name: fieldName || "My Field",
      coordinates: coords,
      area_sqm: area,
      center,
    });
    setSaving(false);
    if (onFieldCreated) onFieldCreated(field);
  };

  // ─── MODE SELECTION ───
  if (view === "choose") {
    return (
      <div className="afm-container">
        <h4 className="afm-heading">How would you like to map your field?</h4>
        <p className="afm-subheading">Choose the method that works best for you</p>
        <div className="afm-mode-cards">
          <div className="afm-mode-card" onClick={() => setView("manual")}>
            <div className="afm-mode-icon-wrap">
              <i className="fas fa-walking"></i>
            </div>
            <h5>Manual (Walk)</h5>
            <p>Walk to each corner of your field and tap to record GPS coordinates</p>
          </div>
          <div className="afm-mode-card" onClick={() => setView("auto")}>
            <div className="afm-mode-icon-wrap">
              <i className="fas fa-satellite"></i>
            </div>
            <h5>Automatic (Satellite)</h5>
            <p>Draw your field boundary on a satellite map from anywhere</p>
          </div>
        </div>
        <button className="afm-back-btn" onClick={onCancel}>
          <i className="fas fa-arrow-left"></i> Back
        </button>
      </div>
    );
  }

  // ─── MANUAL MODE ───
  if (view === "manual") {
    return (
      <div className="afm-container">
        <div className="afm-section-header">
          <i className="fas fa-walking"></i>
          <h4>Manual Mode</h4>
        </div>
        <p className="afm-hint">
          Walk to each corner of your field and tap "Add Point" to capture GPS.
        </p>

        <div className="field-popup-form-group">
          <label>Field Name</label>
          <input
            type="text"
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            placeholder="e.g. North Paddy Field"
            className="field-popup-input"
          />
        </div>

        <div className="afm-controls">
          <button
            className="afm-add-point-btn"
            onClick={handleAddPoint}
            disabled={gettingLocation}
          >
            {gettingLocation ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Getting Location…
              </>
            ) : (
              <>
                <i className="fas fa-map-pin"></i> Add Point
              </>
            )}
          </button>
          <div className="afm-point-count">
            <i className="fas fa-draw-polygon"></i>
            {manualPoints.length} point{manualPoints.length !== 1 ? "s" : ""}
          </div>
        </div>

        {geoError && (
          <p className="field-popup-geo-error">
            <i className="fas fa-exclamation-triangle"></i> {geoError}
          </p>
        )}

        {manualPoints.length > 0 && (
          <div className="afm-points-list">
            {manualPoints.map((p, i) => (
              <div key={i} className="afm-point-item">
                <span className="afm-point-index">#{i + 1}</span>
                <span className="afm-point-coords">
                  {p.lat.toFixed(6)}, {p.lng.toFixed(6)}
                </span>
                <button
                  className="afm-point-remove"
                  onClick={() => handleRemovePoint(i)}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
          </div>
        )}

        {manualPoints.length > 0 && <PopupManualMap points={manualPoints} />}

        {manualPoints.length >= 3 && (
          <p className="afm-area-info">
            <i className="fas fa-ruler-combined"></i> Estimated area:{" "}
            {formatArea(computeArea(manualPoints))}
          </p>
        )}

        <div className="field-popup-form-actions">
          <button
            className="field-popup-form-cancel"
            onClick={() => {
              setView("choose");
              setManualPoints([]);
              setGeoError("");
            }}
          >
            <i className="fas fa-arrow-left"></i> Back
          </button>
          <button
            className="field-popup-add-btn"
            onClick={() => handleSave(manualPoints)}
            disabled={manualPoints.length < 3 || saving}
          >
            {saving ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Saving…
              </>
            ) : (
              <>
                <i className="fas fa-save"></i> Save Field
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ─── AUTOMATIC / SATELLITE MODE ───
  if (view === "auto") {
    return (
      <div className="afm-container">
        <div className="afm-section-header">
          <i className="fas fa-satellite"></i>
          <h4>Satellite Mode</h4>
        </div>
        <p className="afm-hint">
          Draw the boundary of your field on the satellite map below.
        </p>

        <div className="field-popup-form-group">
          <label>Field Name</label>
          <input
            type="text"
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
            placeholder="e.g. South Wheat Field"
            className="field-popup-input"
          />
        </div>

        <PopupAutoMap onPolygonComplete={setAutoCoords} />

        {autoCoords.length >= 3 && (
          <p className="afm-area-info">
            <i className="fas fa-ruler-combined"></i> Estimated area:{" "}
            {formatArea(computeArea(autoCoords))}
          </p>
        )}

        <div className="field-popup-form-actions">
          <button
            className="field-popup-form-cancel"
            onClick={() => {
              setView("choose");
              setAutoCoords([]);
            }}
          >
            <i className="fas fa-arrow-left"></i> Back
          </button>
          <button
            className="field-popup-add-btn"
            onClick={() => handleSave(autoCoords)}
            disabled={autoCoords.length < 3 || saving}
          >
            {saving ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Saving…
              </>
            ) : (
              <>
                <i className="fas fa-save"></i> Save Field
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
