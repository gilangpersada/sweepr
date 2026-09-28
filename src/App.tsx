import { useState } from "react";
import { ping, type PingResponse } from "./lib/api";

function App() {
  const [result, setResult] = useState<PingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePing() {
    setLoading(true);
    setError(null);
    try {
      setResult(await ping());
    } catch (err) {
      setResult(null);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white p-8 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
      <h1 className="text-3xl font-semibold">Sweepr</h1>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">
        Analisis ruang disk dan pembersih yang aman.
      </p>

      <section className="mt-8 flex items-center gap-4">
        <button
          type="button"
          onClick={handlePing}
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Menghubungi…" : "Tes koneksi ke Rust"}
        </button>

        {result && (
          <p data-testid="ping-result">
            Balasan: <strong>{result.message}</strong> (versi {result.appVersion})
          </p>
        )}
        {error && <p className="text-red-600 dark:text-red-400">Gagal: {error}</p>}
      </section>
    </main>
  );
}

export default App;
