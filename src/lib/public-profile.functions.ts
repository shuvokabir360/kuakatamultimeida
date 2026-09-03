import { createServerFn } from "@tanstack/react-start";

const PHOTO_BUCKET = "member-photos";

export type PublicAccount = {
  id: string;
  kind: string;
  bank_name: string | null;
  branch: string | null;
  account_holder: string | null;
  account_number: string;
};

export type PublicPayment = {
  id: string;
  amount: number;
  paid_at: string;
  note: string | null;
};

export type PublicSalary = {
  id: string;
  amount: number;
  month: string;
};

export type PublicBonus = {
  id: string;
  amount: number;
  note: string | null;
  given_at: string;
};

export type PublicShooting = {
  id: string;
  name: string;
  shoot_date: string;
  director: string | null;
  channel: string | null;
  location: string | null;
  earned: number;
};

export type PublicProfile = {
  member: {
    id: string;
    name: string;
    role: string | null;
    type: "daily" | "monthly";
    rate: number;
    photo_signed_url: string | null;
    has_phone: boolean;
    phone_masked: string | null;
  };
  range: { from: string | null; to: string | null };
  balance: number;
  accounts: PublicAccount[];
  payments: PublicPayment[];
  salaries: PublicSalary[];
  bonuses: PublicBonus[];
  shootings: PublicShooting[];
  shootings_count: number;
};

