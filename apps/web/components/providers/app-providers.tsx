"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { ConfirmDialogProvider } from "@/components/providers/confirm-dialog-provider";
import { I18nProvider } from "@/lib/i18n/context";
import { Toaster } from "@/components/ui/sonner";

// Suppress React 19 development overlay warning for next-themes inline anti-FOUC script.
// In React 19, next-themes' <script> tag triggers a dev overlay warning despite being safe.
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const origError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Encountered a script tag while rendering React component")
    ) {
      return;
    }
    origError.apply(console, args);
  };
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, retry: 1 },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <ConfirmDialogProvider>
            {children}
            <Toaster richColors position="top-right" closeButton />
          </ConfirmDialogProvider>
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
