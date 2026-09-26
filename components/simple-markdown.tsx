import type { ReactNode } from "react";

/**
 * A deliberately small Markdown renderer for text the team writes in the CRM
 * (the partner playbook): paragraphs, - and 1. lists, | tables |, **bold**
 * and *italic*. It builds React elements - never raw HTML - so nothing typed
 * into the playbook can inject markup.
 */
export function SimpleMarkdown({ text }: { text: string }) {
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-700">
      {blocks.map((block, i) => (
        <Block key={i} text={block.trim()} />
      ))}
    </div>
  );
}

function Block({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
    return (
      <ul className="list-disc space-y-1 pl-5">
        {lines.map((l, i) => (
          <li key={i}>{inline(l.replace(/^\s*[-*]\s+/, ""))}</li>
        ))}
      </ul>
    );
  }
  if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
    return (
      <ol className="list-decimal space-y-1 pl-5">
        {lines.map((l, i) => (
          <li key={i}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>
        ))}
      </ol>
    );
  }
  if (lines.length >= 2 && lines.every((l) => l.trim().startsWith("|"))) {
    const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    const rows = lines.filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l)).map(cells);
    const [head, ...body] = rows;
    return (
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              {head.map((c, i) => (
                <th key={i} className="py-1.5 pr-6 font-medium">
                  {inline(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {body.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className="py-1.5 pr-6">
                    {inline(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (/^#{1,4}\s/.test(lines[0])) {
    return (
      <>
        <h4 className="font-semibold text-slate-900">{inline(lines[0].replace(/^#+\s*/, ""))}</h4>
        {lines.length > 1 ? <Block text={lines.slice(1).join("\n")} /> : null}
      </>
    );
  }
  return (
    <p>
      {lines.map((l, i) => (
        <span key={i}>
          {i > 0 ? <br /> : null}
          {inline(l)}
        </span>
      ))}
    </p>
  );
}

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push(m[1] != null ? <strong key={k++} className="font-semibold text-slate-900">{m[1]}</strong> : <em key={k++}>{m[2]}</em>);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
