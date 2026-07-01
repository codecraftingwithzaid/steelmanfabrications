// Provisions (or updates) the first admin account.
// Usage: node scripts/seed-admin.mjs   (loads env from .env.local / .env)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Minimal .env loader so the script works without extra deps.
for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* file optional */
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
const name = process.env.SEED_ADMIN_NAME || "Steelman Admin";

if (!url || !serviceKey || !email || !password) {
  console.error(
    "Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD.",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: created, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: name, role: "admin" },
});

let userId = created?.user?.id;

if (error) {
  if (!/already|registered|exists/i.test(error.message)) {
    console.error("createUser failed:", error.message);
    process.exit(1);
  }
  // Already exists — find the user id and reset the password to match .env.
  const { data: list } = await admin.auth.admin.listUsers();
  userId = list.users.find((u) => u.email === email)?.id;
  if (userId) {
    const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: name, role: "admin" },
    });
    if (pwErr) {
      console.error("password reset failed:", pwErr.message);
      process.exit(1);
    }
    console.log("Admin user already existed — password reset to match .env.");
  }
}

if (!userId) {
  console.error("Could not resolve admin user id.");
  process.exit(1);
}

const { error: upErr } = await admin
  .from("profiles")
  .upsert({ id: userId, full_name: name, email, role: "admin" });

if (upErr) {
  console.error("profile upsert failed:", upErr.message);
  process.exit(1);
}

console.log(`✅ Admin ready: ${email}`);
