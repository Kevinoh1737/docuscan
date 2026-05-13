import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
  LayoutChangeEvent,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import { Image as ExpoImage } from "expo-image";
import Colors from "@/constants/colors";
import { useSubmission } from "@/contexts/SubmissionContext";

let CameraView: any = null;
let useCameraPermissions: any = null;
if (Platform.OS !== "web") {
  const cam = require("expo-camera");
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
}

const MASK_COLOR = "rgba(0,0,0,0.55)";
const DOC_ASPECT = 0.707;
const RECEIPT_ASPECT = 0.55;
const GUIDE_COLOR_DEFAULT = "rgba(255,255,255,0.6)";
const GUIDE_COLOR_DETECTED = "#4ADE80";

function WebCameraScreen() {
  const {
    currentScanType, addScannedDoc, scannedDocs,
    currentReceiptGroupId, startNewReceiptGroup,
    getReceiptGroupNumber, getNextPartNumber,
  } = useSubmission();
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectionIntervalRef = useRef<any>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [documentDetected, setDocumentDetected] = useState(false);
  const [frameLayout, setFrameLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [guideAreaLayout, setGuideAreaLayout] = useState({ width: 0, height: 0 });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);

  const isReceipt = currentScanType === "receipt";
  const existingReceipts = scannedDocs.filter(d => d.documentType === "receipt");
  const activeGroupId = currentReceiptGroupId;
  const currentGroupParts = activeGroupId
    ? scannedDocs.filter(d => d.receiptGroupId === activeGroupId)
    : [];
  const partNumber = activeGroupId ? getNextPartNumber(activeGroupId) : 1;
  const groupNumber = activeGroupId ? getReceiptGroupNumber(activeGroupId) : (
    [...new Set(existingReceipts.map(d => d.receiptGroupId).filter(Boolean))].length + 1
  );

  const docTypeLabel = currentScanType === "family_certificate" ? "가족관계증명서" : "영수증";

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2000);
  }, []);

  useEffect(() => {
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, []);
  const frameAspect = isReceipt ? RECEIPT_ASPECT : DOC_ASPECT;
  const guideColor = documentDetected ? GUIDE_COLOR_DETECTED : GUIDE_COLOR_DEFAULT;

  const generateId = () =>
    Date.now().toString() + Math.random().toString(36).substr(2, 9);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  }, []);

  const analyzeFrame = useCallback(() => {
    const video = videoElRef.current;
    if (!video || video.readyState < 2 || !detectionCanvasRef.current) return;
    if (guideAreaLayout.width === 0 || frameLayout.width === 0) return;

    const dc = detectionCanvasRef.current;
    const sampleW = 160;
    const sampleH = Math.round(sampleW * (guideAreaLayout.height / guideAreaLayout.width));
    dc.width = sampleW;
    dc.height = sampleH;
    const ctx = dc.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, sampleW, sampleH);

    const scaleX = sampleW / guideAreaLayout.width;
    const scaleY = sampleH / guideAreaLayout.height;
    const fx = Math.round(frameLayout.x * scaleX);
    const fy = Math.round(frameLayout.y * scaleY);
    const fw = Math.round(frameLayout.width * scaleX);
    const fh = Math.round(frameLayout.height * scaleY);

    if (fw < 10 || fh < 10) return;

    const sampleEdge = (startX: number, startY: number, dx: number, dy: number, steps: number) => {
      let totalGradient = 0;
      const margin = 3;
      for (let i = 0; i < steps; i++) {
        const px = Math.round(startX + dx * i);
        const py = Math.round(startY + dy * i);
        const innerX = Math.min(Math.max(px + (dx === 0 ? 0 : 0) + (dy !== 0 ? 0 : margin * Math.sign(dx === 0 ? (startX > sampleW / 2 ? -1 : 1) : 0)), 0), sampleW - 1);
        const innerY = Math.min(Math.max(py + (dy === 0 ? 0 : margin * Math.sign(startY > sampleH / 2 ? -1 : 1)), 0), sampleH - 1);
        const outerX = Math.min(Math.max(px - (dx === 0 ? 0 : 0) - (dy !== 0 ? 0 : margin * Math.sign(dx === 0 ? (startX > sampleW / 2 ? -1 : 1) : 0)), 0), sampleW - 1);
        const outerY = Math.min(Math.max(py - (dy === 0 ? 0 : margin * Math.sign(startY > sampleH / 2 ? -1 : 1)), 0), sampleH - 1);

        try {
          const inner = ctx.getImageData(innerX, innerY, 1, 1).data;
          const outer = ctx.getImageData(outerX, outerY, 1, 1).data;
          const innerBright = (inner[0] + inner[1] + inner[2]) / 3;
          const outerBright = (outer[0] + outer[1] + outer[2]) / 3;
          totalGradient += Math.abs(innerBright - outerBright);
        } catch { }
      }
      return steps > 0 ? totalGradient / steps : 0;
    };

    const edgeSamples = 12;
    const topEdge = sampleEdge(fx, fy, fw / edgeSamples, 0, edgeSamples);
    const bottomEdge = sampleEdge(fx, fy + fh, fw / edgeSamples, 0, edgeSamples);
    const leftEdge = sampleEdge(fx, fy, 0, fh / edgeSamples, edgeSamples);
    const rightEdge = sampleEdge(fx + fw, fy, 0, fh / edgeSamples, edgeSamples);

    const threshold = 15;
    const detectedEdges = [topEdge, bottomEdge, leftEdge, rightEdge].filter(e => e > threshold).length;
    setDocumentDetected(detectedEdges >= 3);
  }, [guideAreaLayout, frameLayout]);

  useEffect(() => {
    if (capturedUri) return;
    if (typeof document === "undefined") return;

    let mounted = true;
    let resolved = false;
    let video: HTMLVideoElement | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let detectionCanvas: HTMLCanvasElement | null = null;
    let domNode: HTMLElement | null = null;
    let globalTimer: any = null;

    const markResolved = () => { resolved = true; };

    const markReady = () => {
      if (mounted && !resolved) {
        markResolved();
        setCameraReady(true);
      }
    };

    const markError = (msg: string) => {
      if (mounted && !resolved) {
        markResolved();
        setCameraError(msg);
      }
    };

    globalTimer = setTimeout(() => {
      if (!resolved && mounted) {
        if (streamRef.current) {
          markReady();
        } else {
          markError("카메라 연결 시간이 초과되었습니다. 다시 시도해주세요.");
        }
      }
    }, 10000);

    const findDomNode = (): HTMLElement | null => {
      return document.getElementById("web-camera-container")
        || document.querySelector('[data-testid="camera-container"]') as HTMLElement
        || null;
    };

    const getUserMediaWithTimeout = (
      constraint: MediaStreamConstraints,
      timeoutMs: number
    ): Promise<MediaStream> => {
      return new Promise((resolve, reject) => {
        let done = false;
        const timer = setTimeout(() => {
          if (!done) { done = true; reject(new Error("getUserMedia timeout")); }
        }, timeoutMs);
        navigator.mediaDevices.getUserMedia(constraint)
          .then((stream) => {
            if (!done) { done = true; clearTimeout(timer); resolve(stream); }
            else { stream.getTracks().forEach(t => t.stop()); }
          })
          .catch((err) => {
            if (!done) { done = true; clearTimeout(timer); reject(err); }
          });
      });
    };

    const findAndInit = (attempt = 0) => {
      if (!mounted || resolved) return;
      domNode = findDomNode();
      if (!domNode) {
        if (attempt < 30) {
          setTimeout(() => findAndInit(attempt + 1), 100);
        } else {
          markError("카메라를 초기화할 수 없습니다. 다시 시도해주세요.");
        }
        return;
      }

      video = document.createElement("video");
      video.setAttribute("autoplay", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.setAttribute("muted", "");
      video.muted = true;
      video.playsInline = true;
      video.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;";
      domNode.appendChild(video);
      videoElRef.current = video;

      canvas = document.createElement("canvas");
      canvas.style.display = "none";
      domNode.appendChild(canvas);
      canvasElRef.current = canvas;

      detectionCanvas = document.createElement("canvas");
      detectionCanvas.style.display = "none";
      domNode.appendChild(detectionCanvas);
      detectionCanvasRef.current = detectionCanvas;

      startCamera();
    };

    const startCamera = async () => {
      const constraints: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
        { video: { facingMode: "environment" }, audio: false },
        { video: true, audio: false },
      ];

      let stream: MediaStream | null = null;
      let lastError: any = null;
      for (const constraint of constraints) {
        if (!mounted || resolved) return;
        try {
          stream = await getUserMediaWithTimeout(constraint, 6000);
          break;
        } catch (err: any) {
          lastError = err;
          if (err.name === "NotAllowedError") {
            markError("카메라 접근이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.");
            return;
          }
        }
      }

      if (!stream) {
        if (lastError?.name === "NotFoundError") {
          markError("카메라를 찾을 수 없습니다.");
        } else {
          markError("카메라를 시작할 수 없습니다. 다시 시도해주세요.");
        }
        return;
      }

      if (!mounted) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;

      if (video) {
        video.addEventListener("loadedmetadata", () => {
          video!.play().then(markReady).catch(markReady);
        }, { once: true });

        video.addEventListener("canplay", () => {
          video!.play().then(markReady).catch(markReady);
        }, { once: true });

        video.srcObject = stream;

        video.play().catch(() => {});

        setTimeout(() => {
          if (mounted && video && !resolved) video.play().then(markReady).catch(markReady);
        }, 1000);

        setTimeout(() => {
          if (mounted && !resolved) markReady();
        }, 3000);
      }
    };

    findAndInit();

    return () => {
      mounted = false;
      if (globalTimer) clearTimeout(globalTimer);
      stopStream();
      videoElRef.current = null;
      canvasElRef.current = null;
      detectionCanvasRef.current = null;
      if (domNode && video && domNode.contains(video)) domNode.removeChild(video);
      if (domNode && canvas && domNode.contains(canvas)) domNode.removeChild(canvas);
      if (domNode && detectionCanvas && domNode.contains(detectionCanvas)) domNode.removeChild(detectionCanvas);
    };
  }, [capturedUri, stopStream, retryCount]);

  useEffect(() => {
    if (!cameraReady || capturedUri) return;
    detectionIntervalRef.current = setInterval(analyzeFrame, 500);
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [cameraReady, capturedUri, analyzeFrame]);

  const autoCropToFrame = async (uri: string): Promise<string> => {
    try {
      const asset = await ImageManipulator.manipulateAsync(uri, [], {});
      const imgW = asset.width;
      const imgH = asset.height;
      const imgAspect = imgW / imgH;
      if (imgAspect > frameAspect) {
        const newW = imgH * frameAspect;
        const offsetX = (imgW - newW) / 2;
        const cropped = await ImageManipulator.manipulateAsync(
          uri,
          [{ crop: { originX: offsetX, originY: 0, width: newW, height: imgH } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        );
        return cropped.uri;
      } else {
        const newH = imgW / frameAspect;
        const offsetY = (imgH - newH) / 2;
        const cropped = await ImageManipulator.manipulateAsync(
          uri,
          [{ crop: { originX: 0, originY: offsetY, width: imgW, height: newH } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        );
        return cropped.uri;
      }
    } catch {
      return uri;
    }
  };

  const handleCapture = useCallback(async () => {
    if (isCapturing || !videoElRef.current || !canvasElRef.current) return;
    setIsCapturing(true);
    try {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {};
      const video = videoElRef.current;
      const canvas = canvasElRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");
      ctx.drawImage(video, 0, 0);
      const dataUri = canvas.toDataURL("image/jpeg", 0.9);
      const manipulated = await ImageManipulator.manipulateAsync(
        dataUri,
        [{ resize: { width: 1600 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      const cropped = await autoCropToFrame(manipulated.uri);
      stopStream();
      setCapturedUri(cropped);
    } catch (e) {
      console.error("Web capture error:", e);
      Alert.alert("오류", "촬영 중 오류가 발생했습니다.");
    }
    setIsCapturing(false);
  }, [isCapturing, frameAspect, stopStream]);

  const handleAccept = async () => {
    try {
      if (!capturedUri) return;
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {};

      if (isReceipt) {
        let groupId = activeGroupId;
        if (!groupId) {
          groupId = startNewReceiptGroup();
        }
        const pNum = getNextPartNumber(groupId);

        addScannedDoc({
          id: generateId(),
          uri: capturedUri,
          documentType: "receipt",
          imageOrder: existingReceipts.length,
          receiptGroupId: groupId,
          partNumber: pNum,
        });

        const groupParts = scannedDocs.filter(d => d.receiptGroupId === groupId);
        showToast(`영수증 ${groupParts.length + 1}장 저장됨`);
        setCapturedUri(null);
        setDocumentDetected(false);
      } else {
        addScannedDoc({
          id: generateId(),
          uri: capturedUri,
          documentType: currentScanType,
          imageOrder: 0,
        });
        router.back();
      }
    } catch (e) {
      console.error("handleAccept error:", e);
      Alert.alert("오류", "사진 저장 중 오류가 발생했습니다.");
    }
  };

  const handleRetake = () => {
    setCapturedUri(null);
    setDocumentDetected(false);
  };

  const onGuideAreaLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setGuideAreaLayout({ width, height });
  };

  const onFrameLayout = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setFrameLayout({ x, y, width, height });
  };

  if (cameraError) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="camera-outline" size={64} color={Colors.textLight} />
        <Text style={styles.permissionTitle}>카메라 접근 필요</Text>
        <Text style={styles.permissionText}>{cameraError}</Text>
        <Pressable
          onPress={() => { setCameraError(null); setCameraReady(false); setRetryCount(c => c + 1); }}
          style={({ pressed }) => [styles.permissionButton, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.permissionButtonText}>다시 시도</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: Colors.textSecondary, fontSize: 15, fontFamily: "Inter_500Medium" }}>돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  if (capturedUri) {
    return (
      <View style={[styles.container, { backgroundColor: "#000" }]}>
        <View style={[styles.previewHeader, Platform.OS === "web" ? { paddingTop: 67 } : undefined]}>
          <Pressable onPress={handleRetake} style={styles.retakeBtn}>
            <Ionicons name="camera-reverse" size={20} color="#fff" />
            <Text style={styles.retakeBtnText}>다시 촬영</Text>
          </Pressable>
          <Text style={styles.previewTitle}>{docTypeLabel} 확인</Text>
          <Pressable onPress={handleAccept} style={styles.previewBtnAccept}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.previewBtnText}>사용</Text>
          </Pressable>
        </View>
        <View style={styles.previewBanner}>
          <Ionicons name="information-circle" size={16} color="#FFD60A" />
          <Text style={styles.previewBannerText}>
            문서가 기울어지거나 배경이 많이 보이면 다시 촬영해주세요
          </Text>
        </View>
        <View style={styles.previewContainer}>
          <CapturedImage uri={capturedUri} />
        </View>
      </View>
    );
  }

  const hasMaskData = guideAreaLayout.width > 0 && frameLayout.width > 0;

  return (
    <View nativeID="web-camera-container" testID="camera-container" style={[styles.container, { backgroundColor: "#000", position: "relative" as const, overflow: "hidden" as const }]}>
      {!cameraReady ? (
        <View style={[StyleSheet.absoluteFill, styles.centered, { zIndex: 5 }]}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 12 }}>
            카메라 연결 중...
          </Text>
        </View>
      ) : null}

      <View style={[StyleSheet.absoluteFill, styles.cameraOverlay, { zIndex: 10 }]} pointerEvents="box-none">
        <View style={[styles.cameraTopBar, Platform.OS === "web" ? { paddingTop: 12 } : undefined]}>
          <Pressable onPress={() => { stopStream(); router.back(); }} style={styles.cameraBtn}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <View style={styles.docTypeTag}>
            <Text style={styles.docTypeTagText}>{docTypeLabel}</Text>
            {isReceipt ? (
              <Text style={styles.docTypeTagSub}>
                영수증 {groupNumber} · 파트 {partNumber}
              </Text>
            ) : null}
          </View>
          <View style={styles.cameraBtn} />
        </View>

        <View style={styles.guideContainer} onLayout={onGuideAreaLayout}>
          {hasMaskData ? (
            <>
              <View style={[styles.mask, { top: 0, left: 0, right: 0, height: frameLayout.y }]} />
              <View style={[styles.mask, { top: frameLayout.y, left: 0, width: frameLayout.x, height: frameLayout.height }]} />
              <View style={[styles.mask, { top: frameLayout.y, left: frameLayout.x + frameLayout.width, right: 0, height: frameLayout.height }]} />
              <View style={[styles.mask, { top: frameLayout.y + frameLayout.height, left: 0, right: 0, bottom: 0 }]} />
            </>
          ) : null}
          <View
            onLayout={onFrameLayout}
            style={[
              styles.guideFrame,
              isReceipt ? styles.guideFrameReceipt : styles.guideFrameDoc,
              { borderColor: guideColor },
            ]}
          >
            <View style={[styles.corner, styles.cornerTL, { borderColor: guideColor }]} />
            <View style={[styles.corner, styles.cornerTR, { borderColor: guideColor }]} />
            <View style={[styles.corner, styles.cornerBL, { borderColor: guideColor }]} />
            <View style={[styles.corner, styles.cornerBR, { borderColor: guideColor }]} />
          </View>

          {documentDetected ? (
            <View style={styles.detectedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
              <Text style={styles.detectedText}>문서가 감지되었습니다</Text>
            </View>
          ) : (
            <Text style={styles.guideText}>
              {isReceipt
                ? "영수증을 프레임에 맞춰주세요"
                : "증명서를 프레임에 맞춰주세요"}
            </Text>
          )}

          {isReceipt && partNumber > 1 ? (
            <View style={styles.overlapHint}>
              <Ionicons name="layers" size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.overlapHintText}>
                이전 사진과 20% 이상 겹치게 촬영하세요
              </Text>
            </View>
          ) : null}
        </View>

        {toastMessage ? (
          <View style={styles.toastContainer} pointerEvents="none">
            <View style={styles.toast}>
              <Ionicons name="checkmark-circle" size={18} color="#4ADE80" />
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          </View>
        ) : null}

        {isReceipt && currentGroupParts.length > 0 && !capturedUri ? (
          <View style={styles.thumbnailStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailScroll}>
              {currentGroupParts.map((doc, idx) => (
                <View key={doc.id} style={styles.thumbnailItem}>
                  <ExpoImage source={{ uri: doc.uri }} style={styles.thumbnailImage} contentFit="cover" />
                  <Text style={styles.thumbnailLabel}>{idx + 1}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.thumbnailCount}>
              <Text style={styles.thumbnailCountText}>{currentGroupParts.length}장</Text>
            </View>
          </View>
        ) : null}

        <View style={[styles.cameraBottomBar, { paddingBottom: Platform.OS === "web" ? 20 : 16 }]}>
          {isReceipt && currentGroupParts.length > 0 ? (
            <Pressable
              onPress={() => { stopStream(); router.back(); }}
              style={({ pressed }) => [styles.doneButton, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.doneButtonText}>{currentGroupParts.length}장 완료</Text>
            </Pressable>
          ) : <View style={{ width: 80 }} />}

          <Pressable
            onPress={handleCapture}
            style={({ pressed }) => [
              styles.captureButton,
              documentDetected && styles.captureButtonDetected,
              pressed && styles.captureButtonPressed,
            ]}
            disabled={isCapturing || !cameraReady}
          >
            {isCapturing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={[styles.captureInner, documentDetected && styles.captureInnerDetected]} />
            )}
          </Pressable>

          <View style={{ width: 80 }} />
        </View>
      </View>
    </View>
  );
}

function NativeCameraScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top;
  const bottomPad = insets.bottom;
  const {
    currentScanType, addScannedDoc, scannedDocs,
    currentReceiptGroupId, startNewReceiptGroup,
    getReceiptGroupNumber, getNextPartNumber,
  } = useSubmission();
  const cameraRef = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions!();
  const [isCapturing, setIsCapturing] = useState(false);
  const [flash, setFlash] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [frameLayout, setFrameLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [guideAreaLayout, setGuideAreaLayout] = useState({ width: 0, height: 0 });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);

  const isReceipt = currentScanType === "receipt";
  const existingReceipts = scannedDocs.filter(d => d.documentType === "receipt");
  const activeGroupId = currentReceiptGroupId;
  const currentGroupParts = activeGroupId
    ? scannedDocs.filter(d => d.receiptGroupId === activeGroupId)
    : [];
  const partNumber = activeGroupId ? getNextPartNumber(activeGroupId) : 1;
  const groupNumber = activeGroupId ? getReceiptGroupNumber(activeGroupId) : (
    [...new Set(existingReceipts.map(d => d.receiptGroupId).filter(Boolean))].length + 1
  );

  const docTypeLabel = currentScanType === "family_certificate" ? "가족관계증명서" : "영수증";
  const frameAspect = isReceipt ? RECEIPT_ASPECT : DOC_ASPECT;

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2000);
  }, []);

  useEffect(() => {
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); };
  }, []);

  const generateId = () =>
    Date.now().toString() + Math.random().toString(36).substr(2, 9);

  const onGuideAreaLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setGuideAreaLayout({ width, height });
  };

  const onFrameLayout = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setFrameLayout({ x, y, width, height });
  };

  const autoCropToFrame = async (uri: string): Promise<string> => {
    try {
      const asset = await ImageManipulator.manipulateAsync(uri, [], {});
      const imgW = asset.width;
      const imgH = asset.height;
      const imgAspect = imgW / imgH;
      if (imgAspect > frameAspect) {
        const newW = imgH * frameAspect;
        const offsetX = (imgW - newW) / 2;
        const cropped = await ImageManipulator.manipulateAsync(
          uri,
          [{ crop: { originX: offsetX, originY: 0, width: newW, height: imgH } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        );
        return cropped.uri;
      } else {
        const newH = imgW / frameAspect;
        const offsetY = (imgH - newH) / 2;
        const cropped = await ImageManipulator.manipulateAsync(
          uri,
          [{ crop: { originX: 0, originY: offsetY, width: imgW, height: newH } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        );
        return cropped.uri;
      }
    } catch {
      return uri;
    }
  };

  const handleCapture = useCallback(async () => {
    if (isCapturing || !cameraRef.current) return;
    setIsCapturing(true);
    try {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {};
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      if (!photo?.uri) {
        Alert.alert("오류", "사진 촬영에 실패했습니다.");
        setIsCapturing(false);
        return;
      }
      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      const cropped = await autoCropToFrame(manipulated.uri);
      setCapturedUri(cropped);
    } catch (e) {
      console.error("Capture error:", e);
      Alert.alert("오류", "촬영 중 오류가 발생했습니다.");
    }
    setIsCapturing(false);
  }, [isCapturing, frameAspect]);

  const handleAccept = async () => {
    try {
      if (!capturedUri) return;
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {};

      if (isReceipt) {
        let groupId = activeGroupId;
        if (!groupId) {
          groupId = startNewReceiptGroup();
        }
        const pNum = getNextPartNumber(groupId);

        addScannedDoc({
          id: generateId(),
          uri: capturedUri,
          documentType: "receipt",
          imageOrder: existingReceipts.length,
          receiptGroupId: groupId,
          partNumber: pNum,
        });

        const groupParts = scannedDocs.filter(d => d.receiptGroupId === groupId);
        showToast(`영수증 ${groupParts.length + 1}장 저장됨`);
        setCapturedUri(null);
      } else {
        addScannedDoc({
          id: generateId(),
          uri: capturedUri,
          documentType: currentScanType,
          imageOrder: 0,
        });
        router.back();
      }
    } catch (e) {
      console.error("handleAccept error:", e);
      Alert.alert("오류", "사진 저장 중 오류가 발생했습니다.");
    }
  };

  const handleRetake = () => {
    setCapturedUri(null);
  };

  if (!permission) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: topPad, paddingBottom: bottomPad }]}>
        <Ionicons name="camera-outline" size={64} color={Colors.textLight} />
        <Text style={styles.permissionTitle}>카메라 접근 필요</Text>
        <Text style={styles.permissionText}>문서를 스캔하려면 카메라 접근 권한이 필요합니다</Text>
        <Pressable
          onPress={requestPermission}
          style={({ pressed }) => [styles.permissionButton, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.permissionButtonText}>카메라 허용</Text>
        </Pressable>
        {!permission.canAskAgain ? (
          <Text style={styles.settingsHint}>설정 앱에서 카메라 권한을 허용해주세요</Text>
        ) : null}
      </View>
    );
  }

  if (capturedUri) {
    return (
      <View style={[styles.container, { paddingTop: topPad, backgroundColor: "#000" }]}>
        <View style={styles.previewHeader}>
          <Pressable onPress={handleRetake} style={styles.retakeBtn}>
            <Ionicons name="camera-reverse" size={20} color="#fff" />
            <Text style={styles.retakeBtnText}>다시 촬영</Text>
          </Pressable>
          <Text style={styles.previewTitle}>{docTypeLabel} 확인</Text>
          <Pressable onPress={handleAccept} style={styles.previewBtnAccept}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.previewBtnText}>사용</Text>
          </Pressable>
        </View>
        <View style={styles.previewBanner}>
          <Ionicons name="information-circle" size={16} color="#FFD60A" />
          <Text style={styles.previewBannerText}>
            문서가 기울어지거나 배경이 많이 보이면 다시 촬영해주세요
          </Text>
        </View>
        <View style={styles.previewContainer}>
          <CapturedImage uri={capturedUri} />
        </View>
      </View>
    );
  }

  const hasMaskData = guideAreaLayout.width > 0 && frameLayout.width > 0;

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={flash}
      />
      <View style={[StyleSheet.absoluteFill, styles.cameraOverlay, { paddingTop: topPad }]} pointerEvents="box-none">
        <View style={styles.cameraTopBar}>
          <Pressable onPress={() => router.back()} style={styles.cameraBtn}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <View style={styles.docTypeTag}>
            <Text style={styles.docTypeTagText}>{docTypeLabel}</Text>
            {isReceipt ? (
              <Text style={styles.docTypeTagSub}>
                영수증 {groupNumber} · 파트 {partNumber}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={() => setFlash(!flash)} style={styles.cameraBtn}>
            <Ionicons name={flash ? "flash" : "flash-off"} size={24} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.guideContainer} onLayout={onGuideAreaLayout}>
          {hasMaskData ? (
            <>
              <View style={[styles.mask, { top: 0, left: 0, right: 0, height: frameLayout.y }]} />
              <View style={[styles.mask, { top: frameLayout.y, left: 0, width: frameLayout.x, height: frameLayout.height }]} />
              <View style={[styles.mask, { top: frameLayout.y, left: frameLayout.x + frameLayout.width, right: 0, height: frameLayout.height }]} />
              <View style={[styles.mask, { top: frameLayout.y + frameLayout.height, left: 0, right: 0, bottom: 0 }]} />
            </>
          ) : null}
          <View
            onLayout={onFrameLayout}
            style={[
              styles.guideFrame,
              isReceipt ? styles.guideFrameReceipt : styles.guideFrameDoc,
            ]}
          >
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.guideText}>
            {isReceipt
              ? "영수증을 프레임에 맞춰주세요"
              : "증명서를 프레임에 맞춰주세요"}
          </Text>
          {isReceipt && partNumber > 1 ? (
            <View style={styles.overlapHint}>
              <Ionicons name="layers" size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.overlapHintText}>
                이전 사진과 20% 이상 겹치게 촬영하세요
              </Text>
            </View>
          ) : null}
        </View>

        {toastMessage ? (
          <View style={styles.toastContainer} pointerEvents="none">
            <View style={styles.toast}>
              <Ionicons name="checkmark-circle" size={18} color="#4ADE80" />
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          </View>
        ) : null}

        {isReceipt && currentGroupParts.length > 0 && !capturedUri ? (
          <View style={styles.thumbnailStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailScroll}>
              {currentGroupParts.map((doc, idx) => (
                <View key={doc.id} style={styles.thumbnailItem}>
                  <ExpoImage source={{ uri: doc.uri }} style={styles.thumbnailImage} contentFit="cover" />
                  <Text style={styles.thumbnailLabel}>{idx + 1}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.thumbnailCount}>
              <Text style={styles.thumbnailCountText}>{currentGroupParts.length}장</Text>
            </View>
          </View>
        ) : null}

        <View style={[styles.cameraBottomBar, { paddingBottom: bottomPad + 16 }]}>
          {isReceipt && currentGroupParts.length > 0 ? (
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.doneButton, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.doneButtonText}>{currentGroupParts.length}장 완료</Text>
            </Pressable>
          ) : <View style={{ width: 80 }} />}

          <Pressable
            onPress={handleCapture}
            style={({ pressed }) => [
              styles.captureButton,
              pressed && styles.captureButtonPressed,
            ]}
            disabled={isCapturing}
          >
            {isCapturing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={styles.captureInner} />
            )}
          </Pressable>

          <View style={{ width: 80 }} />
        </View>
      </View>
    </View>
  );
}

