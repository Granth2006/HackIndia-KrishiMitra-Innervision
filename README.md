<div align="center">
  <img src="public/krishimitra.png" alt="KrishiMitra Logo" width="120" style="border-radius: 50%;"/>
  <h1 align="center">🌱 KrishiMitra AI</h1>
  <p align="center">
    <strong>Smart Farming Platform with AI-Powered Irrigation, Disease Detection, and Crop Recommendations</strong>
  </p>
  
  <p align="center">
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" /></a>
    <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" /></a>
    <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=green" alt="Supabase" /></a>
    <a href="https://vercel.com/"><img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" /></a>
    <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript"><img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" /></a>
  </p>
</div>

<br />

<div align="center">
  <h3>Built to Empower Indian Farmers with Cutting-Edge Technology 🇮🇳</h3>
</div>

<hr />

## 🌟 Overview

**KrishiMitra AI** is a comprehensive, modern web application designed to help farmers optimize their agricultural processes. It integrates leading AI tools for disease detection, personalized crop recommendations, real-time weather analytics, and smart automated irrigation—all enhanced by a secure Blockchain layer that protects user data and offers a native reward system ($KRISHI token).

## ✨ Key Features

<ul>
  <li><strong>🌿 AI Disease Detection:</strong> Upload photos of crops to identify diseases instantly and get treatment recommendations. Includes a full field creation flow (manual walk & satellite draw).</li>
  <li><strong>🌾 Smart Crop Recommendation:</strong> Get personalized suggestions on what to plant based on your specific soil and environment data.</li>
  <li><strong>💧 Automated Sprinkler System:</strong> Manage your irrigation system seamlessly through an interactive dashboard with automatic planning capabilities.</li>
  <li><strong>🤖 AI Chat Assistant:</strong> Multilingual smart chatbot to help answer farming queries on the go.</li>
  <li><strong>⛓️ Web3 & Blockchain Integration:</strong> Verifiable Crop Passports, IPFS decentralized data storage, and $KRISHI token rewards. Includes a centralized simulation layer for testing.</li>
  <li><strong>🛒 Marketplace:</strong> Dedicated area for agricultural products and equipment.</li>
  <li><strong>🌍 Multilingual Support:</strong> Floating translation widgets syncing across the app to make it accessible to everyone.</li>
  <li><strong>🔔 Real-Time Browser Notifications:</strong> Get alerted instantly across devices.</li>
  <li><strong>📄 PDF Export:</strong> Downloadable, comprehensive PDF reports for disease detection and user profiling.</li>
  <li><strong>🛠️ Admin Panel:</strong> Centralized dashboard for managing platform settings and users.</li>
</ul>

## 🛠️ Technology Stack

<table align="center" width="100%">
  <tr>
    <td align="center" width="33%">
      <h3>Frontend</h3>
      <p>React 19 & Vite</p>
      <p>Framer Motion</p>
      <p>Leaflet & React Leaflet</p>
      <p>Vanilla CSS & Font Awesome</p>
    </td>
    <td align="center" width="33%">
      <h3>Backend & API</h3>
      <p>Vercel Serverless Functions</p>
      <p>Node.js & Express</p>
      <p>Web Push</p>
      <p>Python App Integration</p>
    </td>
    <td align="center" width="33%">
      <h3>Database & Auth</h3>
      <p>Supabase</p>
      <p>Google OAuth</p>
      <p>IPFS via Blockchain Layer</p>
    </td>
  </tr>
</table>

## 🚀 Getting Started

Follow these steps to set up the project locally on your machine.

### Prerequisites

- **Node.js**: Make sure you have Node installed (v18 or higher is recommended).
- **npm** or **yarn**: Used for managing dependencies.
- **Supabase Account**: Required to set up the database and authentication.

### Installation

<details>
<summary><b>1. Clone the repository</b></summary>

```bash
git clone https://github.com/Granth2006/KrishiMitra-Innervision.git
cd "krishimitra main"
```
</details>

<details>
<summary><b>2. Install dependencies</b></summary>

```bash
npm install
```
</details>

<details>
<summary><b>3. Set up Environment Variables</b></summary>

Create a `.env` file in the root directory and add the necessary variables:

```env
WEATHER_API_KEY= your weather api key

GROQ_API_KEY_1= your groq api key

# Supabase
VITE_SUPABASE_URL=  your vite supabase url  
VITE_SUPABASE_ANON_KEY= your vite supabase anon key

# Admin Dashboard
ADMIN_USERNAME= your username
ADMIN_PASSWORD= your password

# VAPID Keys for Push Notifications
VAPID_PUBLIC_KEY= your vapid public key
VAPID_PRIVATE_KEY= your vapid private key
VITE_VAPID_PUBLIC_KEY= your vite vapid public key
```
</details>

<details>
<summary><b>4. Run the Development Server</b></summary>

```bash
# Start Vite frontend dev server
npm run dev

# (Optional) Run local serverless API server
npm run dev:api
```

Open [http://localhost:5173](http://localhost:5173) to view it in your browser.
</details>

<br/>

## 📁 Project Structure

```text
krishimitra main/
├── api/                  # Vercel Serverless Functions (AI, Notifications, Admin)
├── public/               # Static assets & Manifests for PWA
├── src/                  # React Frontend Source
│   ├── components/       # Reusable UI Components
│   ├── context/          # Global Context Providers
│   ├── hooks/            # Custom React Hooks
│   ├── lib/              # Utility libraries & Blockchain Simulations
│   └── pages/            # App Routes (Dashboard, Disease, Sprinkler, Blockchain)
├── .env                  # Local Environment Variables 
├── app.py                # Underlying Python service integrations
├── dev-server.js         # Local API development server
├── index.html            # Main HTML App entrypoint
└── vite.config.js        # Vite builder configuration
```

<hr />

<div align="center">
  <p>Made with ❤️ to revolutionize agriculture by Granth, Yash, and Shreeya</p>
</div>
