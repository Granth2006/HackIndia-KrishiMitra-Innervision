import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env", "utf8");
let url = "";
let key = "";
for (const line of env.split("\n")) {
  if (line.startsWith("VITE_SUPABASE_URL=")) url = line.split("=")[1].trim();
  if (line.startsWith("VITE_SUPABASE_ANON_KEY=")) key = line.split("=")[1].trim();
}

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from("push_subscriptions").select("*");
  fs.writeFileSync("subs.json", JSON.stringify(data, null, 2));
  console.log("Wrote subs.json");
}

check();
