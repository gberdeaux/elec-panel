import { useEffect, useRef, useState } from "react";
import { type Assistant, IS_ARTIFACT, readApiKey, resolveAssistant, shrinkImage } from "../ai/assistant";
import { PHOTO_PROMPT, panelFromPhoto, parsePhotoAnswer, readPanelFromPhoto } from "../ai/photo";
import { analyzePanel } from "../domain/analysis";
import type { Panel, PanelRole } from "../domain/types";
import { type View, useStore } from "../store/store";
import { useUi } from "../store/ui";
import { IconCamera, IconCheck, IconCopy, IconExternal, IconSparkles } from "./icons";
import { PanelVisual } from "./PanelVisual";
import { Chips, Modal, toast } from "./ui";

type Mode = "direct" | "chat";
type Result = { panel: Panel; remarks?: string };

export function PhotoImportDialog({ onClose, onNavigate }: { onClose: () => void; onNavigate: (v: View) => void }) {
  const house = useStore((s) => s.project.house);
  const panels = useStore((s) => s.project.panels);
  const createPanelFrom = useStore((s) => s.createPanelFrom);
  const replacePanel = useStore((s) => s.replacePanel);
  const openPanel = useStore((s) => s.openPanel);
  const targetId = useUi((s) => s.photoTargetId);
  const target = panels.find((p) => p.id === targetId);

  const [assistant, setAssistant] = useState<Assistant | null>();
  const [imagesOk, setImagesOk] = useState<boolean>();
  const [mode, setMode] = useState<Mode>("direct");
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Result>();
  const [role, setRole] = useState<PanelRole>(target?.role ?? "existing");
  const [destination, setDestination] = useState<"new" | "replace">(target && target.rows.flat().length === 0 ? "replace" : "new");
  const [dragging, setDragging] = useState(false);
  const ctl = useRef<AbortController>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  // Vérifie avant tout envoi que la lecture d'image est possible ici.
  useEffect(() => {
    let alive = true;
    resolveAssistant(readApiKey()).then(async (a) => {
      if (!alive) return;
      setAssistant(a);
      const ok = a ? await a.canUseImages() : false;
      if (!alive) return;
      setImagesOk(ok);
      if (!ok) setMode("chat");
    });
    return () => {
      alive = false;
      ctl.current?.abort();
    };
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
      setError("Choisissez une photo au format JPEG, PNG ou WebP.");
      return;
    }
    setError(undefined);
    setFile(f);
  };

  const readDirect = async () => {
    if (!assistant || !file) return;
    ctl.current = new AbortController();
    setBusy(true);
    setError(undefined);
    try {
      const image = await shrinkImage(file, 2000);
      setResult(await readPanelFromPhoto(assistant, image, ctl.current.signal));
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === "images_unavailable") {
        setImagesOk(false);
        setMode("chat");
        setError("L'envoi direct de photos n'est pas disponible ici : utilisez la méthode « Via une conversation Claude ».");
      } else setError(err.message || "La photo n'a pas pu être lue.");
    } finally {
      setBusy(false);
    }
  };

  const readAnswer = () => {
    setError(undefined);
    try {
      setResult(panelFromPhoto(parsePhotoAnswer(answer)));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(PHOTO_PROMPT);
      toast("Instructions copiées");
    } catch {
      setError("Copie refusée par le navigateur : sélectionnez le texte des instructions ci-dessous et copiez-le.");
    }
  };

  const finish = () => {
    if (!result) return;
    const devices = result.panel.rows.flat().filter((d) => d.kind !== "blank").length;
    if (destination === "replace" && target) {
      replacePanel({ ...result.panel, id: target.id, name: target.name, role, notes: undefined });
      openPanel(target.id);
      toast(`« ${target.name} » remplacé : ${devices} appareils`);
    } else {
      createPanelFrom({ ...result.panel, role, name: role === "new" ? "Nouveau tableau (photo)" : "Tableau existant (photo)" });
      toast(`Tableau créé : ${devices} appareils reconnus`);
    }
    onClose();
  };

  if (result) {
    const devices = result.panel.rows.flat().filter((d) => d.kind !== "blank").length;
    return (
      <Modal
        title="Vérifiez le tableau reconnu"
        subtitle={`${devices} appareils sur ${result.panel.rows.length} rangée${result.panel.rows.length > 1 ? "s" : ""} · coffret ${result.panel.enclosure.brand} ${result.panel.enclosure.modulesPerRow} modules`}
        onClose={onClose}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setResult(undefined)}>
              Recommencer
            </button>
            <button type="button" className="btn btn-primary" onClick={finish}>
              <IconCheck size={16} /> {destination === "replace" && target ? `Remplacer « ${target.name} »` : "Créer le tableau"}
            </button>
          </>
        }
      >
        <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
          <PanelVisual panel={result.panel} findings={analyzePanel(result.panel, house)} mode="front" readOnly maxScale={1.7} />
        </div>
        {result.remarks && (
          <div className="alert" data-tone="info">
            <div className="alert-body small">
              <b>À vérifier :</b> {result.remarks}
            </div>
          </div>
        )}
        <div className="row" style={{ gap: 16 }}>
          <div className="stack" style={{ gap: 6 }}>
            <span className="small" style={{ fontWeight: 600 }}>
              Ce tableau est
            </span>
            <Chips
              label="Rôle du tableau"
              text
              value={role}
              options={[
                { value: "existing" as PanelRole, label: "Mon tableau actuel" },
                { value: "new" as PanelRole, label: "Un nouveau tableau" },
              ]}
              onChange={setRole}
            />
          </div>
          {target && (
            <div className="stack" style={{ gap: 6 }}>
              <span className="small" style={{ fontWeight: 600 }}>
                Destination
              </span>
              <Chips
                label="Destination"
                text
                value={destination}
                options={[
                  { value: "new" as const, label: "Ajouter un tableau" },
                  { value: "replace" as const, label: `Remplacer « ${target.name} »` },
                ]}
                onChange={setDestination}
              />
            </div>
          )}
        </div>
        <p className="muted small">Ensuite, cliquez chaque appareil pour corriger ce qui aurait été mal lu (calibre, usage, section des fils).</p>
      </Modal>
    );
  }

  return (
    <Modal
      title="Importer un tableau depuis une photo"
      subtitle="Les rangées, les appareils et le texte des étiquettes sont reconnus automatiquement."
      onClose={onClose}
      footer={
        mode === "direct" ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Annuler
            </button>
            <button type="button" className="btn btn-primary" disabled={!assistant || !imagesOk || !file || busy} onClick={readDirect}>
              <IconSparkles size={16} /> {busy ? "Lecture en cours…" : "Lire la photo"}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Annuler
            </button>
            <button type="button" className="btn btn-primary" disabled={!answer.trim()} onClick={readAnswer}>
              Construire le tableau
            </button>
          </>
        )
      }
    >
      <div className="segmented" role="tablist" aria-label="Méthode">
        <button type="button" role="tab" aria-pressed={mode === "direct"} onClick={() => setMode("direct")}>
          <IconCamera size={15} /> Envoyer la photo
        </button>
        <button type="button" role="tab" aria-pressed={mode === "chat"} onClick={() => setMode("chat")}>
          <IconSparkles size={15} /> Via une conversation Claude
        </button>
      </div>

      {mode === "direct" ? (
        <div className="stack">
          {imagesOk === false && (
            <div className="alert">
              <IconSparkles size={18} />
              <div className="alert-body">
                {assistant === null && !IS_ARTIFACT ? (
                  <>
                    L'envoi direct utilise l'API Claude avec votre clé.{" "}
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
                  </>
                ) : (
                  <>L'envoi direct de photos n'est pas disponible dans cette page. Utilisez l'onglet « Via une conversation Claude » : le résultat est le même.</>
                )}
              </div>
            </div>
          )}
          <button
            type="button"
            className="dropzone"
            data-dragging={dragging}
            disabled={imagesOk === false}
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
          {busy && (
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
        </div>
      ) : (
        <div className="stack">
          <ol className="howto">
            <li>
              <b>Copiez les instructions de lecture.</b>
              <div className="row" style={{ marginTop: 6 }}>
                <button type="button" className="btn btn-sm btn-primary" onClick={copyPrompt}>
                  <IconCopy size={14} /> Copier les instructions
                </button>
                <details>
                  <summary className="xsmall" style={{ cursor: "pointer", color: "var(--link)", fontWeight: 600 }}>
                    Voir le texte
                  </summary>
                  <textarea className="input mono" readOnly value={PHOTO_PROMPT} style={{ marginTop: 6, minHeight: 120, fontSize: "0.72rem" }} onFocus={(e) => e.currentTarget.select()} />
                </details>
              </div>
            </li>
            <li>
              <b>Ouvrez une nouvelle conversation Claude</b>, joignez la photo du tableau et collez les instructions.
              <div style={{ marginTop: 6 }}>
                <a className="btn btn-sm" href="https://claude.ai/new" target="_blank" rel="noreferrer">
                  <IconExternal size={14} /> Nouvelle conversation
                </a>
              </div>
            </li>
            <li>
              <b>Copiez toute la réponse de Claude</b> et collez-la ici :
              <textarea
                id="photo-answer"
                className="input mono"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder='{"enclosure": {...}, "rows": [[...]]}'
                style={{ marginTop: 6, minHeight: 140, fontSize: "0.78rem" }}
              />
            </li>
          </ol>
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
    </Modal>
  );
}
