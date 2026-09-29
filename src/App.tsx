import { useState } from "react";
import { useScan } from "./hooks/useScan";
import { Cleaner } from "./views/Cleaner";
import { Home } from "./views/Home";
import { ScanResult } from "./views/ScanResult";

type Page = "main" | "cleaner";

function App() {
  const { state, start, cancel, reset } = useScan();
  const [page, setPage] = useState<Page>("main");

  const scan = (path: string) => void start(path);
  const openCleaner = () => setPage("cleaner");
  const onMain = page === "main";

  return (
    <main className="flex h-screen flex-col bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
      {/* Kept mounted while the cleaner is open so the folder position survives. */}
      <div className={onMain ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
        {state.status === "finished" ? (
          // Keyed by scan so a rescan starts at the root with fresh state.
          <ScanResult
            key={state.result.scanId}
            result={state.result}
            active={onMain}
            onHome={reset}
            onRescan={scan}
            onOpenCleaner={openCleaner}
          />
        ) : (
          <Home scan={state} onScan={scan} onCancel={cancel} onOpenCleaner={openCleaner} />
        )}
      </div>
      {page === "cleaner" && <Cleaner onBack={() => setPage("main")} />}
    </main>
  );
}

export default App;
