import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
export const maxDuration = 30;
// VWorld 는 국내 요청만 허용 -> 서울 리전에서 실행
export const preferredRegion = "icn1";

const TILE = 256;
const GRID = 3; // 3x3 타일

// 위경도 -> 타일 좌표 (소수 포함)
function lonLatToTile(lon: number, lat: number, z: number) {
  const n = Math.pow(2, z);
  const x = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

async function fetchTile(key: string, z: number, x: number, y: number): Promise<Buffer | null> {
  const urls = [
    `https://api.vworld.kr/req/wmts/1.0.0/${key}/Base/${z}/${y}/${x}.png`,
    `http://api.vworld.kr/req/wmts/1.0.0/${key}/Base/${z}/${y}/${x}.png`,
    `https://xdworld.vworld.kr/2d/Base/service/${z}/${x}/${y}.png`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          Referer: "https://krc-q.vercel.app/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "image/png,image/*,*/*",
        },
      });
      if (!res.ok) {
        console.error(`[staticmap] ${url} status ${res.status}`);
        continue;
      }
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("image")) {
        const txt = await res.text();
        console.error(`[staticmap] ${url} not image: ${ct} body=${txt.slice(0, 150)}`);
        continue;
      }
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    } catch (e) {
      console.error(`[staticmap] ${url} fetch error:`, e instanceof Error ? e.message : e);
      continue;
    }
  }
  return null;
}

export async function GET(req: Request) {
  const key = process.env.VWORLD_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "VWORLD_API_KEY 없음" }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") || "");
  const lng = parseFloat(searchParams.get("lng") || "");
  const z = parseInt(searchParams.get("z") || "16", 10);
  if (!isFinite(lat) || !isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng 필요" }, { status: 400 });
  }

  const center = lonLatToTile(lng, lat, z);
  const centerTileX = Math.floor(center.x);
  const centerTileY = Math.floor(center.y);
  const half = Math.floor(GRID / 2);

  // 타일들 병렬 로드
  const jobs: Promise<{ dx: number; dy: number; buf: Buffer | null }>[] = [];
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const tx = centerTileX + dx;
      const ty = centerTileY + dy;
      jobs.push(fetchTile(key, z, tx, ty).then((buf) => ({ dx, dy, buf })));
    }
  }
  const tiles = await Promise.all(jobs);

  const okCount = tiles.filter((t) => t.buf).length;
  if (okCount === 0) {
    return NextResponse.json({ error: "타일 로드 실패 (도메인/키 확인)", z, lat, lng }, { status: 502 });
  }

  const W = TILE * GRID;
  const Hh = TILE * GRID;
  const composites: { input: Buffer; left: number; top: number }[] = [];
  for (const t of tiles) {
    if (!t.buf) continue;
    composites.push({
      input: t.buf,
      left: (t.dx + half) * TILE,
      top: (t.dy + half) * TILE,
    });
  }

  // 중앙 마커 (SVG 핀)
  const markerPx = Math.round((center.x - centerTileX + half) * TILE);
  const markerPy = Math.round((center.y - centerTileY + half) * TILE);
  const pin = Buffer.from(
    `<svg width="${W}" height="${Hh}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${markerPx}" cy="${markerPy}" r="9" fill="#FE5000" stroke="#fff" stroke-width="3"/>
      <line x1="${markerPx}" y1="${markerPy}" x2="${markerPx}" y2="${markerPy - 22}" stroke="#FE5000" stroke-width="4"/>
      <circle cx="${markerPx}" cy="${markerPy - 24}" r="7" fill="#FE5000" stroke="#fff" stroke-width="2"/>
    </svg>`
  );
  composites.push({ input: pin, left: 0, top: 0 });

  try {
    const out = await sharp({
      create: { width: W, height: Hh, channels: 4, background: { r: 230, g: 230, b: 230, alpha: 1 } },
    })
      .composite(composites)
      .png()
      .toBuffer();
    return new NextResponse(new Uint8Array(out), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    console.error("[staticmap] composite error", e);
    return NextResponse.json({ error: "합성 실패" }, { status: 500 });
  }
}