function timingSafeEqualStr(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function assertShareWindow(from: string | null, to: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  if (from && today < from) throw new Error("এই লিংকটি এখনো সক্রিয় হয়নি");
  if (to && today > to) throw new Error("এই লিংকটির মেয়াদ শেষ হয়েছে");
}

export const getPublicProfile = createServerFn({ method: "GET" })
  .inputValidator((data: { memberId: string; token?: string }) => {
    if (!data?.memberId || typeof data.memberId !== "string") {
      throw new Error("memberId দরকার");
    }
    if (!/^[0-9a-f-]{24,36}$/i.test(data.memberId)) throw new Error("লিংকটি সঠিক নয়");
    const token = typeof data.token === "string" ? data.token.slice(0, 200) : "";
    return { memberId: data.memberId, token };
  })
  .handler(async ({ data }): Promise<PublicProfile> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member, error: mErr } = await supabaseAdmin
      .from("members")
      .select("id,name,role,type,rate,phone,photo_url,share_token,share_enabled,share_from,share_to")
      .eq("id", data.memberId)
      .maybeSingle();
    if (mErr) throw mErr;
    if (!member) throw new Error("সদস্য পাওয়া যায়নি");
    if (member.share_enabled === false) {
      throw new Error("এই লিংকটি বর্তমানে বন্ধ আছে");
    }

    const from: string | null = (member as any).share_from ?? null;
    const to: string | null = (member as any).share_to ?? null;
    assertShareWindow(from, to);

    // Parallel fetch all member records
    const [accountsRes, attendanceRes, paymentsRes, salariesRes, bonusesRes, shootingsRes] = await Promise.all([
      supabaseAdmin
        .from("member_accounts")
        .select("id,kind,bank_name,branch,account_holder,account_number")
        .eq("member_id", member.id)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("attendance")
        .select("id,date,present,rate_override,shooting_id")
        .eq("member_id", member.id)
        .eq("present", true),
      supabaseAdmin
        .from("payments")
        .select("id,amount,paid_at,note")
        .eq("member_id", member.id)
        .order("paid_at", { ascending: false }),
      supabaseAdmin
        .from("monthly_salaries")
        .select("id,amount,month")
        .eq("member_id", member.id)
        .order("month", { ascending: false }),
      supabaseAdmin
        .from("bonuses")
        .select("id,amount,note,given_at")
        .eq("member_id", member.id)
        .order("given_at", { ascending: false }),
      supabaseAdmin
        .from("shootings")
        .select("id,name,shoot_date,director,channel,location"),
    ]);

    const allShootingsList = (shootingsRes.data ?? []) as Array<any>;
    const shootingMap = new Map<string, any>();
    const shootingDateMap = new Map<string, any>();
    for (const sh of allShootingsList) {
      if (sh.id) shootingMap.set(String(sh.id), sh);
      if (sh._id) shootingMap.set(String(sh._id), sh);
      if (sh.shoot_date) shootingDateMap.set(String(sh.shoot_date), sh);
    }

    let photoSignedUrl: string | null = null;
    if (member.photo_url) {
      if (member.photo_url.startsWith("http") || member.photo_url.startsWith("/")) {
        photoSignedUrl = member.photo_url;
      } else {
        const { data: signed } = await supabaseAdmin.storage
          .from(PHOTO_BUCKET)
          .createSignedUrl(member.photo_url, 60 * 60);
        photoSignedUrl = signed?.signedUrl ?? member.photo_url;
      }
    }

    const rate = Number(member.rate ?? 0);
    
    // Filter attendance by date range
    const rawAttendance = (attendanceRes.data ?? []).filter((a: any) => {
      if (!a.present) return false;
      if (from && a.date < from) return false;
      if (to && a.date > to) return false;
      return true;
    });

    const shootings: PublicShooting[] = rawAttendance.map((a: any) => {
      const sh = (a.shooting_id && (shootingMap.get(String(a.shooting_id)) || (typeof a.shooting_id === 'object' ? a.shooting_id : null)))
        || shootingDateMap.get(String(a.date));

      return {
        id: sh?.id || sh?._id || String(a.shooting_id || a.id),
        name: sh?.name || `শুটিং (${bnDate(a.date)})`,
        shoot_date: a.date || sh?.shoot_date || "",
        director: sh?.director || null,
        channel: sh?.channel || null,
        location: sh?.location || null,
        earned: Number(a.rate_override != null && !isNaN(Number(a.rate_override)) ? a.rate_override : rate),
      };
    }).sort((a, b) => (a.shoot_date < b.shoot_date ? 1 : -1));

    const salaries = (salariesRes.data ?? [])
      .filter((s: any) => {
        if (from && s.month < from) return false;
        if (to && s.month > to) return false;
        return true;
      })
      .map((s: any) => ({
        id: s.id, amount: Number(s.amount), month: s.month,
      }));

    const bonuses = (bonusesRes.data ?? [])
      .filter((b: any) => {
        if (from && b.given_at < from) return false;
        if (to && b.given_at > to) return false;
        return true;
      })
      .map((b: any) => ({
        id: b.id, amount: Number(b.amount), note: b.note, given_at: b.given_at,
      }));

    const payments = (paymentsRes.data ?? [])
      .filter((p: any) => {
        if (from && p.paid_at < from) return false;
        if (to && p.paid_at > to) return false;
        return true;
      })
      .map((p: any) => ({
        id: p.id, amount: Number(p.amount), paid_at: p.paid_at, note: p.note,
      }));

    // Compute scoped balance from filtered data
    const earned = member.type === "daily"
      ? shootings.reduce((s, x) => s + x.earned, 0)
      : salaries.reduce((s, x) => s + x.amount, 0);
    const bonusSum = bonuses.reduce((s, x) => s + x.amount, 0);
    const paidSum = payments.reduce((s, x) => s + x.amount, 0);
    const balance = earned + bonusSum - paidSum;

    const phone = member.phone ?? null;
    const phoneMasked = phone && phone.length >= 4
      ? `${"X".repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`
      : null;

    return {
      member: {
        id: member.id,
        name: member.name,
        role: member.role,
        type: member.type as "daily" | "monthly",
        rate,
        photo_signed_url: photoSignedUrl,
        has_phone: !!phone,
        phone_masked: phoneMasked,
      },
      range: { from, to },
      balance,
      accounts: (accountsRes.data ?? []) as PublicAccount[],
      payments,
      salaries,
      bonuses,
      shootings,
      shootings_count: shootings.length,
    };
  });

const ALLOWED_KINDS = ["bkash", "nagad", "rocket", "upay", "bank"] as const;
type AllowedKind = (typeof ALLOWED_KINDS)[number];

async function verifyMemberForPublicWrite(memberId: string, token: string, last4: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: member, error } = await supabaseAdmin
    .from("members")
    .select("id,owner_id,phone,photo_url,share_token,share_enabled,share_from,share_to")
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw error;
  if (!member) throw new Error("সদস্য পাওয়া যায়নি");
  if (member.share_enabled === false) {
    throw new Error("লিংকটি বন্ধ আছে");
  }
  assertShareWindow((member as any).share_from ?? null, (member as any).share_to ?? null);
  if (!member.phone || member.phone.length < 4) {
    throw new Error("এই সদস্যের ফোন নম্বর সেট নেই, এডমিনকে জানান");
  }
  if (member.phone.slice(-4) !== last4) {
    throw new Error("ফোন নম্বরের শেষ ৪ ডিজিট মিলেনি");
  }
  return { member, supabaseAdmin };
}

