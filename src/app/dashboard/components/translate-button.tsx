"use client";

import { ConfirmForm } from "./confirm-form";

// 通用「一键翻译」按钮（sweety P0 基建）：确认覆盖 + 成本提示；未开 AI/未配 key 时由调用方传 disabledReason 显示为提示文案
export function TranslateButton({ action, label = "一键翻译英文", costYuan, disabledReason }: { action: (formData: FormData) => void | Promise<void>; label?: string; costYuan?: number; disabledReason?: string }) {
  if (disabledReason) return <span className="locale-draft">{disabledReason}</span>;
  const cost = costYuan == null ? "" : costYuan < 0.01 ? "（费用不足 1 分钱）" : `（预估费用 ¥${costYuan.toFixed(2)}）`;
  return <ConfirmForm action={action} message={`AI 将把中文内容翻译成英文并覆盖现有英文内容（不会自动发布）${cost}。继续？`}><button className="translate-btn">{label}</button></ConfirmForm>;
}
