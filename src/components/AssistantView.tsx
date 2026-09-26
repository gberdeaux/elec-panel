import { useEffect, useRef, useState } from "react";
import { type Assistant, AssistantError, IS_ARTIFACT, readApiKey, resolveAssistant, shrinkImage, storeApiKey } from "../ai/assistant";
import { QUICK_PROMPTS, SYSTEM_PROMPT, projectContext } from "../ai/context";
import { readPanelFromPhoto } from "../ai/photo";
import type { Panel } from "../domain/types";
import { inClaudeViewer } from "../store/claude-runtime";
import { useStore } from "../store/store";
import { IconBolt, IconCamera, IconSend, IconSparkles, IconStop } from "./icons";
import { Field, Markdown, toast } from "./ui";

const MAX_TURNS = 16;

export function AssistantView({ pending, onPendingHandled }: { pending?: string; onPendingHandled: () => void }) {
  const chat = useStore((s) => s.project.chat);
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
  const scrollRef = useRef<HTMLDivElement>(null);

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
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length, streaming]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Assistant IA</h1>
          <p className="sub">Claude connaît vos tableaux, les circuits décrits, les constats et la liste de matériel. Posez vos questions en langage courant.</p>
        </div>
        {chat.length > 0 && (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setChat([])}>
            Nouvelle conversation
          </button>
        )}
      </div>

      <div className="chat-layout">
        <section className="card chat-card">
          {assistant === undefined && (
            <div className="empty">
              <div className="typing">
                <span />
                <span />
                <span />
              </div>
              <p>Connexion à l'assistant…</p>
            </div>
          )}
          {assistant === null && IS_ARTIFACT && (
            <div className="empty">
              <span className="empty-icon">
                <IconSparkles />
              </span>
              <h3>Assistant indisponible</h3>
              <p>Ouvrez cette page depuis claude.ai, connecté à votre compte, pour utiliser l'assistant.</p>
            </div>
          )}
          {assistant === null && !IS_ARTIFACT && (
            <form
              className="empty"
              onSubmit={(e) => {
                e.preventDefault();
                storeApiKey(keyDraft.trim());
                setApiKey(keyDraft.trim());
              }}
            >
              <span className="empty-icon">
                <IconSparkles />
              </span>
              <h3>Connecter Claude</h3>
              <p style={{ maxWidth: 460 }}>
                En dehors de claude.ai, l'assistant utilise l'API Claude avec votre propre clé, créée sur console.anthropic.com. Elle reste dans ce
                navigateur.
              </p>
              <div className="row" style={{ width: "min(460px, 100%)", flexWrap: "nowrap" }}>
                <input id="api-key" className="input mono" type="password" autoComplete="off" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} placeholder="sk-ant-…" aria-label="Clé API Anthropic" />
                <button type="submit" className="btn btn-primary" disabled={!keyDraft.trim()}>
                  Connecter
                </button>
              </div>
              <p className="xsmall">Le moteur de règles, la génération et la liste de matériel fonctionnent sans assistant.</p>
            </form>
          )}

          {assistant && (
            <>
              <div className="chat-scroll" ref={scrollRef} aria-live="polite">
                {chat.length === 0 && !busy && (
                  <div className="empty" style={{ margin: "auto" }}>
                    <span className="empty-icon">
                      <IconSparkles />
                    </span>
                    <h3>Comment puis-je vous aider ?</h3>
                    <p>Choisissez une question à droite ou écrivez la vôtre.</p>
                  </div>
                )}
                {chat.map((t, i) =>
                  t.role === "user" ? (
                    <div key={i} className="msg user">
                      <div className="msg-bubble">{t.content}</div>
                    </div>
                  ) : (
                    <div key={i} className="msg">
                      <span className="msg-avatar">
                        <IconBolt size={15} />
                      </span>
                      <div className="msg-bubble">
                        <Markdown text={t.content} />
                      </div>
                    </div>
                  ),
                )}
                {busy && (
                  <div className="msg">
                    <span className="msg-avatar">
                      <IconBolt size={15} />
                    </span>
                    <div className="msg-bubble">
                      {streaming ? (
                        <Markdown text={streaming} />
                      ) : (
                        <div className="typing" aria-label="Claude réfléchit">
                          <span />
                          <span />
                          <span />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {error && <p className="error-text">{error}</p>}
              </div>
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
                  rows={1}
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
                    <IconStop size={15} /> Arrêter
                  </button>
                ) : (
                  <button type="submit" className="btn btn-primary btn-icon" disabled={!draft.trim()} aria-label="Envoyer">
                    <IconSend size={17} />
                  </button>
                )}
              </form>
            </>
          )}
        </section>

        <aside className="stack-lg">
          {assistant && (
            <section className="card">
              <div className="card-head">
                <h3>Questions fréquentes</h3>
              </div>
              <div className="card-body stack" style={{ gap: 8 }}>
                {QUICK_PROMPTS.map((q) => (
                  <button key={q.label} type="button" className="suggestion" disabled={busy} onClick={() => send(q.prompt)}>
                    <IconSparkles size={15} />
                    <span>
                      <b style={{ display: "block", fontWeight: 550 }}>{q.label}</b>
                      <span className="muted xsmall">{q.prompt.slice(0, 78)}…</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {assistant && images && <PhotoImport assistant={assistant} onCreate={createPanelFrom} />}
          {assistant?.kind === "api" && (
            <section className="card card-body stack">
              <p className="muted small">Connecté avec votre clé API · modèle Claude Opus 5.</p>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  storeApiKey("");
                  setApiKey("");
                }}
              >
                Déconnecter la clé
              </button>
            </section>
          )}
          {inClaudeViewer() && <p className="muted xsmall">Sur claude.ai, l'assistant utilise votre compte Claude : la première question demande votre accord.</p>}
        </aside>
      </div>
    </div>
  );
}

function PhotoImport({ assistant, onCreate }: { assistant: Assistant; onCreate: (p: Panel) => void }) {
  const [state, setState] = useState<{ busy?: boolean; error?: string; result?: { panel: Panel; remarks?: string } }>({});
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h3>Lire mon tableau sur une photo</h3>
          <p className="sub">Capot ouvert, de face, bien éclairé.</p>
        </div>
      </div>
      <div className="card-body stack">
        <label className={`btn${state.busy ? "" : " btn-primary"}`} style={{ cursor: state.busy ? "wait" : "pointer" }}>
          <IconCamera size={16} /> {state.busy ? "Lecture en cours…" : "Choisir une photo"}
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
            <Field label="Résultat">
              <p className="small">
                <b>{state.result.panel.rows.flat().length}</b> appareils reconnus sur <b>{state.result.panel.rows.length}</b> rangée(s).
              </p>
            </Field>
            {state.result.remarks && <p className="muted small">{state.result.remarks}</p>}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onCreate(state.result!.panel);
                setState({});
                toast("Tableau créé depuis la photo");
              }}
            >
              Créer le tableau existant
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
