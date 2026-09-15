"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number) {
  if (ms <= 0) return "Deadline passed";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export function Countdown({ deadlineAt }: { deadlineAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = new Date(deadlineAt).getTime() - now;
  const isPast = remainingMs <= 0;
  const isUrgent = !isPast && remainingMs < 1000 * 60 * 60 * 24;

  return (
    <span
      className={
        isPast
          ? "text-destructive"
          : isUrgent
            ? "text-amber-600 dark:text-amber-400"
            : "text-muted-foreground"
      }
    >
      {formatRemaining(remainingMs)}
    </span>
  );
}
