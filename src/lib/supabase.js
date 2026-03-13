import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── User Operations ───

export async function upsertUser({ email, name, picture, location }) {
  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        email,
        name,
        picture,
        location,
        is_guest: false,
        last_login: new Date().toISOString(),
      },
      { onConflict: "email" },
    )
    .select()
    .single();
  return { user: data, error };
}

export async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();
  return { user: data, error };
}

export async function updateUserProfile(userId, updates) {
  const { error } = await supabase
    .from("users")
    .update({ ...updates, last_login: new Date().toISOString() })
    .eq("id", userId);
  return { error };
}

// ─── Service Logging ───

export async function logService(userId, service, formData, resultData) {
  if (!userId) return { error: "No user ID" };
  const { error } = await supabase.from("service_logs").insert({
    user_id: userId,
    service,
    form_data: formData || null,
    result_data: resultData || null,
  });
  return { error };
}

// ─── Guest Limit (localStorage only, no server tracking) ───

export function hasGuestUsedService(service) {
  return localStorage.getItem(`krishimitra_guest_${service}`) === "true";
}

export function markGuestServiceUsed(service) {
  localStorage.setItem(`krishimitra_guest_${service}`, "true");
}

// ─── Chat Operations ───

export async function getChatHistory(userId) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return { messages: data || [], error };
}

export async function saveChatMessage(userId, role, text, imageUrl = null) {
  if (!userId) return { error: "No user ID" };
  const { error } = await supabase.from("chat_messages").insert({
    user_id: userId,
    role,
    text,
    image_url: imageUrl,
  });
  return { error };
}

// ─── Sprinkler Plans ───

export async function getSprinklerPlans(userId) {
  const { data, error } = await supabase
    .from("sprinkler_plans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return { plans: data || [], error };
}

export async function saveSprinklerPlan(userId, plan) {
  const { data, error } = await supabase
    .from("sprinkler_plans")
    .insert({
      user_id: userId,
      disease_name: plan.diseaseName,
      severity: plan.severity,
      confidence: plan.confidence,
      symptoms: plan.symptoms,
      causes: plan.causes,
      treatment: plan.treatment,
      prevention: plan.prevention,
      additional_tips: plan.additionalTips,
      irrigation_plan: plan.irrigationPlan,
      pesticide: plan.pesticide,
      soil_suggestions: plan.soilSuggestions,
      sprinkler_schedule: plan.sprinklerSchedule,
      image_url: plan.imageBase64 || null,
      user_coords: plan.userCoords || null,
      field_name: plan.fieldName || null,
      spray_count: 0,
      status: "active",
    })
    .select()
    .single();
  return { plan: data, error };
}

export async function updatePlanSprayCount(planId, newCount) {
  const { error } = await supabase
    .from("sprinkler_plans")
    .update({ spray_count: newCount })
    .eq("id", planId);
  return { error };
}

export async function deleteSprinklerPlan(planId) {
  const { error } = await supabase
    .from("sprinkler_plans")
    .delete()
    .eq("id", planId);
  return { error };
}

// ─── User Fields (Virtual Farm Maps) ───

export async function getUserFields(userId) {
  const { data, error } = await supabase
    .from("user_fields")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return { fields: data || [], error };
}

export async function saveUserField(userId, fieldData) {
  const { data, error } = await supabase
    .from("user_fields")
    .insert({
      user_id: userId,
      name: fieldData.name || "My Field",
      coordinates: fieldData.coordinates,
      area_sqm: fieldData.area_sqm || null,
      center: fieldData.center || null,
    })
    .select()
    .single();
  return { field: data, error };
}

export async function updateUserField(fieldId, updates) {
  const { error } = await supabase
    .from("user_fields")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", fieldId);
  return { error };
}

export async function deleteUserField(fieldId) {
  const { error } = await supabase
    .from("user_fields")
    .delete()
    .eq("id", fieldId);
  return { error };
}
