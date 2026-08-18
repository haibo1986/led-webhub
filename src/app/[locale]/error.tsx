"use client";

export default function LocaleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="public-empty" style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}><p>SYSTEM ERROR</p><h1>页面加载时出现问题。</h1><span>请稍后重试；若持续出现，请通过联系页告知我们。</span><button onClick={reset} className="primary-action" style={{ border: "none", cursor: "pointer" }}>重新加载</button></main>;
}
