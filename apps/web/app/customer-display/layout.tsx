"use client";

import { BranchProvider } from "@/hooks/use-branch";

export default function CustomerDisplayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BranchProvider>{children}</BranchProvider>;
}

