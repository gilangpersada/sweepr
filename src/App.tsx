import { ScanDebug } from "./views/ScanDebug";

function App() {
  return (
    <main className="min-h-screen bg-white p-8 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
      <h1 className="text-3xl font-semibold">Sweepr</h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        Analisis ruang disk dan pembersih yang aman.
      </p>
      <ScanDebug />
    </main>
  );
}

export default App;
