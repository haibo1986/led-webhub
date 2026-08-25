"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

// 列表行内快速翻译按钮（P2b）：直接调用 server action（不通过表单，避免嵌套在 Link 内）；
// 点击确认覆盖 → 调用 → 刷新列表。AI 未开启时返回 null（入口隐藏）。
export function TranslateRowButton({ action, disabledReason }: { action: () => Promise<void>; disabledReason?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (disabledReason) return null;
  return <button type="button" className="row-translate" title="一键翻译英文" disabled={busy} onClick={async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!window.confirm("将把中文内容翻译成英文并覆盖现有英文内容（不会自动发布）。继续？")) return;
    setBusy(true);
    try {
      await action();
    } catch {
      // redirect 在 action 内完成；异常时仅刷新
    } finally {
      setBusy(false);
      router.refresh();
    }
  }}><Sparkles/></button>;
}
