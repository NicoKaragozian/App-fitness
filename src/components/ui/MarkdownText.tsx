import React from 'react';

export function MarkdownText({ text }: { text: string }) {
  // Normalize line endings
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  const renderInline = (str: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    // Handle bold (**...**), italic (*...*), and inline code (`...`)
    const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let idx = 0;
    while ((m = regex.exec(str)) !== null) {
      if (m.index > last) parts.push(str.slice(last, m.index));
      if (m[2]) parts.push(<strong key={idx++} className="text-on-surface font-semibold"><em>{m[2]}</em></strong>);
      else if (m[3]) parts.push(<strong key={idx++} className="text-on-surface font-semibold">{m[3]}</strong>);
      else if (m[4]) parts.push(<em key={idx++}>{m[4]}</em>);
      else if (m[5]) parts.push(<code key={idx++} className="bg-surface-container px-1 rounded text-xs font-mono text-primary">{m[5]}</code>);
      last = m.index + m[0].length;
    }
    if (last < str.length) parts.push(str.slice(last));
    return parts;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    if (line.startsWith('#### ')) {
      elements.push(<p key={i} className="font-label text-[0.65rem] text-on-surface-variant tracking-widest uppercase mt-2 mb-0.5">{line.slice(5)}</p>);
    } else if (line.startsWith('### ')) {
      elements.push(<p key={i} className="font-label text-label-sm text-on-surface-variant tracking-widest uppercase mt-3 mb-1">{line.slice(4)}</p>);
    } else if (line.startsWith('## ')) {
      elements.push(<p key={i} className="font-label text-label-sm text-primary tracking-widest uppercase mt-3 mb-1">{line.slice(3)}</p>);
    } else if (line.startsWith('# ')) {
      elements.push(<p key={i} className="font-label text-label-sm text-primary tracking-widest uppercase mt-3 mb-1">{line.slice(2)}</p>);

    // Unordered list
    } else if (line.match(/^[-*•] /)) {
      elements.push(
        <div key={i} className="flex gap-2 my-0.5 pl-1">
          <span className="text-primary mt-0.5 shrink-0 leading-relaxed">·</span>
          <span className="leading-relaxed">{renderInline(line.slice(2))}</span>
        </div>
      );

    // Ordered list (1. 2. 3. etc.)
    } else if (line.match(/^\d+\. /)) {
      const numMatch = line.match(/^(\d+)\. (.*)/);
      if (numMatch) {
        elements.push(
          <div key={i} className="flex gap-2 my-0.5 pl-1">
            <span className="text-primary/70 shrink-0 text-xs leading-relaxed mt-0.5 tabular-nums">{numMatch[1]}.</span>
            <span className="leading-relaxed">{renderInline(numMatch[2])}</span>
          </div>
        );
      }

    // Horizontal rule
    } else if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      elements.push(<hr key={i} className="border-outline-variant/30 my-2" />);

    // Empty line → spacing
    } else if (line.trim() === '') {
      // Only add spacing if previous element wasn't also a spacer
      if (elements.length > 0) {
        elements.push(<div key={i} className="h-2" />);
      }

    // Normal paragraph
    } else {
      elements.push(
        <p key={i} className="my-0.5 leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }
    i++;
  }

  return <>{elements}</>;
}
