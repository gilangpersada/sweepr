import { useI18n } from "../lib/i18n";
import { ArrowUpIcon } from "./icons";
import { Button } from "./ui/Button";

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
  const { t } = useI18n();
  const last = trail.length - 1;
  return (
    <nav aria-label={t.breadcrumb.label} className="flex min-w-0 items-center gap-3">
      <Button
        size="icon"
        disabled={last === 0}
        onClick={() => onNavigate(last - 1)}
        title={t.breadcrumb.upHint}
      >
        <ArrowUpIcon />
        <span className="sr-only">{t.breadcrumb.up}</span>
      </Button>
      <ol className="flex min-w-0 flex-wrap items-center gap-y-1 text-sm">
        {trail.map((c, i) => (
          <li key={c.id} className="flex min-w-0 items-center">
            {i > 0 && (
              <span aria-hidden="true" className="px-1.5 font-bold text-muted">
                /
              </span>
            )}
            {i === last ? (
              <span
                aria-current="page"
                className="truncate rounded-sm border-2 border-line bg-primary px-1.5 font-bold text-on-accent"
              >
                {c.name}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(i)}
                className="truncate rounded-sm border-2 border-transparent px-1.5 font-medium hover:border-line hover:bg-sunken"
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
