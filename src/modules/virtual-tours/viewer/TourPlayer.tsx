import {TourDashboardLink} from '../components/TourDashboardLink';
import {PropertyTourLayout} from '../components/PropertyTourLayout';
import { useState, useRef, useEffect } from "react";
import { TourCanvas } from "./TourCanvas";
import { FloorPlan } from "../components/FloorPlan";
import { safeWebUrl, transitionView, videoEmbedUrl } from "../lib/model";
import type { Hotspot, TourDocument, ViewPosition } from "../types";
export function TourPlayer({ doc, embed = false }: { doc: TourDocument; embed?: boolean }) {
  const [sceneId, setSceneId] = useState(doc.settings.startSceneId || doc.scenes[0]?.id || "");
  const [arrival, setArrival] = useState<ViewPosition | null>(null);
  const [card, setCard] = useState<Hotspot | null>(null);
  const [plan, setPlan] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [message, setMessage] = useState("");
  const position = useRef<ViewPosition>({ yaw: 0, pitch: 0, zoom: 0 });
  const audio = useRef<HTMLAudioElement>(null);
  const scene = doc.scenes.find((item) => item.id === sceneId) || doc.scenes[0];
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCard(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  if (!scene) return <main className="space-y-4 p-8">{!embed&&<TourDashboardLink/>}<p>This tour has no rooms.</p></main>;
  function navigate(id: string) {
    setCard(null);
    setArrival(null);
    setSceneId(id);
  }
  function hotspot(spot: Hotspot) {
    if (spot.kind === "scene" && spot.targetSceneId) {
      const target = doc.scenes.find((item) => item.id === spot.targetSceneId);
      if (!target || target.id === scene!.id) return;
      setArrival(
        spot.targetYaw !== null
          ? { yaw: spot.targetYaw, pitch: spot.targetPitch || 0, zoom: target.settings.zoom }
          : transitionView(
              position.current,
              scene!.settings.northOffset,
              target.settings.northOffset,
              doc.settings.walkthrough,
            ),
      );
      setSceneId(target.id);
      setCard(null);
    } else if (spot.kind === "link") {
      const url = safeWebUrl(spot.url);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } else setCard(spot);
  }
  const masters = doc.scenes.flatMap((item) =>
    item.settings.hotspots.filter((spot) => spot.master),
  );
  const media = card?.media?.url || safeWebUrl(card?.url || "");
  const embedVideo = card?.kind === "video" && !card.media ? videoEmbedUrl(card.url) : null;
  return (
    <main
      className={"tnp-tour-player" + (embed ? " tnp-tour-embed" : "")}
      style={{ "--tnp-tour-color": doc.settings.themeColor } as React.CSSProperties}
    >
      <header className="flex-wrap gap-3">
        {doc.settings.logo?.url ? (
          <img src={doc.settings.logo.url} className="tnp-tour-brand" alt="Tour logo" />
        ) : (
          <a href="/" className="font-bold">
            TNP
          </a>
        )}
        <div className="flex-1">
          {doc.settings.showTitle && <h1>{doc.title}</h1>}
          <p className="text-sm text-slate-300">{scene.name}</p>
        </div>
        {!embed&&<TourDashboardLink/>}
      </header>
      <PropertyTourLayout tourId={doc.id} embed={embed}>
      <div className="relative">
        <TourCanvas
          scene={scene}
          settings={doc.settings}
          masterHotspots={masters}
          targetView={arrival}
          onPosition={(value) => {
            position.current = value;
          }}
          onHotspot={hotspot}
        />
        <div className="absolute bottom-14 left-3 z-10 flex gap-2">
          {doc.settings.floorPlan?.url && doc.settings.showFloorPlan && (
            <button
              className="rounded-lg bg-white px-3 py-2 text-sm text-slate-950"
              aria-expanded={plan}
              onClick={() => setPlan(!plan)}
            >
              Floor plan
            </button>
          )}
          {doc.settings.audio?.url && (
            <button
              className="rounded-lg bg-white px-3 py-2 text-sm text-slate-950"
              aria-pressed={audioOn}
              onClick={async () => {
                try {
                  if (audioOn) audio.current?.pause();
                  else await audio.current?.play();
                  setAudioOn(!audioOn);
                } catch {
                  setMessage("Audio could not play on this device.");
                }
              }}
            >
              {audioOn ? "Mute audio" : "Play audio"}
            </button>
          )}
        </div>
        {plan && (
          <div className="absolute bottom-28 left-3 z-10 w-[min(85%,350px)]">
            <FloorPlan doc={doc} sceneId={scene.id} onScene={navigate} />
          </div>
        )}
        {card && (
          <div role="dialog" aria-modal="true" aria-label={card.label} className="tnp-tour-card">
            <button
              type="button"
              aria-label="Close information card"
              className="rounded-lg border px-3 py-1"
              onClick={() => setCard(null)}
            >
              ×
            </button>
            <h2 className="mb-3 text-xl font-bold">{card.label}</h2>
            <p className="mb-4 whitespace-pre-wrap text-sm">{card.body}</p>
            {card.kind === "image" && media && <img src={media} alt={card.label} />}
            {card.kind === "video" &&
              media &&
              (embedVideo ? (
                <iframe
                  src={embedVideo}
                  title={card.label}
                  allow="fullscreen; picture-in-picture"
                  allowFullScreen
                  className="aspect-video w-full border-0"
                />
              ) : (
                <video src={media} controls playsInline preload="metadata" />
              ))}
          </div>
        )}
      </div>
      </PropertyTourLayout>
      {doc.settings.showThumbnails && (
        <nav className="tnp-tour-scenes" aria-label="Tour rooms">
          {doc.scenes.map((item) => (
            <button
              key={item.id}
              aria-pressed={scene.id === item.id}
              onClick={() => navigate(item.id)}
            >
              <img src={item.panorama_url} alt="" loading="lazy" />
              <span>{item.name}</span>
            </button>
          ))}
        </nav>
      )}
      {doc.description && !embed && (
        <p className="px-5 py-4 text-sm text-slate-300">{doc.description}</p>
      )}
      {message && (
        <p role="status" className="px-5 text-sm">
          {message}
        </p>
      )}
      {doc.settings.audio?.url && (
        <audio ref={audio} src={doc.settings.audio.url} loop preload="none" />
      )}
    </main>
  );
}
