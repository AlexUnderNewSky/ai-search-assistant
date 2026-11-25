import { Fragment, type ReactNode } from "react";

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{inline(para.join(" "))}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={list.ordered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}>
        {list.items.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushPara();
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.replace(/^#+\s*/, ""));
    }
  }
  flushPara();
  flushList();

  return <div className="space-y-3 leading-relaxed">{blocks}</div>;
}

function inline(s: string): ReactNode {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((chunk, i) => {
    if (chunk.startsWith("**") && chunk.endsWith("**")) return <strong key={i}>{chunk.slice(2, -2)}</strong>;
    if (chunk.startsWith("`") && chunk.endsWith("`"))
      return (
        <code key={i} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.9em]">
          {chunk.slice(1, -1)}
        </code>
      );
    return <Fragment key={i}>{chunk}</Fragment>;
  });
}
