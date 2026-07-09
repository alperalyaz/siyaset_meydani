// Oturumdan paylaşılabilir GÖRSEL kart üretir (client-side Canvas; ekstra
// servis/CSP izni gerektirmez, çevrimdışı da çalışır). İki mod:
//   - "moment": tek bir çarpıcı replik (konuk + söz + reyting)
//   - "karne":  oturum özeti (ortalama reyting, zirve/dip, rozet, en çarpıcı an)
// Çıktı 1080×1350 (Instagram/Story dostu) PNG blob'u.

export const APP_NAME = "Siyaset Meydanı";
export const APP_URL = "siyaset-meydani.vercel.app";

export interface MomentCardData {
  kind: "moment";
  topic: string;
  guestName: string;
  guestColor: string;
  quote: string;
  rating: number;
}

export interface KarneCardData {
  kind: "karne";
  topic: string;
  guests: string;
  averageRating: number;
  peak: number;
  trough: number;
  badges: number;
  totalBadges: number;
  moment?: string;
  won?: boolean;
}

export type ShareCardData = MomentCardData | KarneCardData;

const W = 1080;
const H = 1350;
const PAD = 84;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Metni maxWidth'e sığdıracak şekilde satırlara böler.
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines?: number,
): number {
  let lines = wrapLines(ctx, text, maxWidth);
  if (maxLines && lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 1) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = `${last}…`;
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

function ratingColor(r: number): string {
  return r >= 75 ? "#4caf7d" : r >= 50 ? "#f2b134" : "#e94b6b";
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#141a30");
  g.addColorStop(0.5, "#0e1222");
  g.addColorStop(1, "#0b0e1a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Üstten hafif accent parıltı.
  const glow = ctx.createRadialGradient(W / 2, -120, 40, W / 2, -120, 720);
  glow.addColorStop(0, "rgba(242,177,52,0.18)");
  glow.addColorStop(1, "rgba(242,177,52,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 520);

  // İnce çerçeve.
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 2;
  roundRect(ctx, 20, 20, W - 40, H - 40, 40);
  ctx.stroke();
}

function drawHeader(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = "left";
  ctx.font = "800 30px system-ui, 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = "#f2b134";
  ctx.fillText("●", PAD, 108);
  ctx.fillStyle = "#eef1fa";
  ctx.fillText(`  ${APP_NAME.toUpperCase()}`, PAD + 6, 108);
  ctx.font = "700 24px system-ui, 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = "#9aa4c4";
  ctx.fillText("YAPAY ZEKÂ AÇIK OTURUMU", PAD, 150);
}

function drawFooter(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = "center";
  ctx.font = "800 34px system-ui, 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = "#f2b134";
  ctx.fillText("Sen de tarihi tartıştır 🎭", W / 2, H - 118);
  ctx.font = "600 30px system-ui, 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = "#9aa4c4";
  ctx.fillText(APP_URL, W / 2, H - 70);
}

function drawMoment(ctx: CanvasRenderingContext2D, d: MomentCardData) {
  // Konu (üstte, küçük).
  ctx.textAlign = "center";
  ctx.font = "600 34px system-ui, 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = "#9aa4c4";
  drawWrapped(ctx, d.topic, W / 2, 288, W - PAD * 2, 46, 2);

  // Dev tırnak.
  ctx.textAlign = "left";
  ctx.font = "800 200px Georgia, serif";
  ctx.fillStyle = "rgba(242,177,52,0.22)";
  ctx.fillText("“", PAD, 500);

  // Söz (merkez, büyük).
  ctx.textAlign = "center";
  ctx.font = "700 58px system-ui, 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = "#eef1fa";
  const endY = drawWrapped(ctx, d.quote, W / 2, 560, W - PAD * 2, 76, 7);

  // Konuk adı (renkli).
  ctx.font = "800 44px system-ui, 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = d.guestColor || "#f2b134";
  ctx.fillText(`— ${d.guestName}`, W / 2, Math.min(endY + 80, H - 380));

  // Reyting rozeti.
  drawRatingBadge(ctx, d.rating, W / 2, H - 232);
}

function drawRatingBadge(ctx: CanvasRenderingContext2D, rating: number, cx: number, cy: number) {
  const col = ratingColor(rating);
  ctx.textAlign = "center";
  ctx.font = "800 26px system-ui, 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = "#9aa4c4";
  ctx.fillText("REYTİNGMETRE", cx, cy - 44);
  ctx.font = "900 84px system-ui, 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = col;
  ctx.fillText(String(rating), cx, cy + 40);
  // Alt bar.
  const barW = 360;
  const barX = cx - barW / 2;
  const barY = cy + 66;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(ctx, barX, barY, barW, 16, 8);
  ctx.fill();
  ctx.fillStyle = col;
  roundRect(ctx, barX, barY, (barW * Math.max(0, Math.min(100, rating))) / 100, 16, 8);
  ctx.fill();
}

function drawKarne(ctx: CanvasRenderingContext2D, d: KarneCardData) {
  ctx.textAlign = "center";
  ctx.font = "900 46px system-ui, 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = d.won ? "#4caf7d" : "#eef1fa";
  ctx.fillText(d.won ? "🏆 OTURUM BAŞARILI" : "📺 OTURUM KARNESİ", W / 2, 250);

  // Konu.
  ctx.font = "700 42px system-ui, 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = "#eef1fa";
  const afterTopic = drawWrapped(ctx, `"${d.topic}"`, W / 2, 330, W - PAD * 2, 56, 3);

  // Konuklar.
  ctx.font = "600 30px system-ui, 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = "#9aa4c4";
  const afterGuests = drawWrapped(ctx, d.guests, W / 2, afterTopic + 24, W - PAD * 2, 42, 2);

  // Dev ortalama reyting.
  const cy = afterGuests + 130;
  ctx.font = "900 190px system-ui, 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = ratingColor(d.averageRating);
  ctx.fillText(String(d.averageRating), W / 2, cy);
  ctx.font = "700 30px system-ui, 'Segoe UI', Arial, sans-serif";
  ctx.fillStyle = "#9aa4c4";
  ctx.fillText("ORTALAMA REYTİNG", W / 2, cy + 46);

  // Üçlü mini istatistik.
  const statY = cy + 150;
  const cols = [
    { label: "ZİRVE", value: String(d.peak), color: "#4caf7d" },
    { label: "DİP", value: String(d.trough), color: "#e94b6b" },
    { label: "ROZET", value: `${d.badges}/${d.totalBadges}`, color: "#f2b134" },
  ];
  const cw = (W - PAD * 2) / 3;
  cols.forEach((c, i) => {
    const x = PAD + cw * i + cw / 2;
    ctx.font = "900 56px system-ui, 'Segoe UI', Arial, sans-serif";
    ctx.fillStyle = c.color;
    ctx.fillText(c.value, x, statY);
    ctx.font = "700 26px system-ui, 'Segoe UI', Arial, sans-serif";
    ctx.fillStyle = "#9aa4c4";
    ctx.fillText(c.label, x, statY + 40);
  });

  // En çarpıcı an kutusu.
  if (d.moment) {
    const boxY = statY + 92;
    const boxH = H - 118 - 40 - boxY;
    if (boxH > 120) {
      ctx.fillStyle = "rgba(233,75,107,0.10)";
      roundRect(ctx, PAD, boxY, W - PAD * 2, boxH, 28);
      ctx.fill();
      ctx.strokeStyle = "rgba(233,75,107,0.4)";
      ctx.lineWidth = 2;
      roundRect(ctx, PAD, boxY, W - PAD * 2, boxH, 28);
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.font = "800 26px system-ui, 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "#e94b6b";
      ctx.fillText("🔥 EN ÇARPICI AN", PAD + 40, boxY + 56);
      ctx.font = "italic 600 34px Georgia, serif";
      ctx.fillStyle = "#eef1fa";
      const maxLines = Math.max(1, Math.floor((boxH - 90) / 46));
      drawWrapped(ctx, `"${d.moment}…"`, PAD + 40, boxY + 108, W - PAD * 2 - 80, 46, maxLines);
      ctx.textAlign = "center";
    }
  }
}

export async function renderShareCard(data: ShareCardData): Promise<Blob | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    drawBackground(ctx);
    drawHeader(ctx);
    if (data.kind === "moment") drawMoment(ctx, data);
    else drawKarne(ctx, data);
    drawFooter(ctx);

    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png", 0.95));
  } catch {
    return null;
  }
}

// Görseli paylaşır (Web Share API dosya destekliyorsa), yoksa indirir.
// Dönüş: "shared" | "downloaded" | "failed".
export async function shareOrDownloadCard(
  blob: Blob,
  filename: string,
  shareText: string,
): Promise<"shared" | "downloaded" | "failed"> {
  try {
    const file = new File([blob], filename, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
    if (typeof navigator.share === "function" && nav.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: shareText });
      return "shared";
    }
  } catch {
    // Kullanıcı iptal etti ya da paylaşım başarısız — indirmeye düş.
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return "downloaded";
  } catch {
    return "failed";
  }
}
