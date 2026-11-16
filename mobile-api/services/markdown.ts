// AI output is untrusted text. Decode transport artifacts, never render HTML.
export function normalizeMarkdown(source: string): string {
  let text = source.replace(/\r\n?/g, "\n");
  for (let i = 0; i < 2; i++)
    text = text.replace(
      /&(#x[\da-f]+|#\d+|amp|nbsp|quot|apos|lt|gt);/gi,
      (all, entity: string) => {
        if (entity[0] === "#") {
          const code =
            entity[1].toLowerCase() === "x"
              ? parseInt(entity.slice(2), 16)
              : parseInt(entity.slice(1), 10);
          return code > 0 &&
            code <= 0x10ffff &&
            !(code >= 0xd800 && code <= 0xdfff)
            ? String.fromCodePoint(code)
            : all;
        }
        return (
          (
            {
              amp: "&",
              nbsp: " ",
              quot: '"',
              apos: "'",
              lt: "<",
              gt: ">",
            } as Record<string, string>
          )[entity.toLowerCase()] ?? all
        );
      },
    );
  text = text
    .replace(/\\n/g, "\n")
    .replace(/\\[ \t]*\n/g, "\n")
    .replace(/\\([*#_`])/g, "$1");
  return text
    .split("\n")
    .map((line) => {
      let clean = line.trimEnd();
      // Some providers wrap an entire already-formatted line in another bold span.
      if (/^\s*\*\*.*\*\*\s*$/.test(clean)) {
        const inside = clean.trim().slice(2, -2).trim();
        if (/^(?:\d+[.)]|[-*])\s/.test(inside) || inside.includes("**"))
          clean = inside;
      }
      return clean;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type MarkdownBlock = {
  kind: "paragraph" | "heading" | "list" | "code";
  text: string;
  marker?: string;
  level?: number;
};
export function markdownBlocks(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let code: string[] | null = null;
  for (const line of normalizeMarkdown(source).split("\n")) {
    if (/^\s*```/.test(line)) {
      if (code) {
        blocks.push({ kind: "code", text: code.join("\n") });
        code = null;
      } else code = [];
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      blocks.push({ kind: "paragraph", text: "" });
      continue;
    }
    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*$/);
    const list = line.match(/^\s*([-*+] |\d+[.)]\s+)(.+)$/);
    if (heading)
      blocks.push({
        kind: "heading",
        text: heading[2],
        level: heading[1].length,
      });
    else if (list)
      blocks.push({
        kind: "list",
        text: list[2],
        marker: /^\d/.test(list[1]) ? list[1].trim() : "•",
      });
    else blocks.push({ kind: "paragraph", text: line.trim() });
  }
  if (code) blocks.push({ kind: "code", text: code.join("\n") });
  return blocks;
}
