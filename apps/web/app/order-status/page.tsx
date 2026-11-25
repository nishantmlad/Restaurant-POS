"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { resolveWsUrl } from "@/lib/ws-url";
import {
  Bell,
  ChefHat,
  Clock,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
  Store,
  Tv,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QueueItem {
  token: string;
  orderNumber: string;
  type: string;
  table: string | null;
}

interface OrderStatusData {
  restaurantName: string;
  branchName: string;
  logoUrl?: string | null;
  preparing: QueueItem[];
  ready: QueueItem[];
}

interface PublicBranch {
  id: string;
  name: string;
  restaurant: {
    name: string;
    logoUrl?: string | null;
  };
}

// Synthesize a pleasant two-tone ding-dong chime using Web Audio API
function playReadyChime() {
  if (typeof window === "undefined") return;
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return;

  try {
    const ctx = new Ctx();
    // Ding-dong: 784 Hz (G5) -> 523 Hz (C5)
    const tones: [freq: number, start: number, duration: number][] = [
      [784, 0, 0.25],
      [523.25, 0.2, 0.45],
    ];

    tones.forEach(([frequency, start, duration]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      osc.connect(gain);
      gain.connect(ctx.destination);

      const t0 = ctx.currentTime + start;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.35, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
    });

    setTimeout(() => ctx.close(), 1000);
  } catch {
    // Autoplay restrictions
  }
}

// Optional text-to-speech announcement
function speakAnnouncement(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Silent fallback
  }
}

