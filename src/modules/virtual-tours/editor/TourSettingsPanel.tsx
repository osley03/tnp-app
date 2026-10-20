import type { TourDocument } from "../types";
import { AssetUpload } from "../components/AssetUpload";
import { FloorPlan } from "../components/FloorPlan";
export function TourSettingsPanel({
  doc,
  sceneId,
  password,
  onPassword,
  change,
  onScene,
}: {
  doc: TourDocument;
  sceneId: string;
  password: string;
  onPassword: (value: string) => void;
  change: (fn: (doc: TourDocument) => void) => void;
  onScene: (id: string) => void;
}) {
  return (
    <section>
      <h2>Tour settings</h2>
      <label>
        Title
        <input
          maxLength={120}
          value={doc.title}
          onChange={(event) =>
            change((value) => {
              value.title = event.target.value;
            })
          }
        />
      </label>
      <label>
        Description
        <textarea
          maxLength={4000}
          rows={3}
          value={doc.description}
          onChange={(event) =>
            change((value) => {
              value.description = event.target.value;
            })
          }
        />
      </label>
      <label>
        Starting room
        <select
          value={doc.settings.startSceneId || doc.scenes[0]?.id || ""}
          onChange={(event) =>
            change((value) => {
              value.settings.startSceneId = event.target.value;
            })
          }
        >
          {doc.scenes.map((scene) => (
            <option value={scene.id} key={scene.id}>
              {scene.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Transition
        <select
          value={doc.settings.transition}
          onChange={(event) =>
            change((value) => {
              value.settings.transition = event.target
                .value as TourDocument["settings"]["transition"];
            })
          }
        >
          <option value="fade">Crossfade</option>
          <option value="zoom">Walk-in (zoom and fade)</option>
          <option value="none">Instant</option>
        </select>
      </label>
      {(
        [
          ["walkthrough", "Keep walking direction between rooms"],
          ["autorotate", "Start with automatic rotation"],
          ["showThumbnails", "Show scene thumbnails"],
          ["showTitle", "Show title"],
          ["showFloorPlan", "Show floor plan"],
        ] as const
      ).map(([key, label]) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={doc.settings[key]}
            onChange={(event) =>
              change((value) => {
                value.settings[key] = event.target.checked;
              })
            }
          />
          {label}
        </label>
      ))}
      <label>
        Rotation speed (rpm)
        <input
          type="number"
          min={0.1}
          max={4}
          step={0.1}
          value={doc.settings.rotateSpeed}
          onChange={(event) =>
            change((value) => {
              value.settings.rotateSpeed = Math.max(0.1, Math.min(4, Number(event.target.value)));
            })
          }
        />
      </label>
      <h3>Access</h3>
      <label>
        Visibility
        <select
          value={doc.visibility}
          onChange={(event) =>
            change((value) => {
              value.visibility = event.target.value as TourDocument["visibility"];
            })
          }
        >
          <option value="public">Public</option>
          <option value="unlisted">Unlisted — anyone with link</option>
          <option value="private">Private — owner and invited accounts</option>
          <option value="password">Password protected</option>
        </select>
      </label>
      {doc.visibility === "password" && (
        <label>
          Set/change password
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(event) => onPassword(event.target.value)}
          />
          <small>8–128 characters. Leave blank to keep the saved password.</small>
        </label>
      )}
      <label>
        <input
          type="checkbox"
          checked={doc.is_published}
          onChange={(event) =>
            change((value) => {
              value.is_published = event.target.checked;
            })
          }
        />
        Published
      </label>
      <small>
        Save to apply publishing and access changes. Private tours stay restricted even when
        published.
      </small>
      <h3>Brand and media</h3>
      <label>
        Accent colour
        <input
          type="color"
          value={doc.settings.themeColor}
          onChange={(event) =>
            change((value) => {
              value.settings.themeColor = event.target.value;
            })
          }
        />
      </label>
      <AssetUpload
        label="Logo"
        ownerId={doc.owner_id}
        tourId={doc.id}
        value={doc.settings.logo}
        onChange={(media) =>
          change((value) => {
            value.settings.logo = media;
          })
        }
      />
      <AssetUpload
        label="Background audio"
        kind="audio"
        ownerId={doc.owner_id}
        tourId={doc.id}
        value={doc.settings.audio}
        onChange={(media) =>
          change((value) => {
            value.settings.audio = media;
          })
        }
      />
      <h3>Interactive floor plan</h3>
      <AssetUpload
        label="Floor-plan image"
        ownerId={doc.owner_id}
        tourId={doc.id}
        value={doc.settings.floorPlan}
        onChange={(media) =>
          change((value) => {
            value.settings.floorPlan = media;
            if (!media) value.settings.floorPins = [];
          })
        }
      />
      {doc.settings.floorPlan && (
        <>
          <small>
            Select a room on the left, then click its location on the plan. Click an existing pin to
            select its room.
          </small>
          <FloorPlan
            doc={doc}
            sceneId={sceneId}
            onScene={onScene}
            onPin={(x, y) =>
              change((value) => {
                value.settings.floorPins = value.settings.floorPins.filter(
                  (pin) => pin.sceneId !== sceneId,
                );
                value.settings.floorPins.push({ sceneId, x, y });
              })
            }
          />
          <button
            type="button"
            className="mt-3"
            onClick={() =>
              change((value) => {
                value.settings.floorPins = value.settings.floorPins.filter(
                  (pin) => pin.sceneId !== sceneId,
                );
              })
            }
          >
            Remove current room pin
          </button>
        </>
      )}
    </section>
  );
}