export default function CameraScreen() {
  if (Platform.OS === "web") {
    return <WebCameraScreen />;
  }
  return <NativeCameraScreen />;
}

function CapturedImage({ uri }: { uri: string }) {
  return (
    <ExpoImage
      source={{ uri }}
      style={styles.previewImage}
      contentFit="contain"
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  permissionTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginTop: 16,
  },
  permissionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 8,
  },
  permissionButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  settingsHint: {
    fontSize: 12,
    color: Colors.textLight,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  cameraTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 10,
  },
  cameraBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  docTypeTag: {
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
  },
  docTypeTagText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  docTypeTagSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  guideContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    position: "relative",
    overflow: "hidden",
  },
  mask: {
    position: "absolute",
    backgroundColor: MASK_COLOR,
    zIndex: 1,
  },
  guideFrame: {
    borderWidth: 2,
    borderColor: GUIDE_COLOR_DEFAULT,
    borderRadius: 8,
    position: "relative",
    zIndex: 2,
  },
  guideFrameDoc: {
    width: "96%",
    aspectRatio: DOC_ASPECT,
    maxHeight: "90%",
  },
  guideFrameReceipt: {
    width: "92%",
    aspectRatio: RECEIPT_ASPECT,
    maxHeight: "85%",
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: GUIDE_COLOR_DEFAULT,
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  guideText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginTop: 14,
    zIndex: 2,
    ...Platform.select({
      web: { textShadow: "0px 1px 3px rgba(0,0,0,0.5)" },
      default: {
        textShadowColor: "rgba(0,0,0,0.5)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
      },
    }),
  },
  detectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    backgroundColor: "rgba(74,222,128,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 2,
  },
  detectedText: {
    color: "#4ADE80",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  overlapHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: "rgba(0,102,255,0.4)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 2,
  },
  overlapHintText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  cameraBottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  captureButtonDetected: {
    borderColor: "#4ADE80",
    backgroundColor: "rgba(74,222,128,0.15)",
  },
  captureButtonPressed: {
    transform: [{ scale: 0.92 }],
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
  },
  captureInnerDetected: {
    backgroundColor: "#4ADE80",
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#000",
  },
  previewTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  retakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,59,48,0.8)",
    borderRadius: 8,
  },
  retakeBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  previewBtnAccept: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  previewBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  previewBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(50,50,50,0.95)",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  previewBannerText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  toastContainer: {
    position: "absolute",
    top: 80,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 100,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
  },
  toastText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  thumbnailStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  thumbnailScroll: {
    gap: 6,
    alignItems: "center",
  },
  thumbnailItem: {
    position: "relative",
    width: 40,
    height: 40,
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  thumbnailLabel: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderTopLeftRadius: 4,
  },
  thumbnailCount: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  thumbnailCountText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  doneButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    minWidth: 80,
    justifyContent: "center",
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  previewImage: {
    flex: 1,
    width: "100%",
  },
});
