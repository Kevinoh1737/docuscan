import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useSubmission } from "@/contexts/SubmissionContext";
import { uploadFileToStorage, uploadBlobUriToStorage } from "@/client/utils/objectStorageExpo";
import { apiRequest } from "@/lib/query-client";
import { File } from "expo-file-system";

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { userInfo, scannedDocs } = useSubmission();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const familyCerts = scannedDocs.filter(
    (d) => d.documentType === "family_certificate"
  );
  const receipts = scannedDocs.filter((d) => d.documentType === "receipt");

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const subRes = await apiRequest("POST", "/api/submissions", {
        name: userInfo.name,
        phone: userInfo.phone,
        address: userInfo.address,
        addressDetail: userInfo.addressDetail,
        kakaoId: userInfo.kakaoId || null,
        bankName: userInfo.bankName || null,
        bankAccount: userInfo.bankAccount || null,
        bankHolder: userInfo.bankHolder || null,
      });
      const submission = await subRes.json();

      const receiptGroups = [...new Set(
        scannedDocs
          .filter(d => d.documentType === "receipt" && d.receiptGroupId)
          .map(d => d.receiptGroupId!)
      )];

      const uploadedImages = [];
      for (const doc of scannedDocs) {
        let fileName = "";
        if (doc.documentType === "family_certificate") {
          fileName = `${userInfo.name}_가족관계증명서.jpg`;
        } else if (doc.receiptGroupId) {
          const gIdx = receiptGroups.indexOf(doc.receiptGroupId) + 1;
          const pNum = doc.partNumber || 1;
          fileName = `${userInfo.name}_영수증_G${gIdx}_P${pNum}.jpg`;
        } else {
          fileName = `${userInfo.name}_영수증_${doc.imageOrder + 1}.jpg`;
        }

        let uploadUrl: string;
        if (Platform.OS === "web") {
          uploadUrl = await uploadBlobUriToStorage(doc.uri);
        } else {
          const file = new File(doc.uri);
          uploadUrl = await uploadFileToStorage(file);
        }
        uploadedImages.push({
          uploadUrl,
          documentType: doc.documentType,
          imageOrder: doc.imageOrder,
          fileName,
        });
      }

      await apiRequest("POST", `/api/submissions/${submission.id}/images`, {
        images: uploadedImages,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/complete");
    } catch (error) {
      console.error("Submit error:", error);
      Alert.alert("접수 오류", "접수 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
    setIsSubmitting(false);
  };

  if (previewImage) {
    return (
      <View style={[styles.container, { backgroundColor: "#000" }]}>
        <View style={[styles.previewTopBar, { paddingTop: topPad + 8 }]}>
          <Pressable onPress={() => setPreviewImage(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
        </View>
        <Image
          source={{ uri: previewImage }}
          style={{ flex: 1 }}
          contentFit="contain"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>접수 확인</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.progress}>
        <View style={[styles.progressDot, styles.progressDone]} />
        <View style={[styles.progressLine, styles.progressLineDone]} />
        <View style={[styles.progressDot, styles.progressDone]} />
        <View style={[styles.progressLine, styles.progressLineDone]} />
        <View style={[styles.progressDot, styles.progressActive]} />
        <View style={styles.progressLine} />
        <View style={styles.progressDot} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>신청인 정보</Text>
          <View style={styles.infoCard}>
            <InfoRow label="이름" value={userInfo.name} />
            <InfoRow label="전화번호" value={userInfo.phone} />
            <InfoRow label="주소" value={userInfo.address} />
            {userInfo.addressDetail ? (
              <InfoRow label="상세주소" value={userInfo.addressDetail} />
            ) : null}
            {userInfo.bankName ? (
              <InfoRow label="은행명" value={userInfo.bankName} />
            ) : null}
            {userInfo.bankAccount ? (
              <InfoRow label="계좌번호" value={userInfo.bankAccount} />
            ) : null}
            {userInfo.bankHolder ? (
              <InfoRow label="예금주" value={userInfo.bankHolder} />
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            가족관계증명서 ({familyCerts.length}장)
          </Text>
          <View style={styles.imageRow}>
            {familyCerts.map((doc) => (
              <Pressable
                key={doc.id}
                onPress={() => setPreviewImage(doc.uri)}
                style={styles.imageCard}
              >
                <Image
                  source={{ uri: doc.uri }}
                  style={styles.imageThumb}
                  contentFit="cover"
                />
                <View style={styles.imageOverlay}>
                  <Ionicons name="expand" size={16} color="#fff" />
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            영수증 ({receipts.length}장)
          </Text>
          <View style={styles.imageRow}>
            {receipts.map((doc, i) => (
              <Pressable
                key={doc.id}
                onPress={() => setPreviewImage(doc.uri)}
                style={styles.imageCard}
              >
                <Image
                  source={{ uri: doc.uri }}
                  style={styles.imageThumb}
                  contentFit="cover"
                />
                <View style={styles.orderLabel}>
                  <Text style={styles.orderLabelText}>
                    {i + 1}/{receipts.length}
                  </Text>
                </View>
                <View style={styles.imageOverlay}>
                  <Ionicons name="expand" size={16} color="#fff" />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: bottomPad + 16 }]}>
        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={({ pressed }) => [
            styles.submitButton,
            pressed && !isSubmitting && styles.submitButtonPressed,
            isSubmitting && styles.submitButtonDisabled,
          ]}
        >
          {isSubmitting ? (
            <>
              <ActivityIndicator size="small" color={Colors.white} />
              <Text style={styles.submitButtonText}>접수 중...</Text>
            </>
          ) : (
            <>
              <Ionicons name="paper-plane" size={20} color={Colors.white} />
              <Text style={styles.submitButtonText}>접수하기</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  progress: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingVertical: 8,
    gap: 4,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
  },
  progressActive: {
    backgroundColor: Colors.primary,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  progressDone: { backgroundColor: Colors.success },
  progressLine: { flex: 1, height: 2, backgroundColor: Colors.border },
  progressLineDone: { backgroundColor: Colors.success },
  scrollView: { flex: 1 },
  section: { paddingHorizontal: 24, marginBottom: 24 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    flex: 1,
    textAlign: "right",
  },
  imageRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  imageCard: {
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  imageThumb: {
    width: 100,
    height: 140,
    backgroundColor: Colors.surfaceAlt,
  },
  imageOverlay: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  orderLabel: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  orderLabelText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  noteBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: Colors.primaryLight,
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.primary,
    lineHeight: 18,
  },
  previewTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
});
