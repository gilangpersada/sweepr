import { useScan } from "./hooks/useScan";
import { Home } from "./views/Home";
import { ScanResult } from "./views/ScanResult";

function App() {
  const { state, start, cancel, reset } = useScan();

  const scan = (path: string) => void start(path);

  return (
    <main className="flex h-screen flex-col bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
      {state.status === "finished" ? (
        // Keyed by scan so a rescan starts at the root with fresh state.
        <ScanResult
          key={state.result.scanId}
          result={state.result}
          onHome={reset}
          onRescan={scan}
        />
      ) : (
        <Home scan={state} onScan={scan} onCancel={cancel} />
      )}
    </main>
  );
}

export default App;
