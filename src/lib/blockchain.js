/**
 * KrishiMitra Blockchain Simulation Layer
 * 
 * Provides real cryptographic operations (SHA-256 hashing, AES-GCM encryption)
 * with a Supabase-backed storage layer that simulates blockchain behavior.
 * 
 * Architecture:
 *   User data → AES-GCM encrypt → IPFS CID simulation → Smart Contract Registry → Supabase
 *   Token ops → SHA-256 tx hash → ERC-20 ledger simulation → Supabase
 *   Crop Passports → Full lifecycle packaging → Immutable on-chain record → Verifiable
 */

import { supabase } from "./supabase";

// ─── Crypto Helpers (Web Crypto API) ───

async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(typeof message === "string" ? message : JSON.stringify(message));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function deriveKey(seed) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(seed),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: encoder.encode("krishimitra-salt"), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ─── Wallet Generation ───

export async function generateWalletFromEmail(email) {
  const hash = await sha256(email + ":krishimitra-wallet-v1");
  return "0x" + hash.substring(0, 40);
}

// ─── Encryption / Decryption ───

export async function encryptData(data, walletAddress) {
  try {
    const key = await deriveKey(walletAddress);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encoded = encoder.encode(JSON.stringify(data));

    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoded
    );

    return {
      encrypted: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
      iv: btoa(String.fromCharCode(...iv)),
    };
  } catch (e) {
    console.error("Encryption failed:", e);
    return { encrypted: null, iv: null };
  }
}

export async function decryptData(encryptedBase64, ivBase64, walletAddress) {
  try {
    const key = await deriveKey(walletAddress);
    const ciphertext = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  } catch (e) {
    console.error("Decryption failed:", e);
    return null;
  }
}

// ─── Hash to Chain (simulated tx hash) ───

export async function hashToChain(data) {
  const timestamp = Date.now();
  const payload = { data, timestamp, nonce: Math.random() };
  return await sha256(payload);
}

// ─── IPFS CID Simulation ───
// Generates a content-addressed identifier similar to IPFS CIDv1

export async function generateIPFSCid(data) {
  const contentHash = await sha256(data);
  // Simulate IPFS CIDv1 format: Qm + base58-like hash
  return "Qm" + contentHash.substring(0, 44);
}

// ─── Smart Contract Event Log ───
// Simulates an immutable event emitted by the smart contract

export function createContractEvent(eventType, params) {
  return {
    event: eventType,
    blockTimestamp: Math.floor(Date.now() / 1000),
    transactionIndex: Math.floor(Math.random() * 100),
    logIndex: Math.floor(Math.random() * 50),
    contractAddress: "0x4B3F2C1D5E6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C",
    params,
  };
}

// ─── Simulated Block Number ───

let _blockNumber = null;

async function getNextBlockNumber(userId) {
  if (_blockNumber === null) {
    const { count } = await supabase
      .from("blockchain_records")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    _blockNumber = (count || 0) + 1;
  } else {
    _blockNumber++;
  }
  return _blockNumber;
}

// ─── Blockchain Record Operations ───

export async function createBlockchainRecord(userId, recordType, data, walletAddress) {
  if (!userId || !walletAddress) return { error: "Missing userId or wallet" };

  const dataHash = await hashToChain(data);
  const { encrypted, iv } = await encryptData(data, walletAddress);
  const blockNumber = await getNextBlockNumber(userId);
  const ipfsCid = await generateIPFSCid(data);

  // Simulate smart contract event
  const event = createContractEvent("RecordAdded", {
    owner: walletAddress,
    recordType,
    ipfsCid,
    dataHash,
    blockNumber,
  });

  const { error } = await supabase.from("blockchain_records").insert({
    user_id: userId,
    record_type: recordType,
    data_hash: dataHash,
    encrypted_data: encrypted,
    encryption_iv: iv,
    block_number: blockNumber,
    ipfs_cid: ipfsCid,
    contract_event: event,
  });

  return { txHash: dataHash, blockNumber, ipfsCid, event, error };
}

export async function getBlockchainRecords(userId) {
  const { data, error } = await supabase
    .from("blockchain_records")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return { records: data || [], error };
}

export async function getBlockchainRecordCount(userId) {
  const { count, error } = await supabase
    .from("blockchain_records")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  return { count: count || 0, error };
}

// ─── $KRISHI Token Operations ───

export async function getTokenBalance(userId) {
  const { data, error } = await supabase
    .from("krishi_tokens")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (error && error.code === "PGRST116") {
    // No row found — create one with 0 balance
    await supabase.from("krishi_tokens").insert({ user_id: userId, balance: 0 });
    return { balance: 0, error: null };
  }

  return { balance: data?.balance || 0, error };
}

