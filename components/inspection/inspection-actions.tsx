"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InspectionActions({
  id,
  status,
  afterDelete,
}: {
  id: string;
  status: string;
  afterDelete?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const canWithdraw = status === "submitted" || status === "under_review" || status === "revision_requested";
  const canDelete = status !== "approved";

  async function run(action: "withdraw" | "delete") {
    const msg =
      action === "withdraw"
        ? "제출을 회수하여 작성중 상태로 되돌립니다. 계속할까요?"
        : "이 검측요청서를 삭제합니다. 되돌릴 수 없습니다. 계속할까요?";
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/inspections/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.error || "처리에 실패했습니다.");
        return;
      }
      if (action === "delete" && afterDelete) {
        router.push(afterDelete);
        return;
      }
      router.refresh();
    } catch {
      alert("요청 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (!canWithdraw && !canDelete) return null;

  return (
    <div className="mt-2 flex justify-end gap-2 border-t border-neutral-100 pt-2">
      {canWithdraw && (
        <button
          type="button"
          onClick={() => run("withdraw")}
          disabled={busy}
          className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
        >
          {busy ? "처리 중..." : "↩ 제출 회수"}
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={() => run("delete")}
          disabled={busy}
          className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          🗑 삭제
        </button>
      )}
    </div>
  );
}
