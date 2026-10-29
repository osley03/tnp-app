import {TourDashboardLink} from '../components/TourDashboardLink';
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { readSharedTour } from "../api/tours";
import { TourPlayer } from "./TourPlayer";
import { supabase } from "@/integrations/supabase/client";
export function SharedTourPage({ id }: { id: string }) {
  const [password, setPassword] = useState("");
  const submitted = useRef("");
  const [attempt, setAttempt] = useState(0);
  const query = useQuery({
    queryKey: ["shared-tnp-tour", id, attempt],
    queryFn: () => readSharedTour(id, submitted.current),
    retry: false,
    gcTime: 0,
    refetchInterval: 240000,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        submitted.current = "";
        setPassword("");
        setAttempt((value) => value + 1);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  const embed = new URLSearchParams(window.location.search).get("embed") === "1";
  if (query.data && !query.error) return <TourPlayer doc={query.data} embed={embed} />;
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-950 p-5 text-white">
      <div className="w-full max-w-sm rounded-2xl border border-white/20 p-6">
        <a href="/" className="font-bold text-amber-200">
          TNP Virtual Tours
        </a>
        {!embed&&<div className="mt-4"><TourDashboardLink/></div>}
        <h1 className="mt-4 text-xl font-bold">
          {query.isPending ? "Loading tour…" : "Open virtual tour"}
        </h1>
        {query.error && (
          <p role="alert" className="mt-3 text-sm text-slate-300">
            {query.error.message}
          </p>
        )}
        {!query.isPending && (
          <form
            className="mt-5"
            onSubmit={(event) => {
              event.preventDefault();
              submitted.current = password;
              setAttempt((value) => value + 1);
            }}
          >
            <label className="block text-sm">
              Tour password (if required)
              <input
                type="password"
                value={password}
                maxLength={128}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="mt-2 w-full rounded-lg bg-white p-3 text-slate-950"
              />
            </label>
            <button className="mt-4 w-full rounded-lg bg-amber-200 p-3 font-semibold text-slate-950">
              Unlock / retry
            </button>
            <a href="/auth" className="mt-4 block text-center text-sm underline">
              Sign in to an invited TNP account
            </a>
          </form>
        )}
      </div>
    </main>
  );
}
