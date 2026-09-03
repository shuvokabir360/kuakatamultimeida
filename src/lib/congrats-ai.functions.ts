import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

const Input = z.object({
  memberName: z.string().min(1),
  role: z.string().nullable().optional(),
  oldSalary: z.number().nonnegative(),
  newSalary: z.number().nonnegative(),
  hint: z.string().max(500).optional().default(""),
});

export const generateCongratsMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const diff = data.newSalary - data.oldSalary;
    const pct = data.oldSalary > 0 ? ((diff / data.oldSalary) * 100).toFixed(1) : "";

    const prompt = `তুমি Kuakata Multimedia-এর পক্ষে একজন সদস্যের বেতন বৃদ্ধির শুভেচ্ছা বার্তা লিখবে।
সদস্যের নাম: ${data.memberName}
পদ: ${data.role ?? "—"}
পূর্বের বেতন: ${data.oldSalary} টাকা
নতুন বেতন: ${data.newSalary} টাকা
বৃদ্ধি: ${diff} টাকা${pct ? ` (${pct}%)` : ""}

ব্যবহারকারীর সংক্ষিপ্ত ইঙ্গিত: "${data.hint || "(কোনো ইঙ্গিত নেই)"}"

নিয়ম:
- শুধুমাত্র বাংলায় লিখো।
- ২–৩টি সংক্ষিপ্ত বাক্য, উষ্ণ ও আন্তরিক টোন।
- নাম, পদ বা টাকার অংক বার্তায় উল্লেখ করবে না (কার্ডে আলাদা আছে)।
- ইমোজি ব্যবহার করবে না।
- কোনো শিরোনাম বা bullet নয়, শুধু paragraph।
- সর্বোচ্চ ৩৫০ অক্ষর।
শুধু বার্তাটিই output করো, অন্য কিছু না।`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt,
    });

    return { message: text.trim() };
  });
