// Mirrors the POS cart to a second screen (a customer-facing display) open in
// another window of the same browser. BroadcastChannel never leaves the
// machine, so no server, account or network is involved.

export interface DisplayLine {
  name: string;
  quantity: number;
  total: number;
}

export type DisplayState =
  | { kind: "idle" }
  | { kind: "cart"; lines: DisplayLine[]; subtotal: number }
  | { kind: "upi"; total: number; uri: string; payee: string }
  | { kind: "paid"; total: number; method?: string };

export type DisplayMessage = DisplayState | { kind: "request-state" };

const CHANNEL = "orderrestro-customer-display";

export function publishDisplay(state: DisplayState) {
  if (typeof BroadcastChannel === "undefined") return;
  const ch = new BroadcastChannel(CHANNEL);
  ch.postMessage(state);
  ch.close();
}

export function requestDisplaySync() {
  if (typeof BroadcastChannel === "undefined") return;
  const ch = new BroadcastChannel(CHANNEL);
  ch.postMessage({ kind: "request-state" } as DisplayMessage);
  ch.close();
}

export function subscribeDisplay(onState: (s: DisplayState) => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const ch = new BroadcastChannel(CHANNEL);
  ch.onmessage = (e: MessageEvent<DisplayMessage>) => {
    if (e.data && e.data.kind !== "request-state") {
      onState(e.data as DisplayState);
    }
  };
  return () => ch.close();
}

export function subscribeDisplayRequests(onRequest: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const ch = new BroadcastChannel(CHANNEL);
  ch.onmessage = (e: MessageEvent<DisplayMessage>) => {
    if (e.data && e.data.kind === "request-state") {
      onRequest();
    }
  };
  return () => ch.close();
}
