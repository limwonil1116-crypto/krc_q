import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = React.ComponentProps<typeof Button>;

// 남색 기본 버튼 (로그인/다음/저장 등)
export function PrimaryButton({ className, ...props }: Props) {
  return <Button {...props} className={cn("bg-[#1E3A5F] text-white hover:bg-[#16314F]", className)} />;
}

// 주황 강조 버튼 (제출/신청 등 최종 액션)
export function ActionButton({ className, ...props }: Props) {
  return <Button {...props} className={cn("bg-[#F37021] text-white hover:bg-[#DA631C]", className)} />;
}
