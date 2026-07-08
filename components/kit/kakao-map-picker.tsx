"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Input } from "@/components/ui/input";
import { PrimaryButton } from "@/components/kit/buttons";
// VWorld 지도 캡처 테스트

declare global {
  interface Window {
    kakao: any;
  }
}

type Value = { lat: number | null; lng: number | null; address: string };

export function KakaoMapPicker({
  value,
  onChange,
  onCapture,
}: {
  value: Value;
  onChange: (v: { lat: number; lng: number; address: string }) => void;
  onCapture?: (dataUrl: string) => void;
}) {
  const KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const markerObj = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");

  const captureVworld = useCallback(async (): Promise<string | null> => {
    const key = process.env.NEXT_PUBLIC_VWORLD_API_KEY;
    if (!key) return null;
    const v = valueRef.current;
    if (v.lat == null || v.lng == null) return null;
    try {
      const z = 16, GRID = 3, TILE = 256;
      const n = Math.pow(2, z);
      const cx = ((v.lng + 180) / 360) * n;
      const latRad = (v.lat * Math.PI) / 180;
      const cy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
      const ctX = Math.floor(cx), ctY = Math.floor(cy);
      const half = Math.floor(GRID / 2);
      const canvas = document.createElement("canvas");
      canvas.width = TILE * GRID;
      canvas.height = TILE * GRID;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      const loadTile = (dx: number, dy: number) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            ctx.drawImage(img, (dx + half) * TILE, (dy + half) * TILE, TILE, TILE);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = `https://api.vworld.kr/req/wmts/1.0.0/${key}/Base/${z}/${ctY + dy}/${ctX + dx}.png`;
        });

      const jobs: Promise<void>[] = [];
      for (let dy = -half; dy <= half; dy++)
        for (let dx = -half; dx <= half; dx++) jobs.push(loadTile(dx, dy));
      await Promise.all(jobs);

      const mx = (cx - ctX + half) * TILE;
      const my = (cy - ctY + half) * TILE;
      ctx.beginPath();
      ctx.arc(mx, my, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#FE5000";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#fff";
      ctx.stroke();

      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  }, []);


  // 좌표가 정해지면 자동 캡처하여 부모에 전달
  useEffect(() => {
    if (value.lat == null || value.lng == null) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const url = await captureVworld();
      if (!cancelled && url) {
        onCapture?.(url);
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [value.lat, value.lng, captureVworld, onCapture]);
  const valueRef = useRef(value);
  valueRef.current = value;

  // 이미 로드된 경우(뒤로가기/캐시) 대비
  useEffect(() => {
    if (typeof window !== "undefined" && window.kakao && window.kakao.maps) {
      setReady(true);
    }
  }, []);

  const placeMarker = useCallback(
    (lat: number, lng: number, addr: string) => {
      const kakao = window.kakao;
      if (!kakao || !mapObj.current) return;
      const coords = new kakao.maps.LatLng(lat, lng);
      mapObj.current.setCenter(coords);
      mapObj.current.setLevel(3);
      markerObj.current.setPosition(coords);
      markerObj.current.setMap(mapObj.current);
      onChange({ lat, lng, address: addr });
    },
    [onChange]
  );

  // 지도 초기화
  const initMap = useCallback(() => {
    const kakao = window.kakao;
    if (!kakao || !kakao.maps || !mapRef.current || mapObj.current) return;
    kakao.maps.load(() => {
      if (mapObj.current || !mapRef.current) return;
      const v = valueRef.current;
      const startLat = v.lat ?? 36.5;
      const startLng = v.lng ?? 127.8;
      const center = new kakao.maps.LatLng(startLat, startLng);
      const map = new kakao.maps.Map(mapRef.current, { center, level: v.lat ? 3 : 12 });
      mapObj.current = map;
      const marker = new kakao.maps.Marker({ position: center });
      if (v.lat) marker.setMap(map);
      markerObj.current = marker;

      // 컨테이너 크기 확정 후 재배치 (회색 방지) - 여러 번 시도
      [60, 200, 500, 1000].forEach((ms) => setTimeout(() => mapObj.current?.relayout(), ms));

      const geocoder = new kakao.maps.services.Geocoder();
      kakao.maps.event.addListener(map, "click", (mouseEvent: any) => {
        const latlng = mouseEvent.latLng;
        marker.setPosition(latlng);
        marker.setMap(map);
        geocoder.coord2Address(latlng.getLng(), latlng.getLat(), (res: any, status: any) => {
          const addr =
            status === kakao.maps.services.Status.OK
              ? res[0].road_address?.address_name || res[0].address?.address_name || ""
              : "";
          onChange({ lat: latlng.getLat(), lng: latlng.getLng(), address: addr });
        });
      });

      // 저장된 좌표가 없으면 현재 위치로 자동 이동/확대
      if (!v.lat) {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const coords = new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
              map.setCenter(coords);
              map.setLevel(3);
            },
            () => {
              // 거부 시 기본(전국) 유지
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
          );
        }
      }
    });
  }, [onChange]);

  useEffect(() => {
    if (ready) initMap();
  }, [ready, initMap]);

  function search() {
    const kakao = window.kakao;
    if (!kakao || !mapObj.current || !query.trim()) return;
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.addressSearch(query, (res: any, status: any) => {
      if (status !== kakao.maps.services.Status.OK || !res[0]) {
        alert("주소를 찾을 수 없습니다.");
        return;
      }
      const { x, y } = res[0];
      placeMarker(Number(y), Number(x), res[0].road_address?.address_name || res[0].address_name || query);
    });
  }

  if (!KEY) {
    return (
      <div className="rounded-xl border border-dashed border-red-300 bg-red-50 p-4 text-sm text-red-600">
        NEXT_PUBLIC_KAKAO_MAP_KEY 가 설정되지 않았습니다. .env.local 확인 후 dev 서버를 재시작하세요.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&libraries=services&autoload=false`}
        strategy="afterInteractive"
        onLoad={() => {
          if (window.kakao && window.kakao.maps) {
            window.kakao.maps.load(() => setReady(true));
          } else {
            setReady(true);
          }
        }}
      />
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="도로명/지번 주소 검색"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
        />
        <PrimaryButton type="button" onClick={search}>
          검색
        </PrimaryButton>
      </div>
      <div ref={mapRef} className="h-64 w-full rounded-xl border border-neutral-200 bg-neutral-100" />
      <p className="text-xs text-neutral-500">
        {value.lat
          ? `선택 좌표: ${value.lat.toFixed(6)}, ${value.lng?.toFixed(6)}`
          : "지도를 클릭하거나 주소를 검색해 위치를 지정하세요."}
      </p>
    </div>
  );
}