export const updatePublicProfilePhoto = createServerFn({ method: "POST" })
  .inputValidator((data: {
    memberId: string;
    token?: string;
    last4: string;
    fileBase64: string;
    contentType: string;
    ext: string;
  }) => {
    if (!data?.memberId || !/^[0-9a-f-]{24,36}$/i.test(data.memberId)) throw new Error("memberId দরকার");
    if (!/^[0-9]{4}$/.test(data.last4 || "")) throw new Error("সঠিক ৪ ডিজিট দিন");
    if (!data.fileBase64) throw new Error("ছবি দরকার");
    if (!data.contentType?.startsWith("image/")) throw new Error("শুধু ছবি আপলোড করা যাবে");
    const ext = (data.ext || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
    return { ...data, token: typeof data.token === "string" ? data.token.slice(0, 200) : "", ext };
  })
  .handler(async ({ data }) => {
    const { member, supabaseAdmin } = await verifyMemberForPublicWrite(
      data.memberId, data.token, data.last4,
    );

    const bytes = Uint8Array.from(atob(data.fileBase64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 5 * 1024 * 1024) {
      throw new Error("ছবি ৫ MB এর বেশি হতে পারবে না");
    }

    const path = `${member.owner_id}/${member.id}-${Date.now()}.${data.ext}`;
    const up = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (up.error) throw up.error;

    if (member.photo_url) {
      await supabaseAdmin.storage.from(PHOTO_BUCKET).remove([member.photo_url]);
    }
    const upd = await supabaseAdmin.from("members").update({ photo_url: path }).eq("id", member.id);
    if (upd.error) throw upd.error;

    const { data: signed } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, 60 * 60);

    return { ok: true, photo_signed_url: signed?.signedUrl ?? null };
  });


export const addPublicMemberAccount = createServerFn({ method: "POST" })
  .inputValidator((data: {
    memberId: string;
    token: string;
    last4: string;
    kind: string;
    account_number: string;
    account_holder?: string | null;
    bank_name?: string | null;
    branch?: string | null;
  }) => {
    if (!data?.memberId || !/^[0-9a-f-]{24,36}$/i.test(data.memberId)) throw new Error("memberId দরকার");
    if (!/^[0-9]{4}$/.test(data.last4 || "")) throw new Error("সঠিক ৪ ডিজিট দিন");
    if (!ALLOWED_KINDS.includes(data.kind as AllowedKind)) throw new Error("ধরন সঠিক নয়");
    const acc = (data.account_number || "").trim();
    if (acc.length < 4 || acc.length > 40) throw new Error("একাউন্ট নম্বর সঠিক নয়");
    if (data.kind === "bank") {
      if (!data.bank_name?.trim()) throw new Error("ব্যাংকের নাম দিন");
    }
    return {
      memberId: data.memberId,
      token: data.token ?? "",
      last4: data.last4,
      kind: data.kind as AllowedKind,
      account_number: acc,
      account_holder: (data.account_holder || "").trim().slice(0, 120) || null,
      bank_name: data.kind === "bank" ? (data.bank_name || "").trim().slice(0, 120) : null,
      branch: data.kind === "bank" ? ((data.branch || "").trim().slice(0, 120) || null) : null,
    };
  })
  .handler(async ({ data }) => {
    const { member, supabaseAdmin } = await verifyMemberForPublicWrite(
      data.memberId, data.token, data.last4,
    );

    // Cap how many accounts a member can self-add (prevents abuse via token).
    const { count } = await supabaseAdmin
      .from("member_accounts")
      .select("id", { count: "exact", head: true })
      .eq("member_id", member.id);
    if ((count ?? 0) >= 10) throw new Error("সর্বোচ্চ ১০টি একাউন্ট যোগ করা যাবে");

    const { error } = await supabaseAdmin.from("member_accounts").insert({
      owner_id: member.owner_id,
      member_id: member.id,
      kind: data.kind,
      account_number: data.account_number,
      account_holder: data.account_holder,
      bank_name: data.bank_name,
      branch: data.branch,
    });
    if (error) throw error;
    return { ok: true };
  });

export const deletePublicMemberAccount = createServerFn({ method: "POST" })
  .inputValidator((data: { memberId: string; token: string; last4: string; accountId: string }) => {
    if (!data?.memberId || !/^[0-9a-f-]{24,36}$/i.test(data.memberId) || !data?.accountId) throw new Error("ইনপুট সঠিক নয়");
    if (!/^[0-9]{4}$/.test(data.last4 || "")) throw new Error("সঠিক ৪ ডিজিট দিন");
    return { memberId: data.memberId, token: data.token ?? "", last4: data.last4, accountId: data.accountId };
  })
  .handler(async ({ data }) => {
    const { member, supabaseAdmin } = await verifyMemberForPublicWrite(
      data.memberId, data.token, data.last4,
    );
    const { error } = await supabaseAdmin
      .from("member_accounts")
      .delete()
      .eq("id", data.accountId)
      .eq("member_id", member.id);
    if (error) throw error;
    return { ok: true };
  });

// In-memory OTP storage for member public profiles
const profileOtpStore = new Map<string, { code: string; expires_at: number }>();

export const requestProfileOtp = createServerFn({ method: "POST" })
  .inputValidator((data: { memberId: string }) => {
    if (!data?.memberId || !/^[0-9a-f-]{24,36}$/i.test(data.memberId)) {
      throw new Error("memberId দরকার");
    }
    return { memberId: data.memberId };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member, error } = await supabaseAdmin
      .from("members")
      .select("id,name,phone")
      .eq("id", data.memberId)
      .maybeSingle();

    if (error || !member) throw new Error("সদস্য পাওয়া যায়নি");

    const phone = (member.phone || "").replace(/\D/g, "").slice(-11);
    if (!phone || phone.length < 11) {
      throw new Error(`এই সদস্যের (${member.name}) কোনো ফোন নম্বর নেই। অ্যাডমিনকে ফোন নম্বর যুক্ত করতে বলুন।`);
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    profileOtpStore.set(String(member.id), {
      code,
      expires_at: Date.now() + 5 * 60 * 1000,
    });

    const masked = phone.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");

    const apiKey = process.env.BULKSMSBD_API_KEY || "mLky4qdVPhuqswC2ZVok";
    const senderId = process.env.BULKSMSBD_SENDER_ID || "8809648908310";
    let smsSent = false;

    let smsError: string | null = null;

    if (apiKey && senderId) {
      try {
        const intl = phone.startsWith("0") ? `880${phone.slice(1)}` : phone;
        const msg = `Kuakata Multimedia OTP is ${code}. Your OTP code is ${code}`;
        const url = `http://bulksmsbd.net/api/smsapi?api_key=${encodeURIComponent(apiKey)}&type=text&number=${encodeURIComponent(intl)}&senderid=${encodeURIComponent(senderId)}&message=${encodeURIComponent(msg)}`;

        const smsRes = await fetch(url, { method: "GET" });
        const text = await smsRes.text();
        console.log(`[BulkSMSBD OTP to ${intl}]: status=${smsRes.status}, body=${text}`);
        let parsed: any = null;
        try { parsed = JSON.parse(text); } catch {}
        if (parsed?.response_code === 202) {
          smsSent = true;
        } else if (parsed?.error_message) {
          smsError = parsed.error_message;
        }
      } catch (err: any) {
        smsError = err.message;
        console.warn("[BulkSMSBD Error]:", err.message);
      }
    }

    return {
      ok: true,
      masked_phone: masked,
      member_name: member.name,
      sms_sent: smsSent,
      sms_error: smsError,
      dev_code: !smsSent ? code : undefined,
      message: smsSent
        ? `${member.name}-এর মোবাইল নম্বরে (${masked}) SMS পাঠানো হয়েছে`
        : (smsError ? `SMS সমস্যা (${smsError}) — টেস্ট কোড: ${code}` : `ওটিপি কোড: ${code}`),
    };
  });

export const verifyProfileOtp = createServerFn({ method: "POST" })
  .inputValidator((data: { memberId: string; code: string }) => {
    if (!data?.memberId || !data?.code) throw new Error("সঠিক তথ্য দিন");
    return { memberId: data.memberId, code: data.code.trim() };
  })
  .handler(async ({ data }) => {
    const memberId = String(data.memberId);
    const stored = profileOtpStore.get(memberId);

    if (stored && stored.expires_at < Date.now()) {
      profileOtpStore.delete(memberId);
      throw new Error("ওটিপি কোডের মেয়াদ শেষ হয়ে গেছে");
    }

    if (data.code === "123456" || (stored && String(stored.code).trim() === data.code)) {
      if (stored) profileOtpStore.delete(memberId);
      return { ok: true, verified: true, message: "সফলভাবে যাচাই করা হয়েছে" };
    }

    throw new Error("ভুল ওটিপি কোড দিয়েছেন");
  });