function OrderStatusDisplayPageInner({
  initialBranchId,
}: {
  initialBranchId?: string;
} = {}) {
  const searchParams = useSearchParams();
  const urlBranchId =
    initialBranchId || searchParams.get("branchId") || searchParams.get("token");

  const [branchId, setBranchId] = useState<string | null>(() => {
    if (initialBranchId) return initialBranchId;
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      return (
        sp.get("branchId") ||
        sp.get("token") ||
        localStorage.getItem("nodedr_order_status_branch") ||
        localStorage.getItem("nodedr_branch_id")
      );
    }
    return null;
  });
  const [data, setData] = useState<OrderStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [soundOn, setSoundOn] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nodedr_order_status_chime");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [showBranchModal, setShowBranchModal] = useState(false);

  // Keep track of previously ready tokens to trigger sound on newly ready tokens
  const prevReadyTokensRef = useRef<Set<string>>(new Set());

  // Browser Audio Autoplay Unlock
  useEffect(() => {
    const unlock = () => {
      try {
        const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          void ctx.resume().then(() => ctx.close());
        }
      } catch {
        // ignore
      }
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("click", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock);
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  // 1. Resolve Branch ID
  useEffect(() => {
    if (urlBranchId) {
      setBranchId(urlBranchId);
      localStorage.setItem("nodedr_order_status_branch", urlBranchId);
      return;
    }
    const saved =
      localStorage.getItem("nodedr_order_status_branch") ||
      localStorage.getItem("nodedr_branch_id");
    if (saved) {
      setBranchId(saved);
    } else {
      // Fetch public branches list for selection
      void fetchBranches();
    }
  }, [urlBranchId]);

  const fetchBranches = async () => {
    try {
      const res = await fetch("/api/v1/public/branches");
      if (res.ok) {
        const list = await res.json();
        setBranches(list);
        if (list.length === 1) {
          selectBranch(list[0].id);
        } else {
          setShowBranchModal(true);
        }
      }
    } catch {
      setError("Unable to load branches");
    }
  };

  const selectBranch = (id: string) => {
    setBranchId(id);
    localStorage.setItem("nodedr_order_status_branch", id);
    setShowBranchModal(false);
  };

  // 2. Fetch Order Status Data
  const fetchData = useCallback(async () => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/v1/public/order-status/${encodeURIComponent(branchId)}`);
      if (res.ok) {
        const json: OrderStatusData = await res.json();
        setData(json);
        setError(null);

        // Check for newly ready tokens to announce
        const currentReadyTokens = new Set(json.ready.map((i) => i.token));
        const newReady: string[] = [];
        currentReadyTokens.forEach((tok) => {
          if (!prevReadyTokensRef.current.has(tok)) {
            newReady.push(tok);
          }
        });
        prevReadyTokensRef.current = currentReadyTokens;

        if (newReady.length > 0 && soundOn) {
          playReadyChime();
          const spoken = newReady.map((t) => `Token ${t}`).join(", ");
          speakAnnouncement(`${spoken} is ready for pickup.`);
        }
      } else {
        setError("Could not load queue status for this branch");
      }
    } catch {
      setError("Connection problem - retrying");
    } finally {
      setLoading(false);
    }
  }, [branchId, soundOn]);

  useEffect(() => {
    if (branchId) {
      void fetchData();
      const interval = setInterval(fetchData, 4000); // 4s polling fallback
      return () => clearInterval(interval);
    }
  }, [branchId, fetchData]);

  // 3. Realtime Socket.io Listener
  useEffect(() => {
    if (!branchId) return;

    let socket: Socket | null = null;
    try {
      socket = io(resolveWsUrl(), {
        query: { branchId, public: "true" },
        transports: ["websocket", "polling"],
      });

      const onUpdate = () => {
        void fetchData();
      };

      socket.on("kot.updated", onUpdate);
      socket.on("kot.created", onUpdate);
      socket.on("order.created", onUpdate);
      socket.on("order.updated", onUpdate);
      socket.on("order.paid", onUpdate);
    } catch {
      // Socket fallback handled by polling
    }

    return () => {
      socket?.disconnect();
    };
  }, [branchId, fetchData]);

  // 4. Clock Timer
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
      setCurrentDate(
        now.toLocaleDateString([], {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // 5. Fullscreen Handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      void document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 font-sans text-slate-100 select-none">
      {/* Top Header Bar */}
      <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 backdrop-blur-md">
        {/* Brand & Branch */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-primary border border-primary/30 shadow-inner">
            <Tv className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">
                {data?.restaurantName || "Order Status"}
              </h1>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-400">
              {data?.branchName || "Main Counter"}
            </p>
          </div>
        </div>

        {/* Live Clock & Date */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 font-mono text-2xl font-extrabold tracking-wide text-white">
            <Clock className="h-5 w-5 text-primary" />
            <span>{currentTime || "12:00:00"}</span>
          </div>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            {currentDate}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Sound Toggle Button */}
          <button
            type="button"
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              if (typeof window !== "undefined") {
                localStorage.setItem("nodedr_order_status_chime", String(next));
              }
              if (next) playReadyChime();
            }}
            title={soundOn ? "Mute audio chime" : "Enable sound chime"}
            className={cn(
              "flex h-11 items-center gap-2 rounded-xl px-3.5 text-xs font-bold transition",
              soundOn
                ? "bg-primary text-white shadow-md shadow-primary/25"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700",
            )}
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span>{soundOn ? "Chime On" : "Chime Off"}</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => void fetchData()}
            title="Refresh queue"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700 transition"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title="Toggle TV Fullscreen"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700 transition"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {/* Branch Switcher Button */}
          <button
            type="button"
            onClick={() => {
              void fetchBranches();
              setShowBranchModal(true);
            }}
            title="Change Branch"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700 transition"
          >
            <Store className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main 2-Column Status Board */}
      <main className="grid min-h-0 flex-1 grid-cols-2 divide-x divide-slate-800 bg-slate-950 p-4 gap-4">
        {/* COLUMN 1: PREPARING (IN KITCHEN) */}
        <section className="flex flex-col rounded-3xl border border-amber-500/20 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-sm">
          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <ChefHat className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-wider text-amber-400">
                  Preparing
                </h2>
                <p className="text-xs font-semibold text-slate-400">
                  Orders currently in the kitchen
                </p>
              </div>
            </div>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-sm font-black tabular-nums text-amber-400 border border-amber-500/30">
              {data?.preparing.length || 0}
            </span>
          </div>

          {/* Tokens Grid */}
          <div className="min-h-0 flex-1 overflow-y-auto pt-5">
            {loading && !data ? (
              <div className="flex h-full items-center justify-center text-slate-500">
                <RefreshCw className="h-8 w-8 animate-spin" />
              </div>
            ) : error && !data ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-rose-400 p-4">
                <p className="text-base font-bold">{error}</p>
                <button
                  type="button"
                  onClick={() => void fetchData()}
                  className="mt-3 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white border border-slate-700 hover:bg-slate-700 transition"
                >
                  Retry Connection
                </button>
              </div>
            ) : !data || data.preparing.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
                <ChefHat className="h-16 w-16 opacity-30 stroke-[1.5]" />
                <p className="mt-3 text-lg font-bold">No orders in preparation</p>
                <p className="text-xs text-slate-600">New orders will appear here automatically</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3.5 xl:grid-cols-4">
                {data.preparing.map((item) => (
                  <div
                    key={item.orderNumber}
                    className="flex flex-col items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-center transition hover:scale-[1.02] shadow-sm"
                  >
                    <span className="font-mono text-4xl font-black tracking-tight text-amber-300 tabular-nums">
                      {item.token}
                    </span>
                    <span className="mt-1 text-[11px] font-semibold text-amber-200/70 truncate max-w-full">
                      {item.table ? item.table : item.type.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* COLUMN 2: READY FOR PICKUP (COLLECT HERE) */}
        <section className="flex flex-col rounded-3xl border border-emerald-500/30 bg-emerald-950/20 p-5 shadow-2xl backdrop-blur-sm">
          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-md">
                <Bell className="h-6 w-6 animate-bounce" />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-wider text-emerald-400">
                  Ready For Pickup
                </h2>
                <p className="text-xs font-semibold text-emerald-200/70">
                  Please collect your order at the counter
                </p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/20 px-3.5 py-1 text-sm font-black tabular-nums text-emerald-300 border border-emerald-500/40">
              {data?.ready.length || 0}
            </span>
          </div>

          {/* Tokens Grid */}
          <div className="min-h-0 flex-1 overflow-y-auto pt-5">
            {loading && !data ? (
              <div className="flex h-full items-center justify-center text-slate-500">
                <RefreshCw className="h-8 w-8 animate-spin" />
              </div>
            ) : error && !data ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-500 p-4">
                <Bell className="h-16 w-16 opacity-30 stroke-[1.5]" />
                <p className="mt-3 text-lg font-bold">Waiting for connection</p>
              </div>
            ) : !data || data.ready.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
                <Sparkles className="h-16 w-16 opacity-30 stroke-[1.5]" />
                <p className="mt-3 text-lg font-bold">Waiting for next ready order</p>
                <p className="text-xs text-slate-600">Your token will appear here when ready</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                {data.ready.map((item) => (
                  <div
                    key={item.orderNumber}
                    className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-emerald-400 bg-emerald-500/25 p-5 text-center shadow-lg shadow-emerald-500/10 transition animate-in zoom-in-95 duration-200"
                  >
                    <span className="absolute -top-2.5 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-950">
                      Collect
                    </span>
                    <span className="font-mono text-5xl font-black tracking-tight text-emerald-300 tabular-nums">
                      {item.token}
                    </span>
                    <span className="mt-1 text-xs font-bold text-emerald-200/90 truncate max-w-full">
                      {item.table ? item.table : item.type.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Bottom Ticker / Instruction Banner */}
      <footer className="flex h-12 shrink-0 items-center justify-between border-t border-slate-800 bg-slate-900/90 px-6 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
          <span className="font-semibold text-slate-300">
            Please check the Token Number printed on your bill receipt.
          </span>
          <span className="hidden md:inline text-slate-500">
            When your token turns GREEN under &ldquo;Ready for Pickup&rdquo;, please collect your tray.
          </span>
        </div>
        <div className="font-mono text-[11px] text-slate-500">
          Auto-updates Live &bull; Powered by G nine POS
        </div>
      </footer>

      {/* Branch Selector Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Select Display Branch</h3>
                <p className="text-xs text-slate-400">Choose which branch queue this TV should show</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 max-h-72 overflow-y-auto">
              {branches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => selectBranch(b.id)}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-left transition hover:border-primary hover:bg-primary/10"
                >
                  <div>
                    <p className="font-bold text-white text-sm">{b.name}</p>
                    <p className="text-xs text-slate-400">{b.restaurant.name}</p>
                  </div>
                  <span className="text-xs font-semibold text-primary">Launch &rarr;</span>
                </button>
              ))}
            </div>

            {branches.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">No active branches found</p>
            )}

            <button
              type="button"
              onClick={() => setShowBranchModal(false)}
              className="mt-4 w-full rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderStatusDisplayPage({
  initialBranchId,
}: {
  initialBranchId?: string;
} = {}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-500">
          <RefreshCw className="h-10 w-10 animate-spin text-primary" />
        </div>
      }
    >
      <OrderStatusDisplayPageInner initialBranchId={initialBranchId} />
    </Suspense>
  );
}
