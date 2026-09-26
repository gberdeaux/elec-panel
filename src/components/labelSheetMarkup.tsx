import { renderToStaticMarkup } from "react-dom/server";
import type { LabelSettings, Panel } from "../domain/types";
import { LabelSheet } from "./Labels";

/** Planche d'étiquettes en SVG autonome (rendu hors navigateur, utilisé par les tests). */
export function labelSheetMarkup(panel: Panel, settings: LabelSettings): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
${renderToStaticMarkup(<LabelSheet panel={panel} settings={settings} />)}`;
}
