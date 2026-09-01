"use client";

import "../studio.css";
import { useEffect, useState } from "react";
import { toDataURL as qrToDataURL } from "qrcode";

// 수업 방 참가용 QR 코드 — 스캔하면 참가 페이지(?code=…)로 이동합니다.
export function RoomQrCode({ roomCode }: { roomCode: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!roomCode) return;
    const url = `${window.location.origin}/?code=${roomCode}`;
    let cancelled = false;
    void qrToDataURL(url, {
      width: 240,
      margin: 2,
      color: { dark: "#23274f", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((urlValue) => { if (!cancelled) setDataUrl(urlValue); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [roomCode]);

  return (
    <div className="qr-mark" aria-label="방 참가 QR 코드">
      {dataUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element -- QR 코드는 data URL이라 next/image 최적화 불가 */
        <img src={dataUrl} alt={`방 참가 QR 코드 (${roomCode})`} width={240} height={240} />
      ) : (
        <span className="qr-mark__placeholder" aria-hidden="true">QR</span>
      )}
      <p className="qr-mark__hint">스캔하면 바로 입장할 수 있어요</p>
    </div>
  );
}
