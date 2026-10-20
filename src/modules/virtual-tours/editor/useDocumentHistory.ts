import { useState } from "react";
import type { TourDocument } from "../types";
export function useDocumentHistory() {
  const [state, setState] = useState<{
    doc: TourDocument | null;
    past: TourDocument[];
    future: TourDocument[];
    baseline: string;
  }>({ doc: null, past: [], future: [], baseline: "" });
  function load(doc: TourDocument) {
    setState({ doc, past: [], future: [], baseline: JSON.stringify(doc) });
  }
  function change(fn: (doc: TourDocument) => void) {
    setState((current) => {
      if (!current.doc) return current;
      const next = structuredClone(current.doc);
      fn(next);
      return { ...current, doc: next, past: [...current.past.slice(-19), current.doc], future: [] };
    });
  }
  function undo() {
    setState((current) => {
      const previous = current.past.at(-1);
      return previous && current.doc
        ? {
            ...current,
            doc: previous,
            past: current.past.slice(0, -1),
            future: [current.doc, ...current.future],
          }
        : current;
    });
  }
  function redo() {
    setState((current) => {
      const next = current.future[0];
      return next && current.doc
        ? {
            ...current,
            doc: next,
            past: [...current.past, current.doc],
            future: current.future.slice(1),
          }
        : current;
    });
  }
  return {
    doc: state.doc,
    load,
    change,
    undo,
    redo,
    canUndo: !!state.past.length,
    canRedo: !!state.future.length,
    dirty: !!state.doc && JSON.stringify(state.doc) !== state.baseline,
  };
}
