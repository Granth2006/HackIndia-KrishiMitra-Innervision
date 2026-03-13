import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getUserFields, saveUserField, deleteUserField, updateUserField } from "../lib/supabase";
import { useBlockchain } from "../context/BlockchainContext";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import "./YourField.css";

// Fix default marker icons for Leaflet in bundler environments
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
  // Shoelace formula for polygon area on a flat approximation
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
  if (coords.length === 0) return { lat: 20.5937, lng: 78.9629 }; // India center
  const sum = coords.reduce(
    (acc, c) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / coords.length, lng: sum.lng / coords.length };
}

function formatArea(sqm) {
  if (sqm >= 10000) return `${(sqm / 10000).toFixed(2)} ha`;
  if (sqm >= 4046.86) return `${(sqm / 4046.86).toFixed(2)} acres`;
  return `${sqm.toFixed(0)} m²`;
}

// ─── Sprinkler Grid Helpers ───

const SPRINKLER_RADIUS_FEET = 20;
const SPRINKLER_RADIUS_METERS = SPRINKLER_RADIUS_FEET * 0.3048;

function isPointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    const intersect = ((yi > point.lng) !== (yj > point.lng))
      && (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function computeSprinklerGrid(coordinates) {
  if (!coordinates || coordinates.length < 3) return [];
  const spacingMeters = SPRINKLER_RADIUS_METERS * 2;
  const lats = coordinates.map(c => c.lat);
  const lngs = coordinates.map(c => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpacing = spacingMeters / 110540;
  const avgLat = (minLat + maxLat) / 2;
  const lngSpacing = spacingMeters / (111320 * Math.cos(avgLat * Math.PI / 180));
  const grid = [];
  for (let lat = minLat + latSpacing / 2; lat <= maxLat; lat += latSpacing) {
    for (let lng = minLng + lngSpacing / 2; lng <= maxLng; lng += lngSpacing) {
      if (isPointInPolygon({ lat, lng }, coordinates)) {
        grid.push({ lat, lng });
      }
    }
  }
  return grid;
}

// ─── Mini Map Preview (for saved fields list) ───

function FieldMiniMap({ coordinates }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !coordinates || coordinates.length < 3) return;
    if (mapRef.current) return; // already initialized

    const center = computeCenter(coordinates);
    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
    });

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19 },
    ).addTo(map);

    const polygon = L.polygon(
      coordinates.map((c) => [c.lat, c.lng]),
      { color: "#4caf50", weight: 2, fillOpacity: 0.25 },
    ).addTo(map);
    map.fitBounds(polygon.getBounds(), { padding: [20, 20] });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [coordinates]);

  return <div ref={containerRef} className="field-card-map" />;
}

// ─── Full Interactive Map (for field detail view) ───

