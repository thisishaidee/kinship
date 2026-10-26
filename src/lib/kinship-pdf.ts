export const PAIRING_DISCLAIMER = "Shared-fans scores show a connection in Qloo's data, not partnership availability.";
export const PDF_FILENAME = "kinship-pairing.pdf";

export type PairingPdfInput = {
  leftName: string;
  leftType: string;
  rightName: string;
  rightType: string;
  overlaps: { name: string; category: string; leftScore: string; rightScore: string }[];
  explanation: string;
  // Single-pitch PDFs have no overlap table; this line replaces the empty-state text.
  score?: string;
};

export function isIos(userAgent: string, touchPoints: number): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent) || (/Mac/i.test(userAgent) && touchPoints > 1);
}

export function preparePdfAnchor(anchor: { download: string; target: string }, userAgent: string, touchPoints: number): void {
  anchor.download = PDF_FILENAME;
  anchor.target = isIos(userAgent, touchPoints) ? "_blank" : "";
}

export function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
}

// Kinship amber (#ffb548) as a PDF fill colour, plus neutrals. Page is white for printing.
const AMBER = "1 0.7098 0.2824";
const INK = "0.04 0.04 0.04";
const MUTED = "0.42 0.42 0.42";
const RULE = "0.82 0.82 0.82";

// Built-in PDF base-14 fonts only: no external font files.
const F_SERIF_BOLD = "F1";
const F_SERIF = "F2";
const F_SANS = "F3";
const F_SANS_BOLD = "F4";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 56;
const RIGHT = PAGE_W - MARGIN;

export function buildPairingPdf(input: PairingPdfInput): Uint8Array {
  const ops: string[] = [];

  const rect = (x: number, y: number, w: number, h: number, colour: string) => {
    ops.push(`${colour} rg ${x} ${y} ${w} ${h} re f`);
  };
  const hairline = (x1: number, x2: number, y: number, colour = RULE, weight = 0.6) => {
    rect(x1, y, x2 - x1, weight, colour);
  };
  const text = (x: number, y: number, size: number, font: string, value: string, colour = INK, tracking = 0) => {
    ops.push(
      `BT /${font} ${size} Tf ${colour} rg ${tracking} Tc 1 0 0 1 ${x} ${y} Tm (${pdfText(value)}) Tj 0 Tc ET`,
    );
  };
  // Shrink a headline so a long name stays on the line.
  const fitSize = (value: string, max: number, min: number, ratio: number) => {
    const size = Math.floor(max / Math.max(1, value.length * ratio));
    return Math.max(min, Math.min(max, size));
  };
  const clip = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 3).trimEnd()}...` : value);

  // Header band: amber, with the wordmark in the serif face.
  rect(0, PAGE_H - 104, PAGE_W, 104, AMBER);
  text(MARGIN, PAGE_H - 64, 34, F_SERIF_BOLD, "Kinship", INK);
  text(RIGHT - 160, PAGE_H - 58, 8, F_SANS_BOLD, "PAIRING REPORT", INK, 1.5);

  // Subtitle under the band.
  text(MARGIN, PAGE_H - 134, 12, F_SANS, "A pairing from shared fans on Qloo", MUTED);

  // The two entities, each with its type.
  text(MARGIN, 608, 8, F_SANS_BOLD, "FIRST", MUTED, 1.5);
  text(MARGIN, 578, fitSize(input.leftName, 30, 16, 0.5), F_SERIF, input.leftName, INK);
  text(MARGIN, 556, 10, F_SANS, input.leftType, MUTED);

  text(MARGIN, 516, 8, F_SANS_BOLD, "SECOND", MUTED, 1.5);
  text(MARGIN, 486, fitSize(input.rightName, 30, 16, 0.5), F_SERIF, input.rightName, INK);
  text(MARGIN, 464, 10, F_SANS, input.rightType, MUTED);

  // Accent rule.
  rect(MARGIN, 440, RIGHT - MARGIN, 2, AMBER);

  // Overlap table.
  const colName = MARGIN;
  const colCategory = 290;
  const colLeft = 428;
  const colRight = 500;
  // Single-pitch PDFs (score set, no overlaps) skip the table header and show the score instead.
  const singlePitch = input.overlaps.length === 0 && Boolean(input.score);
  let y = 392;
  if (!singlePitch) {
    text(colName, 420, 8, F_SANS_BOLD, "SHARED FAN INTEREST", MUTED, 1);
    text(colCategory, 420, 8, F_SANS_BOLD, "CATEGORY", MUTED, 1);
    text(colLeft, 420, 8, F_SANS_BOLD, "FIRST", MUTED, 1);
    text(colRight, 420, 8, F_SANS_BOLD, "SECOND", MUTED, 1);
    hairline(MARGIN, RIGHT, 412, INK, 0.6);
  }
  if (singlePitch) {
    text(colName, 420, 11, F_SANS_BOLD, `Shared-fans score: ${input.score}`, INK);
    y = 392;
  } else if (input.overlaps.length === 0) {
    text(colName, y, 11, F_SANS, "No shared entity in these Qloo results.", MUTED);
    y -= 26;
  } else {
    const maxRows = 5;
    const shown = input.overlaps.slice(0, maxRows);
    for (const overlap of shown) {
      text(colName, y, 11, F_SANS_BOLD, clip(overlap.name, 40), INK);
      text(colCategory, y, 10, F_SANS, clip(overlap.category, 24), MUTED);
      text(colLeft, y, 11, F_SANS, clip(overlap.leftScore, 10), INK);
      text(colRight, y, 11, F_SANS, clip(overlap.rightScore, 10), INK);
      hairline(MARGIN, RIGHT, y - 9, RULE, 0.6);
      y -= 26;
    }
    if (input.overlaps.length > maxRows) {
      text(colName, y + 2, 9, F_SANS, `+${input.overlaps.length - maxRows} more in the app`, MUTED);
      y -= 20;
    }
  }

  // Explanation.
  y -= 14;
  text(MARGIN, y, 8, F_SANS_BOLD, "WHY THIS PAIRING", MUTED, 1.5);
  y -= 18;
  for (const line of wrap(input.explanation, 92)) {
    if (y < 124) break;
    text(MARGIN, y, 11, F_SANS, line, INK);
    y -= 15;
  }

  // Footer.
  hairline(MARGIN, RIGHT, 98, RULE, 0.6);
  const generated = new Date().toISOString().slice(0, 10);
  for (const [index, line] of wrap(`Scores come from Qloo's taste graph. ${PAIRING_DISCLAIMER}`, 150).entries()) {
    text(MARGIN, 82 - index * 11, 8, F_SANS, line, MUTED);
  }
  text(MARGIN, 60, 8, F_SANS, `Generated ${generated} with Kinship`, MUTED);

  const stream = ["q", ...ops, "Q"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents 9 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R /F4 7 0 R >> >> >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Title (Kinship pairing) /Creator (Kinship) >>",
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
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R /Info 8 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function pdfText(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
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
