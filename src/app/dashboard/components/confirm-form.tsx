"use client";

// 破坏性操作（删除/归档）提交前弹确认框
export function ConfirmForm({ action, message, children }: { action: (formData: FormData) => void | Promise<void>; message: string; children: React.ReactNode }) {
  return <form action={action} onSubmit={(event) => { if (!window.confirm(message)) event.preventDefault(); }}>{children}</form>;
}