export async function awardTokens(userId, amount, reason) {
  if (!userId || !amount) return { error: "Missing params" };

  // Get current balance
  const { balance } = await getTokenBalance(userId);
  const newBalance = balance + amount;

  // Update balance
  const { error: updateError } = await supabase
    .from("krishi_tokens")
    .upsert(
      { user_id: userId, balance: newBalance, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  // Log transaction
  const txHash = await hashToChain({ userId, amount, reason, timestamp: Date.now() });
  const { error: txError } = await supabase.from("token_transactions").insert({
    user_id: userId,
    amount,
    reason,
    tx_hash: txHash,
  });

  return { newBalance, txHash, error: updateError || txError };
}

export async function getTokenTransactions(userId) {
  const { data, error } = await supabase
    .from("token_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return { transactions: data || [], error };
}

// ─── Crop Passport ───

export async function createCropPassport(userId, walletAddress, fieldData, diseaseHistory, sprinklerHistory) {
  const passportData = {
    farmerId: userId,
    fieldName: fieldData.name,
    fieldArea: fieldData.area_sqm,
    fieldCoordinates: fieldData.coordinates,
    diseaseHistory: (diseaseHistory || []).map((d) => ({
      disease: d.disease_name || d.diseaseName || "Unknown",
      severity: d.severity || "N/A",
      confidence: d.confidence || "N/A",
      detectedAt: d.created_at || new Date().toISOString(),
      treatment: d.treatment || [],
    })),
    irrigationHistory: (sprinklerHistory || []).map((s) => ({
      plan: s.disease_name || s.diseaseName || "General",
      schedule: s.sprinkler_schedule || s.sprinklerSchedule || [],
      sprayCount: s.spray_count || s.sprayCount || 0,
      status: s.status || "active",
      createdAt: s.created_at || new Date().toISOString(),
    })),
    lifecycle: {
      totalDiseaseEvents: (diseaseHistory || []).length,
      totalTreatments: (sprinklerHistory || []).length,
      healthScore: calculateHealthScore(diseaseHistory),
      organicCompliant: checkOrganicCompliance(diseaseHistory),
    },
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    version: "2.0",
    standard: "KrishiMitra-CP-v2",
  };

  const passportHash = await sha256(passportData);
  const ipfsCid = await generateIPFSCid(passportData);

  // Store as a blockchain record
  const { txHash, blockNumber, error } = await createBlockchainRecord(
    userId,
    "crop_passport",
    passportData,
    walletAddress
  );

  // Award tokens
  if (!error) {
    await awardTokens(userId, 25, "crop_passport_created");
  }

  return {
    passport: { ...passportData, hash: passportHash, txHash, blockNumber, ipfsCid },
    error,
  };
}

function calculateHealthScore(diseaseHistory) {
  if (!diseaseHistory || diseaseHistory.length === 0) return 100;
  const severityScores = { none: 100, low: 85, medium: 65, high: 35 };
  const scores = diseaseHistory.map((d) => {
    const sev = (d.severity || "none").toLowerCase();
    return severityScores[sev] || 70;
  });
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function checkOrganicCompliance(diseaseHistory) {
  if (!diseaseHistory || diseaseHistory.length === 0) return true;
  // If any treatment contains non-organic keywords, return false
  const nonOrganicKeywords = ["synthetic", "chemical", "inorganic"];
  for (const d of diseaseHistory) {
    const treatments = Array.isArray(d.treatment) ? d.treatment : [d.treatment];
    for (const t of treatments) {
      if (t && nonOrganicKeywords.some((k) => String(t).toLowerCase().includes(k))) {
        return false;
      }
    }
  }
  return true;
}

export async function verifyCropPassport(passportData) {
  const { hash: storedHash, txHash, blockNumber, ipfsCid, ...rawData } = passportData;
  const recalculatedHash = await sha256(rawData);
  return {
    verified: recalculatedHash === storedHash,
    originalHash: storedHash,
    recalculatedHash,
    ipfsCid: ipfsCid || null,
  };
}

// ─── Passport Share Link Generation ───

export function generatePassportShareData(passport) {
  return {
    fieldName: passport.fieldName,
    healthScore: passport.lifecycle?.healthScore || 100,
    organicCompliant: passport.lifecycle?.organicCompliant ?? true,
    totalDiseaseEvents: passport.lifecycle?.totalDiseaseEvents || 0,
    totalTreatments: passport.lifecycle?.totalTreatments || 0,
    hash: passport.hash,
    ipfsCid: passport.ipfsCid,
    generatedAt: passport.generatedAt,
    expiresAt: passport.expiresAt,
    version: passport.version,
  };
}

// ─── $KRISHI Token Spending ───

export async function spendTokens(userId, amount, purpose) {
  if (!userId || !amount) return { error: "Missing params" };

  const { balance } = await getTokenBalance(userId);
  if (balance < amount) return { error: "Insufficient balance", balance };

  const newBalance = balance - amount;

  const { error: updateError } = await supabase
    .from("krishi_tokens")
    .upsert(
      { user_id: userId, balance: newBalance, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  const txHash = await hashToChain({ userId, amount: -amount, purpose, timestamp: Date.now() });
  const { error: txError } = await supabase.from("token_transactions").insert({
    user_id: userId,
    amount: -amount,
    reason: purpose,
    tx_hash: txHash,
  });

  return { newBalance, txHash, error: updateError || txError };
}

// ─── Blockchain Statistics ───

export async function getBlockchainStats(userId) {
  const [records, tokens, transactions] = await Promise.all([
    getBlockchainRecords(userId),
    getTokenBalance(userId),
    getTokenTransactions(userId),
  ]);

  const recByType = {};
  (records.records || []).forEach((r) => {
    recByType[r.record_type] = (recByType[r.record_type] || 0) + 1;
  });

  const totalEarned = (transactions.transactions || [])
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const totalSpent = (transactions.transactions || [])
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return {
    totalRecords: records.records?.length || 0,
    recordsByType: recByType,
    tokenBalance: tokens.balance || 0,
    totalEarned,
    totalSpent,
    totalTransactions: transactions.transactions?.length || 0,
    passportCount: recByType.crop_passport || 0,
  };
}
