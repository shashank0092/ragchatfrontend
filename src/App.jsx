import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { API_BASE } from "./config";
import { apiAsk, apiIngest, apiStream } from "./api";
import "./index.css";

export default function App() {
  const [tab, setTab] = useState("chat"); // "chat" | "ingest"
  return (
    <div className="container">
      <Header />
      <div className="tabbar">
        <button
          className={`tab ${tab === "chat" ? "active" : ""}`}
          onClick={() => setTab("chat")}
        >
          Chat
        </button>
        <button
          className={`tab ${tab === "ingest" ? "active" : ""}`}
          onClick={() => setTab("ingest")}
        >
          Ingest
        </button>
      </div>
      {tab === "chat" ? <ChatPanel /> : <IngestPanel />}
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
      }}
    >
      <h1 style={{ margin: 0 }}>RAG Chat (LangChain + Gemini)</h1>
      <span className="badge">Backend: {API_BASE}</span>
    </header>
  );
}

function Footer() {
  return (
    <div className="small" style={{ marginTop: 24 }}>
      Tip: pehle <b>Ingest</b> tab se kuch text add karo, phir <b>Chat</b> me
      sawal puchho.
    </div>
  );
}
function IngestPanel() {
  const [docId, setDocId] = useState("notes-1");
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");

  async function submit() {
    if (!text.trim()) return;
    setStatus("Uploading...");
    try {
      const res = await apiIngest({ docId, text });
      setStatus(`✅ Stored chunks: ${res.stored}`);
      setText("");
    } catch (e) {
      setStatus("❌ " + e.message);
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 8 }}>
        <input
          className="input"
          value={docId}
          onChange={(e) => setDocId(e.target.value)}
          placeholder="docId (for filtering later)"
        />
        <button className="btn" onClick={submit}>
          Ingest
        </button>
      </div>
      <textarea
        className="input"
        style={{ height: 180, resize: "vertical" }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your text/notes here…"
      />
      <div className="small" style={{ marginTop: 8 }}>
        {status}
      </div>
      <details style={{ marginTop: 12 }}>
        <summary>What happens?</summary>
        <div className="small">
          Text → chunks (overlap) → Gemini{" "}
          <code className="code">text-embedding-004</code> vectors → Mongo Atlas
          Vector index.
        </div>
      </details>
    </div>
  );
}

function ChatPanel() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]); // { q, a, sources?, stream?:boolean }
  const unsubRef = useRef(null);
  const bufRef = useRef("");

  async function ask() {
    if (!q.trim()) return;
    const myQ = q;
    setQ("");
    setLoading(true);
    try {
      const data = await apiAsk({ question: myQ });
      setLogs((l) => [...l, { q: myQ, a: data.answer, sources: data.sources }]);
    } catch (e) {
      setLogs((l) => [...l, { q: myQ, a: "❌ " + e.message }]);
    } finally {
      setLoading(false);
    }
  }

  function askStream() {
    if (!q.trim()) return;
    const myQ = q;
    setQ("");
    bufRef.current = "";
    setLogs((l) => [...l, { q: myQ, a: "", stream: true }]);

    // subscribe
    unsubRef.current = apiStream({
      question: myQ,
      onToken: (t) => {
        bufRef.current += t;
        setLogs((l) => {
          const copy = [...l];
          copy[copy.length - 1].a = bufRef.current;
          return copy;
        });
      },
      onDone: () => {
        setLogs((l) => {
          const copy = [...l];
          copy[copy.length - 1].stream = false;
          return copy;
        });
      },
      onError: (e) => {
        setLogs((l) => {
          const copy = [...l];
          copy[copy.length - 1].a += "\n\n❌ (stream error)";
          return copy;
        });
      },
    });
  }

  useEffect(
    () => () => {
      unsubRef.current?.();
    },
    []
  );

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row">
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") ask();
            }}
            placeholder="Ask about your ingested docs..."
          />
          <button className="btn secondary" onClick={ask} disabled={loading}>
            Ask
          </button>
          <button className="btn" onClick={askStream}>
            Stream
          </button>
        </div>
        <div className="small" style={{ marginTop: 8 }}>
          Example: “Explain RAG briefly and cite chunks.”
        </div>
      </div>

      <div>
        {logs.length === 0 && <div className="small">No messages yet.</div>}
        {logs.map((m, i) => (
          <Message key={i} {...m} />
        ))}
      </div>
    </>
  );
}

function Message({ q, a, sources, stream }) {
  return (
    <div className="msg">
      <div>
        <b>Q:</b> {q}
      </div>
      <div style={{ marginTop: 6 }}>
        <ReactMarkdown>{a || ""}</ReactMarkdown>
        {stream && <div className="small">…streaming</div>}
      </div>
      {sources?.length ? (
        <>
          <hr className="sep" />
          <div className="small">
            <b>Sources:</b>{" "}
            {sources.map((s, idx) => (
              <span key={idx} style={{ marginRight: 8 }}>
                [{s.idx}] {s.source || "chunk"}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
