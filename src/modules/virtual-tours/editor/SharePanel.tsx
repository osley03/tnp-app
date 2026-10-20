import { useEffect, useState } from "react";
import { listMembers, changeMember, viewCount } from "../api/tours";
import { embedCode } from "../lib/model";
import { tourLink } from "@/lib/tour-links";
import { supabase } from "@/integrations/supabase/client";
import type { TourDocument } from "../types";
export function SharePanel({ doc }: { doc: TourDocument }) {
  const url = tourLink(doc.id, window.location.origin);
  const [message, setMessage] = useState("");
  const [members, setMembers] = useState<Array<{ viewer_id: string }>>([]);
  const [profiles, setProfiles] = useState<Array<{ id: string; full_name: string }>>([]);
  const [viewer, setViewer] = useState("");
  const [views, setViews] = useState<number | null>(null);
  useEffect(() => {
    void Promise.all([
      listMembers(doc.id),
      viewCount(doc.id),
      supabase.from("profiles").select("id,full_name"),
    ])
      .then(([list, count, people]) => {
        setMembers(list);
        setViews(count);
        setProfiles(people.data || []);
      })
      .catch((error) =>
        setMessage(error instanceof Error ? error.message : "Could not load sharing settings."),
      );
  }, [doc.id]);
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Copied.");
    } catch {
      setMessage("Select and copy the field manually.");
    }
  }
  return (
    <section>
      <h2>Share and embed</h2>
      <p className="text-sm text-slate-600">
        Save and publish your tour first. Private tours require an invited TNP account; password
        tours ask visitors to unlock them.
      </p>
      <label>
        Tour URL
        <input readOnly value={url} onFocus={(event) => event.target.select()} />
      </label>
      <button type="button" onClick={() => void copy(url)}>
        Copy property-form URL
      </button>
      <a
        className="tnp-tour-button ml-2 inline-block"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Preview
      </a>
      <label>
        Embed code
        <textarea
          readOnly
          rows={5}
          value={embedCode(doc.id, window.location.origin)}
          onFocus={(event) => event.target.select()}
        />
      </label>
      <button type="button" onClick={() => void copy(embedCode(doc.id, window.location.origin))}>
        Copy embed code
      </button>
      <p className="mt-4 text-sm">Authorized viewer requests: {views === null ? "…" : views}</p>
      <small>
        Includes previews, repeat requests and automatic media refreshes; not a unique-visitor
        count.
      </small>
      <h3>Invite a TNP account</h3>
      <label>
        Account
        <select value={viewer} onChange={(event) => setViewer(event.target.value)}>
          <option value="">Select account</option>
          {profiles
            .filter(
              (profile) =>
                profile.id !== doc.owner_id &&
                !members.some((member) => member.viewer_id === profile.id),
            )
            .map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.full_name || profile.id}
              </option>
            ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!viewer}
        onClick={async () => {
          try {
            await changeMember(doc.id, viewer);
            setMembers(await listMembers(doc.id));
            setViewer("");
            setMessage("Access granted.");
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not invite account.");
          }
        }}
      >
        Grant access
      </button>
      {members.map((member) => (
        <div key={member.viewer_id} className="mt-3 flex items-center justify-between gap-2">
          <span className="break-all text-xs">
            {profiles.find((profile) => profile.id === member.viewer_id)?.full_name ||
              member.viewer_id}
          </span>
          <button
            type="button"
            onClick={async () => {
              try {
                await changeMember(doc.id, member.viewer_id, true);
                setMembers(await listMembers(doc.id));
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Could not remove access.");
              }
            }}
          >
            Revoke
          </button>
        </div>
      ))}
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
