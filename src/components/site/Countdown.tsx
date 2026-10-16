import { useEffect, useState } from "react";

export function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const diff = Math.max(0, new Date(to).getTime() - (now ?? 0));
  const parts = now == null ? ["--", "--", "--", "--"] : [86400000, 3600000, 60000, 1000].map((u, i, a) => String(Math.floor((i ? diff % (a[i - 1] ?? 1) : diff) / u)).padStart(2, "0"));
  return (
    <div className="flex gap-3">
      {["Jours", "Heures", "Min", "Sec"].map((l, i) => (
        <div key={l} className="min-w-16 rounded-xl border bg-card px-3 py-2 text-center">
          <p className="font-mono text-3xl font-bold">{parts[i]}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{l}</p>
        </div>
      ))}
    </div>
  );
}