function FieldDetailMap({ coordinates, sprinklerGrid = [] }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !coordinates || coordinates.length < 3) return;
    // Recreate map when data changes
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const center = computeCenter(coordinates);
    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: 17,
      zoomControl: true,
      attributionControl: true,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
    });

    // Satellite layer
    const satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "Esri World Imagery" },
    );

    // Street layer
    const street = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { maxZoom: 19, attribution: "OpenStreetMap" },
    );

    satellite.addTo(map);
    L.control.layers({ Satellite: satellite, Street: street }).addTo(map);

    // Field polygon
    const polygon = L.polygon(
      coordinates.map((c) => [c.lat, c.lng]),
      { color: "#4caf50", weight: 3, fillOpacity: 0.15, fillColor: "#4caf50" },
    ).addTo(map);

    // Corner markers
    coordinates.forEach((c, i) => {
      L.circleMarker([c.lat, c.lng], {
        radius: 6,
        color: "#fff",
        weight: 2,
        fillColor: "#4caf50",
        fillOpacity: 1,
      })
        .addTo(map)
        .bindPopup(
          `Point ${i + 1}<br>${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`,
        );
    });

    // ─── Sprinkler Grid Overlay ───
    if (sprinklerGrid.length > 0) {
      const lats = coordinates.map(c => c.lat);
      const lngs = coordinates.map(c => c.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const spacingMeters = SPRINKLER_RADIUS_METERS * 2;
      const latSpacing = spacingMeters / 110540;
      const avgLat = (minLat + maxLat) / 2;
      const lngSpacing = spacingMeters / (111320 * Math.cos(avgLat * Math.PI / 180));

      // Grid lines (horizontal)
      for (let lat = minLat; lat <= maxLat + latSpacing; lat += latSpacing) {
        L.polyline([[lat, minLng - lngSpacing], [lat, maxLng + lngSpacing]], {
          color: "rgba(255,255,255,0.25)", weight: 1, dashArray: "4 6",
        }).addTo(map);
      }
      // Grid lines (vertical)
      for (let lng = minLng; lng <= maxLng + lngSpacing; lng += lngSpacing) {
        L.polyline([[minLat - latSpacing, lng], [maxLat + latSpacing, lng]], {
          color: "rgba(255,255,255,0.25)", weight: 1, dashArray: "4 6",
        }).addTo(map);
      }

      // Sprinkler coverage circles & center markers
      sprinklerGrid.forEach((pos, i) => {
        L.circle([pos.lat, pos.lng], {
          radius: SPRINKLER_RADIUS_METERS,
          color: "#2196F3",
          weight: 1.5,
          fillColor: "#2196F3",
          fillOpacity: 0.1,
          dashArray: "4 4",
        }).addTo(map);
        L.circleMarker([pos.lat, pos.lng], {
          radius: 5,
          color: "#fff",
          weight: 2,
          fillColor: "#2196F3",
          fillOpacity: 1,
        })
          .addTo(map)
          .bindPopup(`Sprinkler #${i + 1}<br>Coverage: ${SPRINKLER_RADIUS_FEET}ft radius`);
      });
    }

    map.fitBounds(polygon.getBounds(), { padding: [50, 50] });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [coordinates, sprinklerGrid]);

  return <div ref={containerRef} className="map-container field-detail-map" />;
}

// ─── Manual Mode Map ───

function ManualMap({ points }) {
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
      { maxZoom: 19, attribution: "Esri World Imagery" },
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

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (polygonRef.current) {
      polygonRef.current.remove();
      polygonRef.current = null;
    }

    // Add markers
    points.forEach((p, i) => {
      const marker = L.marker([p.lat, p.lng])
        .addTo(map)
        .bindPopup(`Point ${i + 1}`);
      markersRef.current.push(marker);
    });

    // Draw polygon if 3+ points
    if (points.length >= 3) {
      polygonRef.current = L.polygon(
        points.map((p) => [p.lat, p.lng]),
        { color: "#4caf50", weight: 3, fillOpacity: 0.2 },
      ).addTo(map);
    }

    // Fit bounds
    if (points.length > 0) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 18 });
    }
  }, [points]);

  return <div ref={containerRef} className="map-container" />;
}

// ─── Automatic / Satellite Draw Mode Map ───

function AutoMap({ onPolygonComplete }) {
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
      { maxZoom: 19, attribution: "Esri World Imagery" },
    ).addTo(map);

    // Drawn items layer
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Draw control
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
      edit: {
        featureGroup: drawnItems,
        remove: true,
      },
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

    // Try to get user location
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
        () => {
          setLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000 },
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
        <div className="location-status loading">
          <i className="fas fa-spinner fa-spin"></i>
          Getting your location…
        </div>
      )}
      <div className="location-search-bar">
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
        <div className="location-status error" style={{ marginBottom: 8 }}>
          <i className="fas fa-exclamation-triangle"></i> {searchError}
        </div>
      )}
      <div
        ref={containerRef}
        className="map-container"
        style={{ height: 450 }}
      />
    </>
  );
}

// ─── Main Component ───

