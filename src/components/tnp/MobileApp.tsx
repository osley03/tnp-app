import { useEffect, useState } from "react";
type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
function dismissed() { try { return sessionStorage.getItem('tnp-install-dismissed') === 'yes'; } catch { return false; } }
export function MobileApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [offline, setOffline] = useState(false);
  const [ios, setIOS] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator && import.meta.env.PROD)
      void navigator.serviceWorker.register("/sw.js").catch(console.error);
    setIOS(
      !window.matchMedia("(display-mode: standalone)").matches &&
        /iPhone|iPad|iPod/.test(navigator.userAgent) &&
        !dismissed(),
    );
    const install = (event: Event) => {
      event.preventDefault();
      if (!dismissed()) setPrompt(event as InstallPrompt);
    };
    const installed = () => {
      setPrompt(null);
      setIOS(false);
    };
    const connection = () => setOffline(!navigator.onLine);
    connection();
    window.addEventListener("beforeinstallprompt", install);
    window.addEventListener("appinstalled", installed);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    return () => {
      window.removeEventListener("beforeinstallprompt", install);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
    };
  }, []);
  return (
    <>
      {offline && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-0 z-[90] bg-amber-100 px-4 py-3 text-center text-sm text-slate-950"
        >
          You’re offline. Reconnect to load or save account information.
        </div>
      )}
      {!offline && (prompt || ios) && (
        <aside
          aria-label="Install TNP"
          className="fixed inset-x-3 bottom-3 z-[80] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-950 shadow-xl"
        >
          <img src="/icons/housing-192.png" width="44" height="44" alt="" className="rounded-xl" />
          <div className="flex-1 text-sm">
            <strong>TNP on your phone</strong>
            <p className="mt-1 text-xs text-slate-600">
              {prompt
                ? "Install for quick access from your home screen."
                : "In Safari, tap Share, then Add to Home Screen."}
            </p>
          </div>
          {prompt && (
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
              onClick={async () => {
                await prompt.prompt();
                await prompt.userChoice;
                setPrompt(null);
              }}
            >
              Install
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss installation hint"
            className="p-2"
            onClick={() => {
              setPrompt(null);
              setIOS(false);
              try { sessionStorage.setItem("tnp-install-dismissed", "yes"); } catch { /* Storage may be disabled. */ }
            }}
          >
            ×
          </button>
        </aside>
      )}
    </>
  );
}
