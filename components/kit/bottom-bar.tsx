import * as React from "react";

// 화면 하단 고정 액션 바 (취소 / 제출 등)
export function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 mt-6 flex gap-2 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur">
      {children}
    </div>
  );
}
