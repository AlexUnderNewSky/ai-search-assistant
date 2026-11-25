"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { SuggestResponse } from "@/lib/ai/suggest";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { SearchIcon, SparkIcon, ArrowIcon, StopIcon } from "@/components/icons";

type Option =
  | { kind: "suggestion"; text: string }
  | { kind: "product"; text: string; product: SuggestResponse["products"][number] };

type Props = {
  onSubmit: (text: string) => void;
  onStop?: () => void;
  busy?: boolean;
  size?: "lg" | "md";
  autoFocus?: boolean;
  placeholder?: string;
};

const DEBOUNCE_MS = 220;
const MIN_CHARS = 2;

export function SearchBox({ onSubmit, onStop, busy, size = "lg", autoFocus, placeholder }: Props) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [result, setResult] = useState<{ key: string; data: SuggestResponse | null } | null>(null);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const debounced = useDebouncedValue(value.trim(), DEBOUNCE_MS);
  const enabled = debounced.length >= MIN_CHARS;

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    fetch(`/api/suggest?q=${encodeURIComponent(debounced)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<SuggestResponse>) : null))
      .then((data) => setResult({ key: debounced, data }))
      .catch((err: unknown) => {
        if ((err as Error).name !== "AbortError") setResult({ key: debounced, data: null });
      });
    return () => ctrl.abort();
  }, [debounced, enabled]);

  const data = enabled && result?.key === debounced ? result.data : null;
  const loading = enabled && result?.key !== debounced;

  const options = useMemo<Option[]>(() => {
    if (!data) return [];
    return [
      ...data.suggestions.map((text) => ({ kind: "suggestion" as const, text })),
      ...data.products.map((product) => ({
        kind: "product" as const,
        text: `Tell me about ${product.name}`,
        product,
      })),
    ];
  }, [data]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  function submit(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    onSubmit(q);
    setValue("");
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && options.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp" && options.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit(open && active >= 0 && options[active] ? options[active].text : value);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  const showDropdown = open && enabled && (loading || options.length > 0);
  const lg = size === "lg";

  return (
    <div ref={rootRef} className="relative w-full">
      <div
        className={`flex items-center gap-3 rounded-2xl border border-border bg-surface shadow-sm transition focus-within:border-accent focus-within:shadow-[0_0_0_4px_var(--ring)] ${
          lg ? "px-5 py-4" : "px-4 py-2.5"
        }`}
      >
        <SearchIcon className={`shrink-0 text-muted ${lg ? "size-5" : "size-4"}`} />
        <input
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoFocus={autoFocus}
          value={value}
          maxLength={500}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? "Ask anything about the catalog…"}
          className={`min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted ${lg ? "text-lg" : "text-[15px]"}`}
        />
        {busy && onStop ? (
          <button
            type="button"
            onClick={onStop}
            className="flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-1.5 text-sm font-medium text-fg transition hover:bg-border"
          >
            <StopIcon className="size-3.5" /> Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={() => submit(value)}
            disabled={!value.trim() || busy}
            aria-label="Search"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg transition hover:opacity-90 disabled:opacity-30"
          >
            <ArrowIcon className="size-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          className="animate-fade-up absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
        >
          {loading && options.length === 0 ? (
            <div className="space-y-2 p-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-7 rounded-lg" style={{ width: `${80 - i * 15}%` }} />
              ))}
            </div>
          ) : (
            <>
              {data && data.suggestions.length > 0 && (
                <Section label="Suggestions">
                  {options.map((o, i) =>
                    o.kind === "suggestion" ? (
                      <OptionRow key={`s-${o.text}`} id={`${listId}-${i}`} active={i === active} onPick={() => submit(o.text)} onHover={() => setActive(i)}>
                        <SparkIcon className="size-4 shrink-0 text-accent" />
                        <Highlighted text={o.text} query={debounced} />
                      </OptionRow>
                    ) : null,
                  )}
                </Section>
              )}
              {data && data.products.length > 0 && (
                <Section label="Products">
                  {options.map((o, i) =>
                    o.kind === "product" ? (
                      <OptionRow key={`p-${o.product.id}`} id={`${listId}-${i}`} active={i === active} onPick={() => submit(o.text)} onHover={() => setActive(i)}>
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-base">{o.product.image}</span>
                        <span className="min-w-0 flex-1 truncate">{o.product.name}</span>
                        <span className="text-sm tabular-nums text-muted">${o.product.price}</span>
                      </OptionRow>
                    ) : null,
                  )}
                </Section>
              )}
              {data && (
                <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted">
                  <span>↑↓ to navigate · Enter to ask</span>
                  <span className="font-mono">
                    {data.source === "ai" ? "llama via groq" : "db fallback"} · {data.ms}ms{data.cached ? " · cached" : ""}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <div className="px-4 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted">{label}</div>
      {children}
    </div>
  );
}

function OptionRow(props: { id: string; active: boolean; onPick: () => void; onHover: () => void; children: React.ReactNode }) {
  return (
    <div
      id={props.id}
      role="option"
      aria-selected={props.active}
      onPointerDown={(e) => e.preventDefault()}
      onClick={props.onPick}
      onPointerEnter={props.onHover}
      className={`mx-1.5 flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-[15px] ${props.active ? "bg-accent-soft" : ""}`}
    >
      {props.children}
    </div>
  );
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span className="min-w-0 flex-1 truncate">{text}</span>;
  return (
    <span className="min-w-0 flex-1 truncate">
      <span className="font-semibold">{text.slice(0, idx)}</span>
      {text.slice(idx, idx + query.length)}
      <span className="font-semibold">{text.slice(idx + query.length)}</span>
    </span>
  );
}
