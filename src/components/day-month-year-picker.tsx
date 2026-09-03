import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toBn } from "@/lib/format";

export function DayMonthYearPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) {
  const parsed = useMemo(() => {
    if (!value) {
      const now = new Date();
      return {
        year: String(now.getFullYear()),
        month: String(now.getMonth() + 1).padStart(2, "0"),
        day: String(now.getDate()).padStart(2, "0"),
      };
    }
    const parts = value.split("-");
    const now = new Date();
    return {
      year: parts[0] || String(now.getFullYear()),
      month: parts[1] ? parts[1].padStart(2, "0") : String(now.getMonth() + 1).padStart(2, "0"),
      day: parts[2] ? parts[2].padStart(2, "0") : String(now.getDate()).padStart(2, "0"),
    };
  }, [value]);

  const update = (year: string, month: string, day: string) => {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const maxDays = new Date(y, m, 0).getDate();
    let d = parseInt(day, 10);
    if (d > maxDays) d = maxDays;
    const finalDay = String(d).padStart(2, "0");
    const finalMonth = String(m).padStart(2, "0");
    onChange(`${year}-${finalMonth}-${finalDay}`);
  };

  const months = [
    { value: "01", label: "জানুয়ারি (০১)" },
    { value: "02", label: "ফেব্রুয়ারি (০২)" },
    { value: "03", label: "মার্চ (০৩)" },
    { value: "04", label: "এপ্রিল (০৪)" },
    { value: "05", label: "মে (০৫)" },
    { value: "06", label: "জুন (০৬)" },
    { value: "07", label: "জুলাই (০৭)" },
    { value: "08", label: "আগস্ট (০৮)" },
    { value: "09", label: "সেপ্টেম্বর (০৯)" },
    { value: "10", label: "অক্টোবর (১০)" },
    { value: "11", label: "নভেম্বর (১১)" },
    { value: "12", label: "ডিসেম্বর (১২)" },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => String(currentYear - 2 + i));
  const maxDays = new Date(parseInt(parsed.year, 10), parseInt(parsed.month, 10), 0).getDate();
  const days = Array.from({ length: maxDays }, (_, i) => String(i + 1).padStart(2, "0"));

  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      <div className="grid grid-cols-3 gap-2">
        {/* দিন (Day / Date) */}
        <div>
          <span className="mb-1 block text-[10.5px] font-semibold text-muted-foreground">
            দিন (Date)
          </span>
          <Select
            value={parsed.day}
            onValueChange={(d) => update(parsed.year, parsed.month, d)}
          >
            <SelectTrigger className="h-10 rounded-xl bg-background border-input font-medium text-xs">
              <SelectValue placeholder="দিন" />
            </SelectTrigger>
            <SelectContent className="max-h-56 rounded-2xl">
              {days.map((d) => (
                <SelectItem key={d} value={d}>
                  {toBn(d)} তারিখ
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* মাস (Month) */}
        <div>
          <span className="mb-1 block text-[10.5px] font-semibold text-muted-foreground">
            মাস (Month)
          </span>
          <Select
            value={parsed.month}
            onValueChange={(m) => update(parsed.year, m, parsed.day)}
          >
            <SelectTrigger className="h-10 rounded-xl bg-background border-input font-medium text-xs">
              <SelectValue placeholder="মাস" />
            </SelectTrigger>
            <SelectContent className="max-h-56 rounded-2xl">
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* বছর (Year) */}
        <div>
          <span className="mb-1 block text-[10.5px] font-semibold text-muted-foreground">
            বছর (Year)
          </span>
          <Select
            value={parsed.year}
            onValueChange={(y) => update(y, parsed.month, parsed.day)}
          >
            <SelectTrigger className="h-10 rounded-xl bg-background border-input font-medium text-xs">
              <SelectValue placeholder="বছর" />
            </SelectTrigger>
            <SelectContent className="max-h-56 rounded-2xl">
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {toBn(y)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
