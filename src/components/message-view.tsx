"use client";

import type { ChatMessage } from "@/lib/ai/tools";
import { Markdown } from "@/components/markdown";
import { ProductCard, ProductCardSkeleton } from "@/components/product-card";
import { DbIcon, WrenchIcon } from "@/components/icons";

type Part = ChatMessage["parts"][number];
type SearchInput = Extract<Part, { type: "tool-searchCatalog" }>["input"];

export function MessageView({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return (
      <div className="animate-fade-up flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-accent-fg">{text}</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-3">
      {message.parts.map((part, i) => (
        <PartView key={i} part={part} />
      ))}
    </div>
  );
}

function PartView({ part }: { part: Part }) {
  switch (part.type) {
    case "text":
      return part.text ? <Markdown text={part.text} /> : null;

    case "tool-searchCatalog": {
      const pending = part.state === "input-streaming" || part.state === "input-available";
      return (
        <ToolChip icon={<DbIcon className="size-3.5" />} pending={pending} error={part.state === "output-error"}>
          {part.state === "output-available"
            ? `Searched catalog: ${part.output.count} matches${part.output.cached ? " (cached)" : ""}`
            : part.state === "output-error"
              ? "Catalog search failed"
              : "Searching catalog"}
          {part.input && <FilterSummary input={part.input} />}
        </ToolChip>
      );
    }

    case "tool-getProductDetails": {
      const pending = part.state === "input-streaming" || part.state === "input-available";
      return (
        <ToolChip icon={<WrenchIcon className="size-3.5" />} pending={pending} error={part.state === "output-error"}>
          {pending ? "Reading product details" : "Read product details"}
        </ToolChip>
      );
    }

    case "tool-showRecommendations": {
      if (part.state === "output-error") {
        return <ToolChip icon={<WrenchIcon className="size-3.5" />} error>Could not render recommendations</ToolChip>;
      }
      if (part.state !== "output-available") {
        const n = Math.max(1, part.input?.items?.length ?? 2);
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: Math.min(n, 4) }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        );
      }
      const { title, cards } = part.output;
      if (!cards.length) return null;
      return (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted">{title}</h2>
          <div className={`grid gap-3 ${cards.length === 1 ? "sm:max-w-sm" : "sm:grid-cols-2"}`}>
            {cards.map((c, i) => (
              <ProductCard key={c.product.id} product={c.product} reason={c.reason} rank={i + 1} />
            ))}
          </div>
        </section>
      );
    }

    default:
      return null;
  }
}

function ToolChip(props: { icon: React.ReactNode; pending?: boolean; error?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-border bg-surface px-3 py-1 text-xs ${
        props.error ? "text-danger" : "text-muted"
      }`}
    >
      <span className={props.pending ? "animate-pulse text-accent" : ""}>{props.icon}</span>
      {props.children}
      {props.pending && <span className="animate-pulse">…</span>}
    </div>
  );
}

function FilterSummary({ input }: { input: Partial<NonNullable<SearchInput>> }) {
  const bits = [
    input.query && `"${input.query}"`,
    input.category,
    input.minPrice != null && `≥ $${input.minPrice}`,
    input.maxPrice != null && `≤ $${input.maxPrice}`,
    input.minRating != null && `★ ${input.minRating}+`,
    input.inStockOnly && "in stock",
    input.sortBy && input.sortBy !== "relevance" && input.sortBy.replace("_", " "),
  ].filter(Boolean);
  if (!bits.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {bits.map((b) => (
        <span key={String(b)} className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-fg">
          {b}
        </span>
      ))}
    </span>
  );
}
