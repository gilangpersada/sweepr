import { ArrowUpIcon } from "./icons";

export interface Crumb {
  id: number;
  name: string;
}

interface Props {
  trail: Crumb[];
  /** Jump to `trail[index]`. */
  onNavigate: (index: number) => void;
}

export function Breadcrumb({ trail, onNavigate }: Props) {
  const last = trail.length - 1;
  return (
    <nav aria-label="Lokasi folder" className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        disabled={last === 0}
        onClick={() => onNavigate(last - 1)}
        title="Naik satu folder (Backspace)"
        className="shrink-0 rounded-md border border-zinc-300 p-1.5 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        <ArrowUpIcon />
        <span className="sr-only">Naik satu folder</span>
      </button>
      <ol className="flex min-w-0 flex-wrap items-center text-sm">
        {trail.map((c, i) => (
          <li key={c.id} className="flex min-w-0 items-center">
            {i > 0 && <span className="px-1 text-zinc-400">›</span>}
            {i === last ? (
              <span aria-current="page" className="truncate font-medium">
                {c.name}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(i)}
                className="truncate text-blue-600 hover:underline dark:text-blue-400"
              >
                {c.name}
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
