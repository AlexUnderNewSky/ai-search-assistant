import type { Product } from "@/lib/catalog";
import { StarIcon } from "@/components/icons";

const categoryTint: Record<string, string> = {
  Audio: "from-violet-500/15 to-fuchsia-500/10",
  Laptops: "from-sky-500/15 to-indigo-500/10",
  "Phones & Tablets": "from-cyan-500/15 to-blue-500/10",
  Wearables: "from-rose-500/15 to-orange-500/10",
  "Smart Home": "from-amber-500/15 to-yellow-500/10",
  Kitchen: "from-orange-500/15 to-red-500/10",
  Outdoor: "from-emerald-500/15 to-lime-500/10",
  Fitness: "from-teal-500/15 to-emerald-500/10",
  Office: "from-slate-500/15 to-zinc-500/10",
};

export function ProductCard({ product, reason, rank }: { product: Product; reason?: string; rank?: number }) {
  const inStock = product.stock > 0;
  const lowStock = inStock && product.stock < 10;

  return (
    <article className="animate-fade-up group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className={`relative grid h-28 place-items-center bg-gradient-to-br ${categoryTint[product.category] ?? "from-zinc-500/15 to-zinc-500/5"}`}>
        <span className="text-5xl transition group-hover:scale-110" aria-hidden>
          {product.image}
        </span>
        {rank === 1 && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-fg">
            Best match
          </span>
        )}
        <span
          className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            !inStock ? "bg-surface text-danger" : lowStock ? "bg-surface text-warning" : "bg-surface text-success"
          }`}
        >
          {!inStock ? "Out of stock" : lowStock ? `Only ${product.stock} left` : "In stock"}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="text-xs text-muted">
          {product.brand} · {product.category}
        </div>
        <h3 className="font-semibold leading-snug">{product.name}</h3>
        {reason && <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm leading-snug">{reason}</p>}
        <div className="mt-auto flex items-end justify-between pt-2">
          <span className="text-xl font-semibold tabular-nums">${product.price.toLocaleString("en-US")}</span>
          <span className="flex items-center gap-1 text-sm text-muted">
            <StarIcon className="size-4 text-amber-400" />
            <span className="tabular-nums">{product.rating.toFixed(1)}</span>
          </span>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="skeleton h-28" />
      <div className="space-y-2 p-4">
        <div className="skeleton h-3 w-1/3 rounded" />
        <div className="skeleton h-4 w-4/5 rounded" />
        <div className="skeleton h-10 rounded-xl" />
        <div className="skeleton h-5 w-1/4 rounded" />
      </div>
    </div>
  );
}
