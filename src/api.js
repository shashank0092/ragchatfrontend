import { API_BASE } from "./config";

export async function apiIngest({ docId, text }) {
  const r = await fetch(`${API_BASE}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ docId, text }),
  });
  if (!r.ok) throw new Error(`Ingest failed: ${r.status}`);
  return r.json();
}

export async function apiAsk({ question }) {
  const r = await fetch(`${API_BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!r.ok) throw new Error(`Ask failed: ${r.status}`);
  return r.json(); // { answer, sources? }
}

export function apiStream({ question, onToken, onDone, onError }) {
  const es = new EventSource(
    `${API_BASE}/stream?q=${encodeURIComponent(question)}`
  );
  es.onmessage = (e) => {
    try {
      const { token } = JSON.parse(e.data);
      if (token) onToken?.(token);
    } catch (err) {
      console.error("Error parsing stream data", err, e.data);
    }
  };
  es.addEventListener("done", () => {
    onDone?.();
    es.close();
  });
  es.addEventListener("error", (e) => {
    onError?.(e);
    es.close();
  });
  return () => es.close(); // unsubscribe function
}