export default function YourField() {
  const { user } = useAuth();
  const blockchain = useBlockchain();
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list"); // list | choose | manual | auto | view-field
  const [saving, setSaving] = useState(false);
  const [viewField, setViewField] = useState(null); // field object for detail view

  // Manual mode state
  const [manualPoints, setManualPoints] = useState([]);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [fieldName, setFieldName] = useState("My Field");

  // Auto mode state
  const [autoCoords, setAutoCoords] = useState([]);

  // Edit mode state
  const [editName, setEditName] = useState("");
  const [editCoords, setEditCoords] = useState(null);
  const [showRedrawMap, setShowRedrawMap] = useState(false);

  const loadFields = useCallback(async () => {
    if (!user?.dbId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { fields: data } = await getUserFields(user.dbId);
    setFields(data);
    setLoading(false);
  }, [user?.dbId]);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  // ─── Add Point (Manual Mode) ───
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
            : "Unable to get your location. Please try again.",
        );
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const handleRemovePoint = (index) => {
    setManualPoints((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Save Field ───
  const handleSaveField = async (coords) => {
    if (!user?.dbId || coords.length < 3) return;
    setSaving(true);
    const area = computeArea(coords);
    const center = computeCenter(coords);
    await saveUserField(user.dbId, {
      name: fieldName || "My Field",
      coordinates: coords,
      area_sqm: area,
      center,
    });
    // Blockchain: record on-chain + award tokens
    if (blockchain) {
      blockchain.addRecord("field", { name: fieldName || "My Field", area_sqm: area, pointCount: coords.length });
      blockchain.awardTokens(20, "field_created");
    }
    setManualPoints([]);
    setAutoCoords([]);
    setFieldName("My Field");
    setView("list");
    await loadFields();
    setSaving(false);
  };

  // ─── Delete Field ───
  const handleDeleteField = async (fieldId) => {
    await deleteUserField(fieldId);
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
  };

  // ─── Edit Field ───
  const startEdit = (field) => {
    setViewField(field);
    setEditName(field.name || "My Field");
    setEditCoords(null);
    setShowRedrawMap(false);
    setView("edit-field");
  };

  const handleSaveEdit = async () => {
    if (!viewField?.id || !user?.dbId) return;
    setSaving(true);
    const updates = { name: editName || "My Field" };
    if (editCoords && editCoords.length >= 3) {
      updates.coordinates = editCoords;
      updates.area_sqm = computeArea(editCoords);
      updates.center = computeCenter(editCoords);
    }
    await updateUserField(viewField.id, updates);
    const updatedField = { ...viewField, ...updates };
    setViewField(updatedField);
    setFields(prev => prev.map(f => f.id === viewField.id ? updatedField : f));
    setView("view-field");
    setEditCoords(null);
    setShowRedrawMap(false);
    setSaving(false);
  };

  // ─── Start new field ───
  const startNewField = () => {
    setManualPoints([]);
    setAutoCoords([]);
    setFieldName("My Field");
    setView("choose");
  };

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="your-field-page">
        <div className="saving-overlay">
          <i className="fas fa-spinner fa-spin"></i> Loading your fields…
        </div>
      </div>
    );
  }

  // ─── LIST VIEW ───
  if (view === "list") {
    if (fields.length === 0) {
      return (
        <div className="your-field-page">
          <h1>Your Field</h1>
          <p className="page-subtitle">Map your farm and manage your fields</p>
          <div className="field-welcome">
            <i className="fas fa-map-marked-alt welcome-icon"></i>
            <h2>Map Your Farm</h2>
            <p>
              Create a virtual map of your farm by walking its boundaries or
              drawing on a satellite view. Your field data helps us provide
              better crop and irrigation recommendations.
            </p>
            <button className="btn-primary" onClick={startNewField}>
              <i className="fas fa-plus"></i> Get Started
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="your-field-page">
        <h1>Your Field</h1>
        <p className="page-subtitle">Map your farm and manage your fields</p>
        <div className="fields-header">
          <h2>
            {fields.length} Saved Field{fields.length !== 1 ? "s" : ""}
          </h2>
          <button className="btn-primary" onClick={startNewField}>
            <i className="fas fa-plus"></i> Add Field
          </button>
        </div>
        <div className="fields-grid">
          {fields.map((field) => (
            <div
              key={field.id}
              className="field-card"
              onClick={() => {
                setViewField(field);
                setView("view-field");
              }}
              style={{ cursor: "pointer" }}
            >
              <FieldMiniMap coordinates={field.coordinates} />
              <div className="field-card-info">
                <h3>{field.name || "Unnamed Field"}</h3>
                <div className="field-card-meta">
                  <span>
                    <i className="fas fa-ruler-combined"></i>
                    {field.area_sqm ? formatArea(field.area_sqm) : "—"}
                  </span>
                  <span>
                    <i className="fas fa-map-pin"></i>
                    {field.coordinates?.length || 0} points
                  </span>
                  <span>
                    <i className="fas fa-calendar"></i>
                    {new Date(field.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="field-card-actions">
                  <button
                    className="btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewField(field);
                      setView("view-field");
                    }}
                  >
                    <i className="fas fa-eye"></i> View
                  </button>
                  <button
                    className="btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteField(field.id);
                    }}
                  >
                    <i className="fas fa-trash"></i> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── FIELD DETAIL VIEW ───
  if (view === "view-field" && viewField) {
    const sprinklerGrid = computeSprinklerGrid(viewField.coordinates);
    return (
      <div className="your-field-page">
        <h1>Your Field</h1>
        <p className="page-subtitle">Map your farm and manage your fields</p>
        <div className="field-detail-view">
          <div className="field-detail-header">
            <button
              className="btn-secondary"
              onClick={() => {
                setView("list");
                setViewField(null);
              }}
            >
              <i className="fas fa-arrow-left"></i> Back to Fields
            </button>
            <h2>{viewField.name || "Unnamed Field"}</h2>
          </div>

          <FieldDetailMap coordinates={viewField.coordinates} sprinklerGrid={sprinklerGrid} />

          {/* Sprinkler Grid Legend */}
          <div className="sprinkler-legend">
            <div className="sprinkler-legend-item">
              <span className="legend-dot legend-dot--field"></span>
              <span>Field Boundary</span>
            </div>
            <div className="sprinkler-legend-item">
              <span className="legend-dot legend-dot--sprinkler"></span>
              <span>Sprinkler ({SPRINKLER_RADIUS_FEET}ft radius) × {sprinklerGrid.length}</span>
            </div>
            <div className="sprinkler-legend-item">
              <span className="legend-dot legend-dot--grid"></span>
              <span>Grid Lines</span>
            </div>
          </div>

          <div className="field-detail-info">
            <div className="field-detail-stats">
              <div className="field-stat">
                <i className="fas fa-ruler-combined"></i>
                <div>
                  <span className="field-stat-label">Area</span>
                  <span className="field-stat-value">
                    {viewField.area_sqm ? formatArea(viewField.area_sqm) : "—"}
                  </span>
                </div>
              </div>
              <div className="field-stat">
                <i className="fas fa-tint" style={{ color: '#2196F3' }}></i>
                <div>
                  <span className="field-stat-label">Sprinklers</span>
                  <span className="field-stat-value">
                    {sprinklerGrid.length}
                  </span>
                </div>
              </div>
              <div className="field-stat">
                <i className="fas fa-map-pin"></i>
                <div>
                  <span className="field-stat-label">Boundary Points</span>
                  <span className="field-stat-value">
                    {viewField.coordinates?.length || 0}
                  </span>
                </div>
              </div>
              <div className="field-stat">
                <i className="fas fa-calendar"></i>
                <div>
                  <span className="field-stat-label">Created</span>
                  <span className="field-stat-value">
                    {new Date(viewField.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              {viewField.center && (
                <div className="field-stat">
                  <i className="fas fa-crosshairs"></i>
                  <div>
                    <span className="field-stat-label">Center</span>
                    <span className="field-stat-value">
                      {viewField.center.lat?.toFixed(5)},{" "}
                      {viewField.center.lng?.toFixed(5)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="map-actions" style={{ marginTop: "1rem" }}>
            <button
              className="btn-primary"
              onClick={() => startEdit(viewField)}
            >
              <i className="fas fa-edit"></i> Edit Field
            </button>
            <button
              className="btn-danger"
              onClick={() => {
                handleDeleteField(viewField.id);
                setView("list");
                setViewField(null);
              }}
            >
              <i className="fas fa-trash"></i> Delete Field
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── EDIT FIELD VIEW ───
  if (view === "edit-field" && viewField) {
    const currentCoords = editCoords || viewField.coordinates;
    const editSprinklerGrid = computeSprinklerGrid(currentCoords);
    return (
      <div className="your-field-page">
        <h1>Edit Field</h1>
        <p className="page-subtitle">Update your field name and boundary</p>
        <div className="edit-field-section">
          <div className="field-name-input">
            <label>Field Name:</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="e.g. North Paddy Field"
            />
          </div>

          {!showRedrawMap ? (
            <>
              <FieldDetailMap
                coordinates={currentCoords}
                sprinklerGrid={editSprinklerGrid}
              />
              <div className="edit-boundary-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setShowRedrawMap(true)}
                >
                  <i className="fas fa-draw-polygon"></i> Redraw Boundary
                </button>
                <span className="edit-boundary-hint">
                  <i className="fas fa-info-circle"></i>
                  Click to change the field boundary on the satellite map
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="auto-instructions">
                <i className="fas fa-info-circle"></i>
                <span>
                  Draw the new boundary using the <strong>polygon</strong> or{" "}
                  <strong>rectangle</strong> tool on the left side of the map.
                </span>
              </div>
              <AutoMap onPolygonComplete={setEditCoords} />
              {editCoords && editCoords.length >= 3 && (
                <div className="location-status success">
                  <i className="fas fa-check-circle"></i>
                  New boundary drawn — {editCoords.length} points,{" "}
                  {formatArea(computeArea(editCoords))}
                </div>
              )}
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowRedrawMap(false);
                  setEditCoords(null);
                }}
                style={{ marginTop: "0.5rem" }}
              >
                <i className="fas fa-times"></i> Cancel Redraw
              </button>
            </>
          )}

          <div className="map-actions" style={{ marginTop: "1.5rem" }}>
            <button
              className="btn-secondary"
              onClick={() => {
                setView("view-field");
                setEditCoords(null);
                setShowRedrawMap(false);
              }}
            >
              <i className="fas fa-arrow-left"></i> Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleSaveEdit}
              disabled={saving}
            >
              {saving ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Saving…
                </>
              ) : (
                <>
                  <i className="fas fa-save"></i> Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── MODE SELECTION ───
  if (view === "choose") {
    return (
      <div className="your-field-page">
        <h1>Your Field</h1>
        <p className="page-subtitle">Map your farm and manage your fields</p>
        <div className="mode-selection">
          <h2>How would you like to map your field?</h2>
          <p>Choose the method that works best for you</p>
          <div className="mode-cards">
            <div className="mode-card" onClick={() => setView("manual")}>
              <i className="fas fa-walking mode-icon"></i>
              <h3>Manual (Walk)</h3>
              <p>
                Walk to each corner of your field and tap "Add Point" to record
                GPS coordinates. Best for when you're at your farm.
              </p>
            </div>
            <div className="mode-card" onClick={() => setView("auto")}>
              <i className="fas fa-satellite mode-icon"></i>
              <h3>Automatic (Satellite)</h3>
              <p>
                View your farm on a satellite map and draw the boundary
                directly. Works from anywhere with an internet connection.
              </p>
            </div>
          </div>
          <button
            className="btn-secondary mode-back-btn"
            onClick={() => setView("list")}
          >
            <i className="fas fa-arrow-left"></i> Back
          </button>
        </div>
      </div>
    );
  }

  // ─── MANUAL MODE ───
  if (view === "manual") {
    return (
      <div className="your-field-page">
        <h1>Your Field</h1>
        <p className="page-subtitle">Map your farm and manage your fields</p>
        <div className="manual-mode">
          <h2>
            <i className="fas fa-walking"></i> Manual Mode
          </h2>
          <p>
            Walk to each corner of your field and tap "Add Point" to capture the
            GPS coordinates.
          </p>

          <div className="field-name-input">
            <label>Field Name:</label>
            <input
              type="text"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="e.g. North Paddy Field"
            />
          </div>

          <div className="manual-controls">
            <button
              className="btn-primary"
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
            <div className="point-count">
              <i className="fas fa-draw-polygon"></i>
              {manualPoints.length} point{manualPoints.length !== 1 ? "s" : ""}
            </div>
          </div>

          {geoError && (
            <div className="location-status error">
              <i className="fas fa-exclamation-triangle"></i> {geoError}
            </div>
          )}

          {manualPoints.length > 0 && (
            <div className="coordinate-list">
              <h4>Recorded Points</h4>
              {manualPoints.map((p, i) => (
                <div key={i} className="coord-item">
                  <span className="coord-index">#{i + 1}</span>
                  <span className="coord-values">
                    {p.lat.toFixed(6)}, {p.lng.toFixed(6)}
                  </span>
                  <button
                    className="coord-remove"
                    onClick={() => handleRemovePoint(i)}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ))}
            </div>
          )}

          <ManualMap points={manualPoints} />

          <div className="map-actions">
            <button
              className="btn-secondary"
              onClick={() => {
                setManualPoints([]);
                setView("choose");
              }}
            >
              <i className="fas fa-arrow-left"></i> Back
            </button>
            {manualPoints.length > 0 && (
              <button
                className="btn-secondary"
                onClick={() => setManualPoints([])}
              >
                <i className="fas fa-undo"></i> Clear All
              </button>
            )}
            <button
              className="btn-primary"
              disabled={manualPoints.length < 3 || saving}
              onClick={() => handleSaveField(manualPoints)}
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
      </div>
    );
  }

  // ─── AUTOMATIC / SATELLITE MODE ───
  if (view === "auto") {
    return (
      <div className="your-field-page">
        <h1>Your Field</h1>
        <p className="page-subtitle">Map your farm and manage your fields</p>
        <div className="auto-mode">
          <h2>
            <i className="fas fa-satellite"></i> Satellite Mode
          </h2>
          <p>Draw the boundary of your field on the satellite map below.</p>

          <div className="field-name-input">
            <label>Field Name:</label>
            <input
              type="text"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="e.g. South Wheat Field"
            />
          </div>

          <div className="auto-instructions">
            <i className="fas fa-info-circle"></i>
            <span>
              Use the <strong>polygon</strong> or <strong>rectangle</strong>{" "}
              tool in the toolbar on the left side of the map to draw your field
              boundary. Click on the map to place points, then click the first
              point again to close the shape.
            </span>
          </div>

          <AutoMap onPolygonComplete={setAutoCoords} />

          {autoCoords.length >= 3 && (
            <div className="location-status success">
              <i className="fas fa-check-circle"></i>
              Field boundary drawn — {autoCoords.length} points,{" "}
              {formatArea(computeArea(autoCoords))}
            </div>
          )}

          <div className="map-actions">
            <button
              className="btn-secondary"
              onClick={() => {
                setAutoCoords([]);
                setView("choose");
              }}
            >
              <i className="fas fa-arrow-left"></i> Back
            </button>
            <button
              className="btn-primary"
              disabled={autoCoords.length < 3 || saving}
              onClick={() => handleSaveField(autoCoords)}
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
      </div>
    );
  }

  return null;
}
