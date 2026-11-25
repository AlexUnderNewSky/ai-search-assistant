export function serverError(scope: string, err: unknown, fallback: string) {
  console.error(`[${scope}]`, err);
  const message = err instanceof Error ? err.message : String(err);
  const hint = /ECONNREFUSED|connect/i.test(message)
    ? " Is PostgreSQL running? Try `npm run db:up`."
    : /relation "products" does not exist/i.test(message)
      ? " Run `npm run db:seed` first."
      : "";
  const exposed = process.env.NODE_ENV !== "production";
  return Response.json({ error: exposed ? `${message}${hint}` : fallback }, { status: 500 });
}
