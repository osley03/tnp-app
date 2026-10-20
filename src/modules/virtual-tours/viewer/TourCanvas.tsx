import { useEffect, useRef, useState } from "react";
import type { Viewer } from "@photo-sphere-viewer/core";
import type { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import type { AutorotatePlugin } from "@photo-sphere-viewer/autorotate-plugin";
import type { GyroscopePlugin } from "@photo-sphere-viewer/gyroscope-plugin";
import type { Hotspot, TourScene, TourSettings, ViewPosition } from "../types";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import "../tour-studio.css";

type Props = {
  scene: TourScene;
  settings: TourSettings;
  masterHotspots?: Hotspot[];
  editMode?: boolean;
  placing?: boolean;
  targetView?: ViewPosition | null;
  onPosition?: (position: ViewPosition) => void;
  onPlace?: (position: ViewPosition) => void;
  onHotspot: (hotspot: Hotspot) => void;
  selectedHotspotId?: string | null;
};
export function TourCanvas(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loaded, setLoaded] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const markers = useRef<MarkersPlugin | null>(null);
  const rotate = useRef<AutorotatePlugin | null>(null);
  const gyro = useRef<GyroscopePlugin | null>(null);
  const [rotationOn, setRotationOn] = useState(false);
  const [gyroOn, setGyroOn] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let instance: Viewer | undefined;
    void Promise.all([
      import("@photo-sphere-viewer/core"),
      import("@photo-sphere-viewer/markers-plugin"),
      import("@photo-sphere-viewer/autorotate-plugin"),
      import("@photo-sphere-viewer/gyroscope-plugin"),
    ])
      .then(([core, marker, autorotate, gyroscope]) => {
        if (cancelled || !host.current) return;
        instance = new core.Viewer({
          container: host.current,
          navbar: ["zoom", "move", "fullscreen"],
          defaultZoomLvl: 0,
          mousemove: true,
          touchmoveTwoFingers: false,
          plugins: [
            marker.MarkersPlugin,
            [autorotate.AutorotatePlugin, { autostartDelay: null, autorotateSpeed: "0.5rpm" }],
            gyroscope.GyroscopePlugin,
          ],
        });
        markers.current = instance.getPlugin<MarkersPlugin>(marker.MarkersPlugin);
        rotate.current = instance.getPlugin<AutorotatePlugin>(autorotate.AutorotatePlugin);
        gyro.current = instance.getPlugin<GyroscopePlugin>(gyroscope.GyroscopePlugin);
        markers.current.addEventListener("select-marker", (event) => {
          const spot = event.marker.config.data as Hotspot;
          callbacks.current.onHotspot(spot);
        });
        instance.addEventListener("click", (event) => {
          if (callbacks.current.editMode && callbacks.current.placing)
            callbacks.current.onPlace?.({
              yaw: event.data.yaw,
              pitch: event.data.pitch,
              zoom: instance!.getZoomLevel(),
            });
        });
        let last = 0;
        const report = () => {
          if (Date.now() - last > 120) {
            last = Date.now();
            callbacks.current.onPosition?.({
              ...instance!.getPosition(),
              zoom: instance!.getZoomLevel(),
            });
          }
        };
        instance.addEventListener("position-updated", report);
        instance.addEventListener("zoom-updated", report);
        setViewer(instance);
      })
      .catch(() =>
        setError("The panorama viewer could not start. Try a browser with WebGL enabled."),
      );
    return () => {
      cancelled = true;
      instance?.destroy();
      markers.current = null;
      rotate.current = null;
      gyro.current = null;
    };
  }, []);
  useEffect(() => {
    if (!viewer) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    const position = props.targetView || {
      yaw: props.scene.settings.yaw,
      pitch: props.scene.settings.pitch,
      zoom: props.scene.settings.zoom,
    };
    const load = async () => {
      try {
        markers.current?.clearMarkers();
        if (props.settings.transition === "zoom" && loaded)
          await viewer.animate({ zoom: Math.min(100, viewer.getZoomLevel() + 15), speed: 220 });
        const ok = await viewer.setPanorama(props.scene.panorama_url, {
          position: { yaw: position.yaw, pitch: position.pitch },
          zoom: position.zoom,
          transition:
            props.settings.transition === "none"
              ? false
              : { effect: "fade", speed: 650, rotation: false },
        });
        if (ok && !cancelled) setLoaded(props.scene.id);
      } catch {
        if (!cancelled)
          setError("Could not load this scene. Reload the tour to refresh its media links.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [viewer, props.scene.id, props.scene.panorama_url]);
  useEffect(() => {
    if (!viewer || loaded !== props.scene.id || !markers.current) return;
    const spots = [
      ...props.scene.settings.hotspots,
      ...(props.masterHotspots || []).filter(
        (spot) => !props.scene.settings.hotspots.some((local) => local.id === spot.id),
      ),
    ];
    markers.current.setMarkers(
      spots
        .filter(
          (spot) =>
            props.editMode || spot.kind !== "scene" || spot.targetSceneId !== props.scene.id,
        )
        .map((spot) => {
          const element = document.createElement("button");
          element.type = "button";
          element.className =
            "tnp-tour-hotspot" +
            (spot.pulse ? " tnp-tour-pulse" : "") +
            (props.selectedHotspotId === spot.id ? " tnp-tour-selected" : "");
          element.setAttribute("aria-label", spot.label);
          element.title = spot.label;
          element.style.background = spot.color;
          element.style.opacity = String(spot.opacity);
          element.style.fontSize = 18 * spot.scale + "px";
          const icon = document.createElement("span");
          icon.textContent = { arrow: "➜", door: "↪", info: "i", play: "▶", image: "▣" }[spot.icon];
          icon.style.transform = "rotate(" + spot.rotation + "deg)";
          if (spot.customIcon?.url) {
            const image = document.createElement("img");
            image.src = spot.customIcon.url;
            image.alt = "";
            image.style.width = "100%";
            image.style.height = "100%";
            image.style.objectFit = "contain";
            icon.textContent = "";
            icon.append(image);
          }
          const label = document.createElement("span");
          label.className = "tnp-tour-hotspot-label";
          label.textContent = spot.label;
          element.append(icon, label);
          return {
            id: spot.id,
            element,
            position: { yaw: spot.yaw, pitch: spot.pitch },
            data: spot,
            size: { width: 42 * spot.scale, height: 42 * spot.scale },
          };
        }),
    );
  }, [viewer, loaded, props.scene, props.masterHotspots, props.selectedHotspotId, props.editMode]);
  useEffect(() => {
    if (!rotate.current || !loaded) return;
    rotate.current.setOptions({ autorotateSpeed: props.settings.rotateSpeed + "rpm" });
    if (props.settings.autorotate && !props.editMode) {
      rotate.current.start();
      setRotationOn(true);
    } else {
      rotate.current.stop();
      setRotationOn(false);
    }
  }, [loaded, props.settings.autorotate, props.settings.rotateSpeed, props.editMode]);
  useEffect(() => {
    const canvas = host.current?.querySelector("canvas");
    if (canvas)
      canvas.style.filter =
        "brightness(" +
        props.scene.settings.brightness +
        ") contrast(" +
        props.scene.settings.contrast +
        ") saturate(" +
        props.scene.settings.saturation +
        ")";
  }, [
    loaded,
    props.scene.settings.brightness,
    props.scene.settings.contrast,
    props.scene.settings.saturation,
  ]);
  return (
    <div className="tnp-tour-canvas">
      <div ref={host} className="tnp-tour-sphere" />
      {loading && (
        <p role="status" className="tnp-tour-notice">
          Loading panorama…
        </p>
      )}
      {error && (
        <p role="alert" className="tnp-tour-notice tnp-tour-error">
          {error}
        </p>
      )}
      {props.placing && <p className="tnp-tour-notice">Click the panorama to place a hotspot</p>}
      {!props.editMode && (
        <div className="tnp-tour-motion">
          <button
            type="button"
            aria-pressed={rotationOn}
            onClick={() => {
              if (rotationOn) rotate.current?.stop();
              else rotate.current?.start();
              setRotationOn(!rotationOn);
            }}
          >
            Auto rotate
          </button>
          <button
            type="button"
            aria-pressed={gyroOn}
            onClick={async () => {
              try {
                if (gyroOn) gyro.current?.stop();
                else await gyro.current?.start();
                setGyroOn(!gyroOn);
              } catch {
                setError(
                  "Motion control is unavailable or permission was declined on this device.",
                );
              }
            }}
          >
            Phone motion
          </button>
        </div>
      )}
    </div>
  );
}
