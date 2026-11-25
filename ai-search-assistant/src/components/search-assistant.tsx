"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { ChatMessage } from "@/lib/ai/tools";
import { SearchBox } from "@/components/search-box";
import { MessageView } from "@/components/message-view";
import { BoltIcon, DbIcon, PlusIcon, SparkIcon, WrenchIcon } from "@/components/icons";

const EXAMPLES = [
  "Headphones for long flights under $300",
  "What should I buy for a home gym in a small apartment?",
  "Gift ideas for a coffee lover",
  "Compare the laptops for video editing",
  "Kitchen stuff under $100 rated 4.5+",
  "Подбери робот-пылесос для дома с собакой",
];

const transport = new DefaultChatTransport<ChatMessage>({ api: "/api/chat" });

export function SearchAssistant() {
  const { messages, sendMessage, status, stop, error, regenerate, setMessages, clearError } =
    useChat<ChatMessage>({ transport });
  const bottomRef = useRef<HTMLDivElement>(null);

  const busy = status === "submitted" || status === "streaming";
  const ask = (text: string) => {
    clearError();
    void sendMessage({ text });
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  if (messages.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16">
        <div className="mb-8 text-center">
          <Logo className="mx-auto mb-5" />
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Find the right thing, faster.</h1>
          <p className="mx-auto mt-3 max-w-md text-balance text-muted">
            Ask in plain language. Suggestions appear as you type, and answers come straight from the catalog.
          </p>
        </div>

        <SearchBox onSubmit={ask} autoFocus />

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => ask(ex)}
              className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-muted transition hover:border-accent hover:text-fg"
            >
              {ex}
            </button>
          ))}
        </div>

        <ul className="mt-14 grid gap-3 text-sm sm:grid-cols-3">
          <Feature icon={<BoltIcon className="size-4" />} title="Instant suggestions" text="Llama on Groq, debounced and cached" />
          <Feature icon={<DbIcon className="size-4" />} title="Grounded answers" text="Gemini RAG over pgvector embeddings" />
          <Feature icon={<WrenchIcon className="size-4" />} title="Tool calling" text="Zod-validated filters and product cards" />
        </ul>
      </main>
    );
  }

  const last = messages.at(-1);
  const waitingForFirstToken = status === "submitted" && last?.role === "user";

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          <button onClick={() => setMessages([])} aria-label="New search" className="shrink-0">
            <Logo small />
          </button>
          <SearchBox onSubmit={ask} onStop={stop} busy={busy} size="md" placeholder="Ask a follow-up…" />
          <button
            onClick={() => {
              void stop();
              setMessages([]);
            }}
            className="hidden shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm text-muted transition hover:text-fg sm:flex"
          >
            <PlusIcon className="size-4" /> New
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        {messages.map((m) => (
          <MessageView key={m.id} message={m} />
        ))}

        {waitingForFirstToken && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <SparkIcon className="size-4 animate-spin text-accent [animation-duration:2.5s]" />
            Looking through the catalog…
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm">
            <span className="text-danger">{readableError(error)}</span>
            <button onClick={() => void regenerate()} className="shrink-0 font-medium underline underline-offset-4">
              Retry
            </button>
          </div>
        )}

        <div ref={bottomRef} className="h-4" />
      </main>
    </>
  );
}

function readableError(error: Error) {
  try {
    const body = JSON.parse(error.message) as { error?: string };
    return body.error || error.message;
  } catch {
    return error.message || "Something went wrong.";
  }
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-2 grid size-8 place-items-center rounded-lg bg-accent-soft text-accent">{icon}</div>
      <div className="font-medium">{title}</div>
      <div className="text-muted">{text}</div>
    </li>
  );
}

function Logo({ small, className = "" }: { small?: boolean; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className} ${small ? "" : "w-fit"}`}>
      <span className={`grid place-items-center rounded-xl bg-accent text-accent-fg ${small ? "size-8" : "size-11"}`}>
        <SparkIcon className={small ? "size-4" : "size-5"} />
      </span>
      {!small && <span className="text-lg font-semibold tracking-tight">Shelfwise</span>}
    </div>
  );
}
