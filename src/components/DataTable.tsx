import clsx from "clsx";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Empty, ErrorBox, Loading } from "./ui";

export interface Column<R> {
  key: string;
  header: ReactNode;
  render: (row: R) => ReactNode;
  className?: string;
  sort?: (row: R) => string | number;
}

export function DataTable<R>({
  rows,
  columns,
  rowKey,
  loading,
  error,
  rowLink,
  searchable,
  searchText,
  emptyTitle = "Nothing here yet",
  emptyHint,
  emptyAction,
  toolbar,
  pageSize = 15,
  dense,
}: {
  rows: R[] | undefined;
  columns: Column<R>[];
  rowKey: (r: R) => string;
  loading?: boolean;
  error?: unknown;
  rowLink?: (r: R) => string;
  searchable?: boolean;
  searchText?: (r: R) => string;
  emptyTitle?: string;
  emptyHint?: ReactNode;
  emptyAction?: ReactNode;
  toolbar?: ReactNode;
  pageSize?: number;
  dense?: boolean;
}) {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const filtered = useMemo(() => {
    let r = rows ?? [];
    if (q && searchText) {
      const s = q.toLowerCase();
      r = r.filter((x) => searchText(x).toLowerCase().includes(s));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sort) {
        const f = col.sort;
        r = [...r].sort((a, b) => {
          const va = f(a);
          const vb = f(b);
          return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
        });
      }
    }
    return r;
  }, [rows, q, searchText, sort, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const p = Math.min(page, pages - 1);
  const visible = filtered.slice(p * pageSize, (p + 1) * pageSize);

  return (
    <div className="card overflow-hidden">
      {(searchable || toolbar) && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-line">
          {searchable && (
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="h-4 w-4 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                className="input pl-8 py-1.5"
                placeholder="Search…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
              />
            </div>
          )}
          <div className="flex-1" />
          {toolbar}
        </div>
      )}
      {error ? (
        <div className="p-4">
          <ErrorBox error={error} />
        </div>
      ) : loading && !rows ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <Empty title={q ? "No matches" : emptyTitle} action={q ? undefined : emptyAction}>
          {q ? `Nothing matches "${q}".` : emptyHint}
        </Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-raised/60">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={clsx("table-th", c.sort && "cursor-pointer hover:text-ink", c.className)}
                    onClick={() => c.sort && setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }))}
                  >
                    {c.header}
                    {sort?.key === c.key && <span className="ml-1">{sort.dir === 1 ? "↑" : "↓"}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={rowKey(r)}
                  className={clsx(rowLink && "cursor-pointer hover:bg-raised/70")}
                  onClick={(e) => {
                    if (!rowLink) return;
                    if ((e.target as HTMLElement).closest("a,button,input,select")) return;
                    nav(rowLink(r));
                  }}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={clsx("table-td", dense && "py-1.5", c.className)}>
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > pageSize && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-line text-xs text-muted">
          <span>
            {p * pageSize + 1}–{Math.min(filtered.length, (p + 1) * pageSize)} of {filtered.length}
          </span>
          <div className="flex gap-1">
            <button className="btn-ghost btn-sm" disabled={p === 0} onClick={() => setPage(p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="btn-ghost btn-sm" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
