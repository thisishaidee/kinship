export const PAIRING_DISCLAIMER = "Scores show taste-graph affinity, not partnership availability.";

export type PairingPdfInput = {
  leftName: string;
  leftType: string;
  rightName: string;
  rightType: string;
  overlaps: { name: string; category: string; leftScore: string; rightScore: string }[];
  explanation: string;
};

export function buildPairingPdf(input: PairingPdfInput): Uint8Array {
  const lines: { text: string; size: number; gap: number }[] = [
    { text: "Kinship", size: 22, gap: 8 },
    { text: "A pairing from Qloo audience affinity", size: 12, gap: 18 },
    { text: input.leftName, size: 16, gap: 4 },
    { text: input.leftType, size: 11, gap: 12 },
    { text: input.rightName, size: 16, gap: 4 },
    { text: input.rightType, size: 11, gap: 18 },
    { text: "Shared affinities", size: 13, gap: 8 },
  ];
  if (input.overlaps.length === 0) {
    lines.push({ text: "No shared entity in these Qloo results.", size: 11, gap: 14 });
  } else {
    for (const overlap of input.overlaps) {
      lines.push({
        text: `${overlap.name} (${overlap.category}) ${overlap.leftScore} / ${overlap.rightScore}`,
        size: 11,
        gap: 6,
      });
    }
    lines.push({ text: "", size: 11, gap: 8 });
  }
  lines.push({ text: "Why this pairing", size: 13, gap: 8 });
  for (const sentence of wrap(input.explanation, 88)) lines.push({ text: sentence, size: 11, gap: 5 });
  lines.push({ text: "", size: 11, gap: 12 });
  for (const sentence of wrap(PAIRING_DISCLAIMER, 88)) lines.push({ text: sentence, size: 11, gap: 5 });

  const commands = ["BT"];
  let y = 740;
  for (const line of lines) {
    if (y < 56) break;
    if (line.text) {
      commands.push(`/F1 ${line.size} Tf`);
      commands.push(`1 0 0 1 48 ${y} Tm`);
      commands.push(`(${pdfText(line.text)}) Tj`);
    }
    y -= line.size + line.gap;
  }
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function pdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrap(value: string, width: number): string[] {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}
