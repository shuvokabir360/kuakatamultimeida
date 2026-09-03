import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function normalizeBd(m: string) {
  const digits = (m || "").replace(/\D/g, "");
  if (!digits) return "";
  // accept 11-digit (01XXXXXXXXX) or 13-digit (8801XXXXXXXXX)
  if (digits.length === 11 && digits.startsWith("0")) return `880${digits.slice(1)}`;
  if (digits.length === 13 && digits.startsWith("880")) return digits;
  if (digits.length === 10 && digits.startsWith("1")) return `880${digits}`;
  return "";
}

async function sendOne(mobile: string, message: string) {
  const apiKey = process.env.BULKSMSBD_API_KEY;
  const senderId = process.env.BULKSMSBD_SENDER_ID;
  if (!apiKey || !senderId) throw new Error("SMS provider not configured");
  const body = new URLSearchParams();
  body.set("api_key", apiKey);
  body.set("type", /[^\x00-\x7F]/.test(message) ? "unicode" : "text");
  body.set("number", mobile);
  body.set("senderid", senderId);
  body.set("message", message);
  const res = await fetch("https://bulksmsbd.net/api/smsapi", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
  });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch {}
  const code = parsed?.response_code;
  if (!res.ok || code !== 202) {
    const errMsg = parsed?.error_message || parsed?.success_message || parsed?.message || text || `HTTP ${res.status}`;
    throw new Error(errMsg);
  }
}

export const sendBulkSmsToMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberIds: string[]; message: string }) => d)
  .handler(async ({ data, context }) => {
    const message = (data.message || "").trim();
    if (!message) throw new Error("ম্যাসেজ লিখুন");
    if (message.length > 1000) throw new Error("ম্যাসেজ অনেক বড়");
    if (!data.memberIds?.length) throw new Error("কমপক্ষে একজন সদস্য সিলেক্ট করুন");

    const { supabase } = context;
    const { data: members, error } = await supabase
      .from("members")
      .select("id,name,phone")
      .in("id", data.memberIds);
    if (error) throw new Error(error.message);

    const results: { id: string; name: string; phone: string | null; ok: boolean; error?: string }[] = [];
    for (const m of members ?? []) {
      const intl = normalizeBd(m.phone || "");
      if (!intl) {
        results.push({ id: m.id, name: m.name, phone: m.phone, ok: false, error: "অবৈধ মোবাইল নাম্বার" });
        continue;
      }
      try {
        await sendOne(intl, message);
        results.push({ id: m.id, name: m.name, phone: m.phone, ok: true });
      } catch (e: any) {
        results.push({ id: m.id, name: m.name, phone: m.phone, ok: false, error: e?.message || "ব্যর্থ" });
      }
    }
    const sent = results.filter((r) => r.ok).length;
    const failed = results.length - sent;
    return { sent, failed, results };
  });

export const getBulkSmsBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const apiKey = process.env.BULKSMSBD_API_KEY;
    const senderId = process.env.BULKSMSBD_SENDER_ID;
    if (!apiKey) throw new Error("SMS provider not configured");
    const url = `https://bulksmsbd.net/api/getBalanceApi?api_key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    const text = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch {}
    return { senderId, raw: text, parsed };
  });
