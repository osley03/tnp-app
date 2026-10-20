import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { loadEditor, saveTour, addScenes } from "../api/tours";
import { TourCanvas } from "../viewer/TourCanvas";
import { TourPlayer } from "../viewer/TourPlayer";
import { HotspotInspector } from "../components/HotspotInspector";
import { TourSettingsPanel } from "./TourSettingsPanel";
import { SharePanel } from "./SharePanel";
import { useDocumentHistory } from "./useDocumentHistory";
import { newHotspot, removeSceneReferences } from "../lib/model";
import type { Hotspot, TourDocument, ViewPosition } from "../types";
import "../tour-studio.css";

export function TourEditor({ id }: { id: string }) {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["tour-editor", id],
    queryFn: () => loadEditor(id),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  const history = useDocumentHistory();
  const { doc, change } = history;
  const [sceneId, setSceneId] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"scene" | "hotspot" | "tour" | "share">("scene");
  const [placing, setPlacing] = useState<"add" | "move" | null>(null);
  const [position, setPosition] = useState<ViewPosition>({ yaw: 0, pitch: 0, zoom: 0 });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState<Hotspot | null>(null);
  const dragged = useRef("");
  useEffect(() => {
    if (query.data) {
      history.load(query.data);
      setSceneId((current) =>
        query.data!.scenes.some((scene) => scene.id === current)
          ? current
          : query.data!.scenes[0]?.id || "",
      );
    }
  }, [query.data]);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (history.dirty || password) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [history.dirty, password]);
  if (query.isPending)
    return (
      <p role="status" className="p-8 text-slate-900">
        Loading tour editor…
      </p>
    );
  if (query.error)
    return (
      <div role="alert" className="bg-white p-8 text-slate-950">
        <h1 className="text-xl font-bold">Tour editor unavailable</h1>
        <p className="my-4">{query.error.message}</p>
        <button onClick={() => void query.refetch()}>Retry</button>
      </div>
    );
  if (!doc) return null;
  const scene = doc.scenes.find((item) => item.id === sceneId) || doc.scenes[0];
  const spot = scene?.settings.hotspots.find((item) => item.id === selected);
  function sceneChange(fn: (scene: TourDocument["scenes"][number]) => void) {
    if (!scene) return;
    change((value) => {
      const target = value.scenes.find((item) => item.id === scene.id);
      if (target) fn(target);
    });
  }
  function selectScene(id: string) {
    setSceneId(id);
    setSelected(null);
    setPlacing(null);
  }
  function updateSpot(next: Hotspot) {
    sceneChange((value) => {
      value.settings.hotspots = value.settings.hotspots.map((item) =>
        item.id === next.id ? next : item,
      );
    });
  }
  function duplicate(source: Hotspot) {
    const next = { ...structuredClone(source), id: crypto.randomUUID(), yaw: source.yaw + 0.12 };
    sceneChange((value) => {
      value.settings.hotspots.push(next);
    });
    setSelected(next.id);
    setTab("hotspot");
  }
  function place(value: ViewPosition) {
    if (placing === "move" && spot) updateSpot({ ...spot, yaw: value.yaw, pitch: value.pitch });
    else {
      const next = newHotspot(value);
      sceneChange((current) => {
        current.settings.hotspots.push(next);
      });
      setSelected(next.id);
      setTab("hotspot");
    }
    setPlacing(null);
  }
  async function persist() {
    if (!doc) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await saveTour(doc, password || null);
      const fresh = await loadEditor(id);
      cache.setQueryData(["tour-editor", id], fresh);
      history.load(fresh);
      setPassword("");
      setMessage(
        "Saved. " + (fresh.is_published ? "Your tour is published." : "Your tour is a draft."),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save tour.");
      throw cause;
    } finally {
      setBusy(false);
    }
  }
  function reorder(source: string, target: string) {
    change((value) => {
      const from = value.scenes.findIndex((item) => item.id === source);
      const to = value.scenes.findIndex((item) => item.id === target);
      if (from < 0 || to < 0) return;
      const [item] = value.scenes.splice(from, 1);
      if (item) value.scenes.splice(to, 0, item);
      value.scenes.forEach((item, index) => {
        item.scene_order = index;
      });
    });
  }
  return (
    <main className="tnp-tour-studio">
      <header className="tnp-tour-toolbar">
        <a
          href="/app/landlord/tours"
          className="font-bold"
          onClick={(event) => {
            if (
              (history.dirty || password) &&
              !window.confirm("Leave without saving your tour changes?")
            )
              event.preventDefault();
          }}
        >
          ← Tours
        </a>
        <strong className="mr-auto">{doc.title}</strong>
        <span className="text-xs">
          {history.dirty || password ? "Unsaved changes" : "Saved"} ·{" "}
          {doc.is_published ? doc.visibility : "draft"}
        </span>
        <button disabled={!history.canUndo || busy} onClick={history.undo}>
          Undo
        </button>
        <button disabled={!history.canRedo || busy} onClick={history.redo}>
          Redo
        </button>
        <button onClick={() => setPreview(true)}>Preview</button>
        <button
          className="tnp-tour-primary"
          disabled={busy}
          onClick={() => void persist().catch(() => {})}
        >
          {busy ? "Saving…" : "Save tour"}
        </button>
      </header>
      {error && (
        <p role="alert" className="tnp-tour-message tnp-tour-danger">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="tnp-tour-message">
          {message}
        </p>
      )}
      <div className="tnp-tour-layout">
        <aside className="tnp-tour-panel">
          <h2>Scenes</h2>
          <p className="mb-3 text-xs text-slate-500">Drag to reorder, or use the arrows.</p>
          <div className="tnp-tour-scene-list">
            {doc.scenes.map((item, index) => (
              <div
                key={item.id}
                draggable={!busy}
                onDragStart={() => {
                  dragged.current = item.id;
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  reorder(dragged.current, item.id);
                }}
              >
                <button
                  className="tnp-tour-scene-item"
                  aria-pressed={scene?.id === item.id}
                  onClick={() => selectScene(item.id)}
                >
                  <img src={item.panorama_url} alt="" />
                  <span>
                    {index + 1}. {item.name}
                  </span>
                </button>
                <div className="tnp-tour-row mb-3">
                  <button
                    aria-label={"Move " + item.name + " up"}
                    disabled={index === 0}
                    onClick={() => reorder(item.id, doc.scenes[index - 1]!.id)}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={"Move " + item.name + " down"}
                    disabled={index === doc.scenes.length - 1}
                    onClick={() => reorder(item.id, doc.scenes[index + 1]!.id)}
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
          <label>
            Add panoramas
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={async (event) => {
                const files = Array.from(event.target.files || []);
                event.target.value = "";
                if (!files.length) return;
                try {
                  if (history.dirty || password) await persist();
                  setBusy(true);
                  setMessage("Uploading panoramas…");
                  await addScenes(doc, files);
                  const fresh = await loadEditor(id);
                  cache.setQueryData(["tour-editor", id], fresh);
                  history.load(fresh);
                  setMessage("Panoramas added. Save the tour when editing is complete.");
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : "Upload failed.");
                } finally {
                  setBusy(false);
                }
              }}
            />
            <small>Full 360° 2:1 JPEG/PNG/WebP panoramas, up to 20 MB each. Large images are resized automatically.</small>
          </label>
        </aside>
        <section className="min-w-0 bg-slate-950">
          {scene ? (
            <>
              <div className="tnp-tour-toolbar">
                <strong>{scene.name}</strong>
                <button
                  onClick={() => {
                    setPlacing("add");
                    setTab("hotspot");
                  }}
                >
                  + Add hotspot
                </button>
                {spot && (
                  <>
                    <button onClick={() => setCopied(structuredClone(spot))}>Copy</button>
                    <button onClick={() => duplicate(spot)}>Duplicate</button>
                  </>
                )}
                {copied && <button onClick={() => duplicate(copied)}>Paste hotspot</button>}
                {placing && <button onClick={() => setPlacing(null)}>Cancel placement</button>}
              </div>
              <TourCanvas
                scene={scene}
                settings={doc.settings}
                editMode
                placing={!!placing}
                selectedHotspotId={selected}
                onPosition={setPosition}
                onPlace={place}
                onHotspot={(item) => {
                  const owner = doc.scenes.find((value) =>
                    value.settings.hotspots.some((spot) => spot.id === item.id),
                  );
                  if (owner) setSceneId(owner.id);
                  setSelected(item.id);
                  setTab("hotspot");
                  setPlacing(null);
                }}
              />
            </>
          ) : (
            <p className="p-8 text-white">Upload a panorama to begin.</p>
          )}
        </section>
        <aside className="tnp-tour-panel tnp-tour-inspector">
          <div role="tablist" aria-label="Editor settings" className="tnp-tour-tabs">
            {(
              [
                ["scene", "Scene"],
                ["hotspot", "Hotspot"],
                ["tour", "Tour"],
                ["share", "Share"],
              ] as const
            ).map(([key, label]) => (
              <button role="tab" aria-selected={tab === key} key={key} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>
          {tab === "scene" && scene && (
            <section>
              <h2>Scene settings</h2>
              <label>
                Room name
                <input
                  value={scene.name}
                  maxLength={80}
                  onChange={(event) =>
                    sceneChange((value) => {
                      value.name = event.target.value;
                    })
                  }
                />
              </label>
              <button
                onClick={() =>
                  sceneChange((value) => {
                    value.settings.yaw = position.yaw;
                    value.settings.pitch = position.pitch;
                    value.settings.zoom = position.zoom;
                  })
                }
              >
                Set current view as starting view
              </button>
              <small>
                Yaw {Math.round((scene.settings.yaw * 180) / Math.PI)}° · Pitch{" "}
                {Math.round((scene.settings.pitch * 180) / Math.PI)}° · Zoom{" "}
                {Math.round(scene.settings.zoom)}%
              </small>
              <label>
                North alignment (degrees)
                <input
                  type="number"
                  value={Math.round((scene.settings.northOffset * 180) / Math.PI)}
                  onChange={(event) =>
                    sceneChange((value) => {
                      value.settings.northOffset = (Number(event.target.value) * Math.PI) / 180;
                    })
                  }
                />
                <small>Align rooms to preserve the walking direction.</small>
              </label>
              {(
                [
                  ["brightness", "Brightness", 0.5, 1.5],
                  ["contrast", "Contrast", 0.5, 1.5],
                  ["saturation", "Saturation", 0, 2],
                ] as const
              ).map(([key, label, min, max]) => (
                <label key={key}>
                  {label}
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={0.05}
                    value={scene.settings[key]}
                    onChange={(event) =>
                      sceneChange((value) => {
                        value.settings[key] = Number(event.target.value);
                      })
                    }
                  />
                </label>
              ))}
              <h3>Hotspots</h3>
              {scene.settings.hotspots.map((item) => (
                <button
                  key={item.id}
                  className="mb-2 block w-full text-left"
                  onClick={() => {
                    setSelected(item.id);
                    setTab("hotspot");
                  }}
                >
                  {item.label} · {item.kind}
                  {item.master ? " · master" : ""}
                </button>
              ))}
              <button
                className="mt-4"
                disabled={doc.scenes.length < 2}
                onClick={() => {
                  if (window.confirm("Remove this scene and every link to it? Save to apply.")) {
                    const next = removeSceneReferences(doc, scene.id);
                    change((value) => Object.assign(value, next));
                    selectScene(next.scenes[0]?.id || "");
                  }
                }}
              >
                Remove scene
              </button>
            </section>
          )}
          {tab === "hotspot" &&
            (spot && scene ? (
              <HotspotInspector
                doc={doc}
                sceneId={scene.id}
                spot={spot}
                position={position}
                onChange={updateSpot}
                onMove={() => setPlacing("move")}
                onDuplicate={() => duplicate(spot)}
                onDelete={() => {
                  sceneChange((value) => {
                    value.settings.hotspots = value.settings.hotspots.filter(
                      (item) => item.id !== spot.id,
                    );
                  });
                  setSelected(null);
                }}
                onBacklink={() => {
                  if (!spot.targetSceneId) return;
                  const back = {
                    ...newHotspot({ yaw: spot.yaw + Math.PI, pitch: 0, zoom: 0 }),
                    label: "Back to " + scene.name,
                    targetSceneId: scene.id,
                  };
                  change((value) => {
                    value.scenes
                      .find((item) => item.id === spot.targetSceneId)
                      ?.settings.hotspots.push(back);
                  });
                  setMessage(
                    "Return link added. Select the destination room to adjust its position.",
                  );
                }}
              />
            ) : (
              <p>Select a hotspot, or click Add hotspot and place it on the panorama.</p>
            ))}
          {tab === "tour" && (
            <TourSettingsPanel
              doc={doc}
              sceneId={scene?.id || ""}
              password={password}
              onPassword={setPassword}
              change={change}
              onScene={selectScene}
            />
          )}
          {tab === "share" && <SharePanel doc={doc} />}
        </aside>
      </div>
      {preview && (
        <div className="fixed inset-0 z-[100] overflow-auto bg-slate-950">
          <button className="fixed right-4 top-3 z-[110]" onClick={() => setPreview(false)}>
            Close preview
          </button>
          <TourPlayer doc={doc} />
        </div>
      )}
    </main>
  );
}
