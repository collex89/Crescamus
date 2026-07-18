// Generates a branded, shareable Daily Verse image entirely in the browser
// (no server, no libraries) and triggers a download. 1080x1350 — the
// portrait ratio Instagram/WhatsApp favor.

const W = 1080;
const H = 1350;

const NAVY_DARK = '#152b66';
const NAVY = '#1E3A8A';
const GOLD = '#D4AF37';
const CREAM = '#FAFAF8';

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (ctx.measureText(attempt).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = attempt;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCross(ctx, cx, cy, size) {
  const bar = size * 0.24;
  ctx.fillStyle = GOLD;
  const r = size * 0.05;
  // vertical bar (full height)
  roundRect(ctx, cx - bar / 2, cy - size / 2, bar, size, r);
  // horizontal bar, one third down — classic latin cross proportions
  roundRect(ctx, cx - size * 0.33, cy - size * 0.22, size * 0.66, bar, r);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

export function downloadVerseImage({ text, reference }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background: deep royal blue gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, NAVY);
  bg.addColorStop(1, NAVY_DARK);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft radial glow behind the verse
  const glow = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 700);
  glow.addColorStop(0, 'rgba(212, 175, 55, 0.10)');
  glow.addColorStop(1, 'rgba(212, 175, 55, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Thin gold frame
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, W - 96, H - 96);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(62, 62, W - 124, H - 124);

  // Cross mark at top
  drawCross(ctx, W / 2, 218, 96);

  // "DAILY VERSE" label
  ctx.fillStyle = GOLD;
  ctx.font = '600 34px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '10px';
  ctx.fillText('D A I L Y   V E R S E', W / 2, 340);

  // Verse text — font scales down for long verses
  const maxTextWidth = W - 240;
  let fontSize = text.length > 220 ? 46 : text.length > 130 ? 54 : 62;
  ctx.font = `italic ${fontSize}px Georgia, serif`;
  let lines = wrapText(ctx, `“${text}”`, maxTextWidth);
  // If it still overflows the middle area, shrink once more
  if (lines.length * fontSize * 1.5 > 560) {
    fontSize = Math.max(38, fontSize - 10);
    ctx.font = `italic ${fontSize}px Georgia, serif`;
    lines = wrapText(ctx, `“${text}”`, maxTextWidth);
  }
  const lineHeight = fontSize * 1.5;
  const blockHeight = lines.length * lineHeight;
  let y = (H - blockHeight) / 2 + fontSize * 0.35 + 40;
  ctx.fillStyle = CREAM;
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += lineHeight;
  }

  // Divider
  y += 12;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 70, y);
  ctx.lineTo(W / 2 + 70, y);
  ctx.stroke();

  // Reference
  y += 68;
  ctx.fillStyle = GOLD;
  ctx.font = '600 42px Georgia, serif';
  ctx.fillText(reference, W / 2, y);

  // Bottom branding
  ctx.fillStyle = CREAM;
  ctx.font = '600 52px Georgia, serif';
  ctx.letterSpacing = '14px';
  ctx.fillText('C R E S C A M U S', W / 2, H - 170);
  ctx.letterSpacing = '4px';
  ctx.fillStyle = 'rgba(250, 250, 248, 0.75)';
  ctx.font = '30px Georgia, serif';
  ctx.fillText('Growing Together in Christ', W / 2, H - 116);

  // Download
  const safeRef = reference.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crescamus-daily-verse-${safeRef}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
}
