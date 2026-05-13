import React, { useEffect, useRef, useCallback } from "react";

declare const daum: any;

interface AddressData {
  zonecode: string;
  address: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName: string;
  sido: string;
  sigungu: string;
}

interface DaumPostcodeProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (data: AddressData) => void;
}

const SCRIPT_URL =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

let sdkLoadPromise: Promise<void> | null = null;

function ensureSdkLoaded(): Promise<void> {
  if (typeof daum !== "undefined" && daum.Postcode) {
    return Promise.resolve();
  }
  if (sdkLoadPromise) return sdkLoadPromise;
  sdkLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkLoadPromise = null;
      reject(new Error("Failed to load Daum Postcode SDK"));
    };
    document.head.appendChild(script);
  });
  return sdkLoadPromise;
}

export default function DaumPostcode({
  visible,
  onClose,
  onSelect,
}: DaumPostcodeProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelect);
  const onCloseRef = useRef(onClose);
  onSelectRef.current = onSelect;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (!visible) {
      if (overlayRef.current && document.body.contains(overlayRef.current)) {
        document.body.removeChild(overlayRef.current);
        overlayRef.current = null;
        containerRef.current = null;
      }
      return;
    }

    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:#fff;display:flex;flex-direction:column;";
    overlayRef.current = overlay;

    const header = document.createElement("div");
    header.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #e5e5e5;padding-top:67px;background:#fff;flex-shrink:0;";

    const closeBtn = document.createElement("button");
    closeBtn.style.cssText =
      "width:40px;height:40px;border:none;background:none;cursor:pointer;font-size:24px;display:flex;align-items:center;justify-content:center;color:#1a1a2e;";
    closeBtn.innerHTML = "✕";
    closeBtn.onclick = () => onCloseRef.current();

    const title = document.createElement("span");
    title.style.cssText =
      "font-size:17px;font-weight:600;color:#1a1a2e;";
    title.textContent = "주소 검색";

    const spacer = document.createElement("div");
    spacer.style.cssText = "width:40px;height:40px;";

    header.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(spacer);

    const embedContainer = document.createElement("div");
    embedContainer.style.cssText = "flex:1;min-height:400px;overflow:auto;";
    containerRef.current = embedContainer;

    const loadingDiv = document.createElement("div");
    loadingDiv.style.cssText =
      "display:flex;align-items:center;justify-content:center;height:100%;font-size:14px;color:#888;";
    loadingDiv.textContent = "주소 검색 로딩 중...";
    embedContainer.appendChild(loadingDiv);

    overlay.appendChild(header);
    overlay.appendChild(embedContainer);
    document.body.appendChild(overlay);

    let cancelled = false;

    ensureSdkLoaded()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = "";
        new daum.Postcode({
          oncomplete: (data: any) => {
            onSelectRef.current({
              zonecode: data.zonecode,
              address: data.address,
              roadAddress: data.roadAddress,
              jibunAddress: data.jibunAddress,
              buildingName: data.buildingName,
              sido: data.sido,
              sigungu: data.sigungu,
            });
          },
          width: "100%",
          height: "100%",
        }).embed(containerRef.current);
      })
      .catch(() => {
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#c00;">주소 검색을 불러올 수 없습니다. 다시 시도해주세요.</div>';
      });

    return () => {
      cancelled = true;
      if (overlayRef.current && document.body.contains(overlayRef.current)) {
        document.body.removeChild(overlayRef.current);
      }
      overlayRef.current = null;
      containerRef.current = null;
    };
  }, [visible]);

  return null;
}
