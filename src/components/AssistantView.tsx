import { useEffect, useRef, useState } from "react";
import { type Assistant, AssistantError, readApiKey, resolveAssistant, shrinkImage, storeApiKey } from "../ai/assistant";
import { QUICK_PROMPTS, SYSTEM_PROMPT, projectContext } from "../ai/context";
import { readPanelFromPhoto } from "../ai/photo";
import type { Panel } from "../domain/types";
import { inClaudeViewer } from "../store/claude-runtime";
import { useStore } from "../store/store";
import { Markdown } from "./ui";

const MAX_TURNS = 16;

export function AssistantView({ pending, onPendingHandled }: { pending?: string; onPendingHandled: () => void }) {
  const project = useStore((s) => s.project);
  const setChat = useStore((s) => s.setChat);
  const createPanelFrom = useStore((s) => s.createPanelFrom);
  const [apiKey, setApiKey] = useState(readApiKey);
  const [keyDraft, setKeyDraft] = useState("");
  const [assistant, setAssistant] = useState<Assistant | null>();
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [images, setImages] = useState(false);
  const ctl = useRef<AbortController>(undefined);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setAssistant(undefined);
    resolveAssistant(apiKey).then(async (a) => {
      if (!alive) return;
      setAssistant(a);
      setImages(a ? await a.canUseImages() : false);
    });
    return () => {
      alive = false;
    };
  }, [apiKey]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || !assistant || busy) return;
    const history = [...useStore.getState().project.chat, { role: "user" as const, content: question }];
    setChat(history);
    setDraft("");
    setError(undefined);
    setBusy(true);
    setStreaming("");
    ctl.current = new AbortController();
    try {
      const system = `${SYSTEM_PROMPT}\n\n${projectContext(useStore.getState().project)}`;
      const answer = await assistant.ask(system, history.slice(-MAX_TURNS), {
        signal: ctl.current.signal,
        onText: (t) => setStreaming(t),
      });
      setChat([...history, { role: "assistant", content: answer }]);
    } catch (e) {
      const err = e as AssistantError;
      if (err.partial) setChat([...history, { role: "assistant", content: `${err.partial}\n\n*(réponse interrompue)*` }]);
      if (err.code !== "cancelled") setError(err.message);
    } finally {
      setBusy(false);
      setStreaming(undefined);
    }
  };

  useEffect(() => {
    if (pending && assistant && !busy) {
      onPendingHandled();
      void send(pending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, assistant]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [project.chat.length, streaming]);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div>
        <div className="eyebrow">Claude · spécialiste NF C 15-100</div>
        <h2>Assistant</h2>
      </div>
      <div className="assistant-layout">
        <section className="stack">
          {assistant === undefined && <p className="muted">Connexion à l'assistant…</p>}
          {assistant === null && (
            <form
              className="card stack"
              onSubmit={(e) => {
                e.preventDefault();
                storeApiKey(keyDraft.trim());
                setApiKey(keyDraft.trim());
              }}
            >
              <h3>Connecter Claude</h3>
              <p>
                Hors de claude.ai, l'assistant utilise l'API Claude avec votre propre clé (créée sur console.anthropic.com). Elle reste dans ce
                navigateur et n'est envoyée qu'à l'API Anthropic.
              </p>
              <label className="field">
                <span>Clé API Anthropic</span>
                <input id="api-key" className="input mono" type="password" autoComplete="off" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} placeholder="sk-ant-…" />
              </label>
              <div className="row">
                <button type="submit" className="btn primary" disabled={!keyDraft.trim()}>
                  Enregistrer la clé
                </button>
              </div>
              <p className="muted" style={{ fontSize: "0.82rem" }}>
                Le moteur de règles (pages Tableau et Conformité) fonctionne sans assistant.
              </p>
            </form>
          )}

          <div className="chat" aria-live="polite">
            {project.chat.length === 0 && !busy && assistant && (
              <div className="card stack">
                <p>
                  Posez vos questions sur votre installation. L'assistant connaît vos tableaux, les circuits décrits, les constats du moteur de règles et la
                  liste de matériel.
                </p>
              </div>
            )}
            {project.chat.map((t, i) => (
              <div key={i} className={`bubble ${t.role}`}>
                {t.role === "assistant" ? <Markdown text={t.content} /> : t.content}
              </div>
            ))}
            {busy && (
              <div className="bubble assistant">{streaming ? <Markdown text={streaming} /> : <span className="thinking">Claude réfléchit…</span>}</div>
            )}
            {error && <p className="error-text">{error}</p>}
            <div ref={endRef} />
          </div>

          {assistant && (
            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                void send(draft);
              }}
            >
              <label htmlFor="chat-input" className="sr-only">
                Votre question
              </label>
              <textarea
                id="chat-input"
                className="input"
                value={draft}
                placeholder="Ex. : mon lave-linge peut-il rester sur le même différentiel que le four ?"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(draft);
                  }
                }}
              />
              {busy ? (
                <button type="button" className="btn" onClick={() => ctl.current?.abort()}>
                  Arrêter
                </button>
              ) : (
                <button type="submit" className="btn primary" disabled={!draft.trim()}>
                  Envoyer
                </button>
              )}
            </form>
          )}
        </section>

        <aside className="stack">
          {assistant && (
            <section className="card stack">
              <h3>Questions rapides</h3>
              {QUICK_PROMPTS.map((q) => (
                <button key={q.label} type="button" className="btn" style={{ justifyContent: "flex-start" }} disabled={busy} onClick={() => send(q.prompt)}>
                  {q.label}
                </button>
              ))}
              {project.chat.length > 0 && (
                <button type="button" className="btn ghost small" disabled={busy} onClick={() => setChat([])}>
                  Effacer la conversation
                </button>
              )}
            </section>
          )}
          {assistant && images && <PhotoImport assistant={assistant} onCreate={createPanelFrom} />}
          {assistant?.kind === "api" && (
            <section className="card stack">
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                Assistant connecté avec votre clé API (modèle Claude Opus 5).
              </p>
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  storeApiKey("");
                  setApiKey("");
                }}
              >
                Oublier la clé
              </button>
            </section>
          )}
          {inClaudeViewer() && (
            <p className="muted" style={{ fontSize: "0.82rem" }}>
              Sur claude.ai, l'assistant utilise votre compte Claude : la première question vous demande l'autorisation.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function PhotoImport({ assistant, onCreate }: { assistant: Assistant; onCreate: (p: Panel) => void }) {
  const [state, setState] = useState<{ busy?: boolean; error?: string; result?: { panel: Panel; remarks?: string } }>({});
  return (
    <section className="card stack">
      <h3>Lire mon tableau sur une photo</h3>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Photographiez le tableau de face, capot ouvert et bien éclairé. L'assistant relève les appareils rangée par rangée ; vous vérifiez ensuite
        chaque appareil.
      </p>
      <label className="btn" style={{ cursor: state.busy ? "wait" : "pointer" }}>
        {state.busy ? "Lecture de la photo…" : "Choisir une photo"}
        <input
          id="photo-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={state.busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setState({ busy: true });
            try {
              const image = await shrinkImage(file);
              setState({ result: await readPanelFromPhoto(assistant, image) });
            } catch (err) {
              setState({ error: (err as Error).message || "La photo n'a pas pu être lue." });
            }
          }}
        />
      </label>
      {state.error && <p className="error-text">{state.error}</p>}
      {state.result && (
        <div className="stack">
          <p>
            <b>{state.result.panel.rows.flat().length}</b> appareils reconnus sur <b>{state.result.panel.rows.length}</b> rangée(s).
          </p>
          {state.result.remarks && <p className="muted">{state.result.remarks}</p>}
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              onCreate(state.result!.panel);
              setState({});
            }}
          >
            Créer le tableau existant
          </button>
        </div>
      )}
    </section>
  );
}
