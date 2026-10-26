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

// Vector lens mark, same geometry as the app logo (viewBox 64): outlined circles at x=24 and x=40,
// r=17, stroke 3.5, and the shared lens filled amber. The lens is sampled as a polygon so it prints
// exactly. Position (x, y) is the mark's bottom-left corner, `size` is its width and height.
function lensMark(x: number, y: number, size: number): string[] {
  const k = size / 64;
  const cx1 = x + 24 * k;
  const cx2 = x + 40 * k;
  const cy = y + (64 - 32) * k;
  const r = 17 * k;
  const w = 3.5 * k;
  const d = cx2 - cx1;
  const theta0 = Math.acos(d / 2 / r); // angle where the two circles cross, measured from each centre
  const pts = (ccx: number, from: number, to: number, steps = 40) => {
    const out: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = from + ((to - from) * i) / steps;
      out.push(`${(ccx + r * Math.cos(t)).toFixed(3)} ${(cy + r * Math.sin(t)).toFixed(3)}`);
    }
    return out;
  };
  // Lens: right arc of the left circle (bottom to top), then left arc of the right circle (top to bottom).
  const lens = [...pts(cx1, -theta0, theta0), ...pts(cx2, Math.PI - theta0, Math.PI + theta0).reverse()];
  const ops = [`${INK} rg ${lens[0]} m ${lens.slice(1).map((p) => `${p} l`).join(" ")} h f`];
  const circle = (ccx: number) => {
    const ring = pts(ccx, 0, 2 * Math.PI, 72);
    return `${ring[0]} m ${ring.slice(1).map((p) => `${p} l`).join(" ")} h S`;
  };
  ops.push(`${INK} RG ${w.toFixed(3)} w ${circle(cx1)}`);
  ops.push(`${INK} RG ${w.toFixed(3)} w ${circle(cx2)}`);
  return ops;
}

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
      `BT /${font} ${size} Tf ${colour} rg ${tracking} Tc 1 0 0 1 ${x} ${y} Tm ${pdfText(value)} Tj 0 Tc ET`,
    );
  };
  // Shrink a headline so a long name stays on the line.
  const fitSize = (value: string, max: number, min: number, ratio: number) => {
    const size = Math.floor(max / Math.max(1, value.length * ratio));
    return Math.max(min, Math.min(max, size));
  };
  const clip = (value: string, max: number) => {
    const chars = Array.from(value);
    return chars.length > max ? `${chars.slice(0, max - 3).join("").trimEnd()}...` : value;
  };

  // Header band: amber, with the wordmark in the serif face.
  rect(0, PAGE_H - 104, PAGE_W, 104, AMBER);
  // Kinship lens mark (same geometry as the app logo): two outlined circles, shared lens filled.
  // Drawn as vector strokes so it prints crisp and needs no image asset. Sits left of the wordmark.
  const markSize = 40;
  const markX = MARGIN;
  const markY = PAGE_H - 64 - 10;
  ops.push(...lensMark(markX, markY, markSize));
  text(MARGIN + markSize + 12, PAGE_H - 64, 34, F_SERIF_BOLD, "Kinship", INK);
  text(RIGHT - 160, PAGE_H - 58, 8, F_SANS_BOLD, "PAIRING REPORT", INK, 1.5);

  // Subtitle under the band.
  text(MARGIN, PAGE_H - 134, 12, F_SANS, "A pairing from shared fans on Qloo", MUTED);

  // The two entities, each with its type.
  text(MARGIN, 608, 8, F_SANS_BOLD, "FIRST", MUTED, 1.5);
  text(MARGIN, 578, fitSize(input.leftName, 30, 16, 0.5), F_SERIF, clip(input.leftName, 60), INK);
  text(MARGIN, 556, 10, F_SANS, input.leftType, MUTED);

  text(MARGIN, 516, 8, F_SANS_BOLD, "SECOND", MUTED, 1.5);
  text(MARGIN, 486, fitSize(input.rightName, 30, 16, 0.5), F_SERIF, clip(input.rightName, 60), INK);
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
  const explanationLines = wrap(input.explanation, 92);
  for (const line of explanationLines) {
    if (y < 124) {
      // Never let the explanation run into the footer: mark the cut instead of overprinting.
      text(MARGIN, y, 11, F_SANS, "...", MUTED);
      break;
    }
    text(MARGIN, y, 11, F_SANS, line, INK);
    y -= 15;
  }

  // Footer.
  hairline(MARGIN, RIGHT, 98, RULE, 0.6);
  const generated = new Date().toISOString().slice(0, 10);
  // Source line and disclaimer each get their own row so the disclaimer stays whole and inside the margins.
  text(MARGIN, 82, 8, F_SANS, "Scores come from Qloo's taste graph.", MUTED);
  text(MARGIN, 71, 8, F_SANS, PAIRING_DISCLAIMER, MUTED);
  text(MARGIN, 52, 8, F_SANS, `Generated ${generated} with Kinship`, MUTED);

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

// The base-14 fonts use WinAnsiEncoding. Each character is mapped to its WinAnsi byte and written
// as a hex string, so accents (é, ñ, ü) and typographic dashes come out as real glyphs, never "?".
// Characters with no WinAnsi code are first decomposed (é -> e + combining mark) and their marks dropped;
// anything still unmapped becomes "?".
const WIN_ANSI_EXTRA: Record<string, number> = {
  "\u20AC": 0x80, "\u201A": 0x82, "\u0192": 0x83, "\u201E": 0x84, "\u2026": 0x85, "\u2020": 0x86,
  "\u2021": 0x87, "\u02C6": 0x88, "\u2030": 0x89, "\u0160": 0x8a, "\u2039": 0x8b, "\u0152": 0x8c,
  "\u017D": 0x8e, "\u2018": 0x91, "\u2019": 0x92, "\u201C": 0x93, "\u201D": 0x94, "\u2022": 0x95,
  "\u02DC": 0x98, "\u2122": 0x99, "\u0161": 0x9a, "\u203A": 0x9b,
  "\u0153": 0x9c, "\u017E": 0x9e, "\u0178": 0x9f,
  // Typographic dashes and minus sign read as a plain ASCII hyphen.
  "\u2010": 0x2d, "\u2011": 0x2d, "\u2012": 0x2d, "\u2013": 0x2d, "\u2014": 0x2d, "\u2015": 0x2d, "\u2212": 0x2d,
};

function winAnsiByte(char: string): number | null {
  const code = char.codePointAt(0) ?? 0;
  if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) return code;
  return WIN_ANSI_EXTRA[char] ?? null;
}

function pdfText(value: string): string {
  const bytes: number[] = [];
  for (const char of value.normalize("NFC")) {
    let byte = winAnsiByte(char);
    if (byte === null) {
      // No WinAnsi code: keep the base letter when the character is a letter with a mark.
      const base = char.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (base !== char) {
        for (const inner of base) bytes.push(winAnsiByte(inner) ?? 0x3f);
        continue;
      }
      byte = 0x3f;
    }
    bytes.push(byte);
  }
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `<${hex}>`;
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
