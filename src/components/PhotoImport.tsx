import { useEffect, useRef, useState } from "react";
import { type Assistant, IS_ARTIFACT, readApiKey, resolveAssistant, shrinkImage } from "../ai/assistant";
import { readPanelFromPhoto } from "../ai/photo";
import { analyzePanel } from "../domain/analysis";
import type { Panel } from "../domain/types";
import { type View, useStore } from "../store/store";
import { IconCamera, IconSparkles } from "./icons";
import { PanelVisual } from "./PanelVisual";
import { Modal, toast } from "./ui";

type Step = { kind: "idle" } | { kind: "reading" } | { kind: "done"; panel: Panel; remarks?: string } | { kind: "error"; message: string };

export function PhotoImportDialog({ onClose, onNavigate }: { onClose: () => void; onNavigate: (v: View) => void }) {
  const house = useStore((s) => s.project.house);
  const createPanelFrom = useStore((s) => s.createPanelFrom);
  const [assistant, setAssistant] = useState<Assistant | null>();
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const ctl = useRef<AbortController>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    resolveAssistant(readApiKey()).then(setAssistant);
    return () => ctl.current?.abort();
  }, []);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (f?: File) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
      setStep({ kind: "error", message: "Choisissez une photo au format JPEG, PNG ou WebP." });
      return;
    }
    setFile(f);
    setStep({ kind: "idle" });
  };

  const analyse = async () => {
    if (!assistant || !file) return;
    ctl.current = new AbortController();
    setStep({ kind: "reading" });
    try {
      const image = await shrinkImage(file, 2000);
      const result = await readPanelFromPhoto(assistant, image, ctl.current.signal);
      setStep({ kind: "done", ...result });
    } catch (e) {
      setStep({ kind: "error", message: (e as Error).message || "La photo n'a pas pu être lue." });
    }
  };

  const devices = step.kind === "done" ? step.panel.rows.flat().filter((d) => d.kind !== "blank").length : 0;

  return (
    <Modal
      title="Importer un tableau depuis une photo"
      subtitle="L'assistant repère les rangées, les appareils et le texte des étiquettes. Vous vérifiez ensuite chaque appareil."
      onClose={onClose}
      footer={
        step.kind === "done" ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setStep({ kind: "idle" })}>
              Recommencer
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                createPanelFrom(step.panel);
                toast(`Tableau créé : ${devices} appareils reconnus`);
                onClose();
              }}
            >
              Créer ce tableau existant
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Annuler
            </button>
            <button type="button" className="btn btn-primary" disabled={!assistant || !file || step.kind === "reading"} onClick={analyse}>
              <IconSparkles size={16} /> {step.kind === "reading" ? "Lecture en cours…" : "Lire la photo"}
            </button>
          </>
        )
      }
    >
      {assistant === null && (
        <div className="alert">
          <IconSparkles size={18} />
          <div className="alert-body">
            {IS_ARTIFACT ? (
              "La lecture de photo utilise Claude : ouvrez cette page depuis claude.ai en étant connecté."
            ) : (
              <>
                La lecture de photo utilise Claude. Connectez l'assistant avec votre clé API, puis revenez ici.
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      onClose();
                      onNavigate("assistant");
                    }}
                  >
                    Connecter l'assistant
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {step.kind === "done" ? (
        <div className="stack">
          <div className="row">
            <b>
              {devices} appareils sur {step.panel.rows.length} rangée{step.panel.rows.length > 1 ? "s" : ""}
            </b>
            <span className="muted small">
              · coffret {step.panel.enclosure.brand} {step.panel.enclosure.modulesPerRow} modules
            </span>
          </div>
          <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
            <PanelVisual panel={step.panel} findings={analyzePanel(step.panel, house)} mode="front" readOnly maxScale={1.7} />
          </div>
          {step.remarks && (
            <div className="alert" data-tone="info">
              <div className="alert-body small">
                <b>À vérifier :</b> {step.remarks}
              </div>
            </div>
          )}
          <p className="muted small">Après création, cliquez chaque appareil pour corriger ce qui aurait été mal lu (calibre, usage, section des fils).</p>
        </div>
      ) : (
        <div className="stack">
          <button
            type="button"
            className="dropzone"
            data-dragging={dragging}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files[0]);
            }}
          >
            {preview ? (
              <img src={preview} alt="Photo du tableau à importer" />
            ) : (
              <>
                <span className="empty-icon">
                  <IconCamera />
                </span>
                <b>Déposez la photo du tableau ici</b>
                <span className="muted small">ou cliquez pour la choisir (JPEG, PNG, WebP)</span>
              </>
            )}
          </button>
          <input ref={inputRef} id="photo-file" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? undefined)} />
          <ul className="list-notes small">
            <li>Photographiez le tableau de face, capot fermé, en entier et bien éclairé.</li>
            <li>Les étiquettes doivent être lisibles : ce sont elles qui indiquent ce qui est branché.</li>
            <li>La lecture prend généralement 20 à 60 secondes.</li>
          </ul>
          {step.kind === "reading" && (
            <div className="row muted small">
              <div className="typing">
                <span />
                <span />
                <span />
              </div>
              Lecture des rangées et des étiquettes…
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => ctl.current?.abort()}>
                Arrêter
              </button>
            </div>
          )}
          {step.kind === "error" && <p className="error-text">{step.message}</p>}
        </div>
      )}
    </Modal>
  );
}
