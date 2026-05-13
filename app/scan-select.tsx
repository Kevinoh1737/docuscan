import React from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  FlatList,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import Colors from "@/constants/colors";
import { useSubmission } from "@/contexts/SubmissionContext";

export default function ScanSelectScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { scannedDocs, setCurrentScanType, removeScannedDoc, startNewReceiptGroup } = useSubmission();

  const familyCerts = scannedDocs.filter(
    (d) => d.documentType === "family_certificate"
  );
  const receipts = scannedDocs.filter((d) => d.documentType === "receipt");

  const canProceed = familyCerts.length >= 1 && receipts.length >= 1;

  const handleScanFamily = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentScanType("family_certificate");
    router.push("/camera");
  };

  const receiptGroupIds = [...new Set(
    receipts.map(d => d.receiptGroupId).filter(Boolean)
  )] as string[];

  const handleScanReceipt = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentScanType("receipt");
    startNewReceiptGroup();
    router.push("/camera");
  };

  const handleNext = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/review");
  };

  const handleRemove = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    removeScannedDoc(id);
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>문서 스캔</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.progress}>
        <View style={[styles.progressDot, styles.progressDone]} />
        <View style={[styles.progressLine, styles.progressLineDone]} />
        <View style={[styles.progressDot, styles.progressActive]} />
        <View style={styles.progressLine} />
        <View style={styles.progressDot} />
        <View style={styles.progressLine} />
        <View style={styles.progressDot} />
      </View>

      <FlatList
        data={[]}
        renderItem={() => null}
        ListHeaderComponent={
          <View style={styles.content}>
            <View style={styles.docSection}>
              <View style={styles.docHeader}>
                <View style={styles.docTitleRow}>
                  <Ionicons name="document" size={20} color={Colors.primary} />
                  <Text style={styles.docTitle}>가족관계증명서</Text>
                </View>
                <Text style={styles.docRequirement}>
                  {familyCerts.length}/1 (필수)
                </Text>
              </View>

              {familyCerts.length > 0 ? (
                <View style={styles.thumbnailRow}>
                  {familyCerts.map((doc) => (
                    <View key={doc.id} style={styles.thumbnailContainer}>
                      <Image
                        source={{ uri: doc.uri }}
                        style={styles.thumbnail}
                        contentFit="cover"
                      />
                      <Pressable
                        style={styles.removeBtn}
                        onPress={() => handleRemove(doc.id)}
                      >
                        <Ionicons name="close-circle" size={22} color={Colors.danger} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}

              <Pressable
                onPress={handleScanFamily}
                style={({ pressed }) => [
                  styles.scanButton,
                  familyCerts.length >= 1 && styles.scanButtonDone,
                  pressed && styles.scanButtonPressed,
                ]}
              >
                <Ionicons
                  name="camera"
                  size={20}
                  color={familyCerts.length >= 1 ? Colors.success : Colors.primary}
                />
                <Text
                  style={[
                    styles.scanButtonText,
                    familyCerts.length >= 1 && styles.scanButtonTextDone,
                  ]}
                >
                  {familyCerts.length >= 1 ? "다시 촬영" : "촬영하기"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.divider} />

            <View style={styles.docSection}>
              <View style={styles.docHeader}>
                <View style={styles.docTitleRow}>
                  <Ionicons name="receipt" size={20} color={Colors.primary} />
                  <Text style={styles.docTitle}>영수증</Text>
                </View>
                <Text style={styles.docRequirement}>
                  {receipts.length}장 (최소 1장)
                </Text>
              </View>

              {receipts.length > 0 ? (
                <View style={styles.receiptGroupsContainer}>
                  {receiptGroupIds.length > 0 ? (
                    receiptGroupIds.map((gid, gIdx) => {
                      const groupDocs = receipts.filter(d => d.receiptGroupId === gid);
                      return (
                        <View key={gid} style={styles.receiptGroup}>
                          <Text style={styles.receiptGroupLabel}>
                            영수증 {gIdx + 1} ({groupDocs.length}장)
                          </Text>
                          <View style={styles.thumbnailRow}>
                            {groupDocs.map((doc) => (
                              <View key={doc.id} style={styles.thumbnailContainer}>
                                <Image
                                  source={{ uri: doc.uri }}
                                  style={styles.thumbnail}
                                  contentFit="cover"
                                />
                                <View style={styles.orderBadge}>
                                  <Text style={styles.orderBadgeText}>
                                    P{doc.partNumber || 1}
                                  </Text>
                                </View>
                                <Pressable
                                  style={styles.removeBtn}
                                  onPress={() => handleRemove(doc.id)}
                                >
                                  <Ionicons name="close-circle" size={22} color={Colors.danger} />
                                </Pressable>
                              </View>
                            ))}
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.thumbnailRow}>
                      {receipts.map((doc, i) => (
                        <View key={doc.id} style={styles.thumbnailContainer}>
                          <Image
                            source={{ uri: doc.uri }}
                            style={styles.thumbnail}
                            contentFit="cover"
                          />
                          <View style={styles.orderBadge}>
                            <Text style={styles.orderBadgeText}>{i + 1}</Text>
                          </View>
                          <Pressable
                            style={styles.removeBtn}
                            onPress={() => handleRemove(doc.id)}
                          >
                            <Ionicons name="close-circle" size={22} color={Colors.danger} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ) : null}

              <Pressable
                onPress={handleScanReceipt}
                style={({ pressed }) => [
                  styles.scanButton,
                  pressed && styles.scanButtonPressed,
                ]}
              >
                <Ionicons name="camera" size={20} color={Colors.primary} />
                <Text style={styles.scanButtonText}>
                  {receipts.length > 0 ? "추가 촬영" : "촬영하기"}
                </Text>
              </Pressable>

              {receipts.length > 0 ? (
                <View style={styles.receiptNote}>
                  <Ionicons name="information-circle" size={16} color={Colors.textSecondary} />
                  <Text style={styles.receiptNoteText}>
                    긴 영수증은 여러 장으로 나눠서 겹치게 촬영해주세요.
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        }
        contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
      />

      <View style={[styles.bottomBar, { paddingBottom: bottomPad + 16 }]}>
        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.nextButton,
            !canProceed && styles.nextButtonDisabled,
            pressed && canProceed && styles.nextButtonPressed,
          ]}
          disabled={!canProceed}
        >
          <Text
            style={[
              styles.nextButtonText,
              !canProceed && styles.nextButtonTextDisabled,
            ]}
          >
            확인 및 접수
          </Text>
          <Ionicons
            name="arrow-forward"
            size={20}
            color={canProceed ? Colors.white : Colors.textLight}
          />
        </Pressable>
      </View>
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
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.text },
  progress: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingVertical: 8,
    gap: 4,
  },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.border },
  progressActive: { backgroundColor: Colors.primary, width: 12, height: 12, borderRadius: 6 },
  progressDone: { backgroundColor: Colors.success },
  progressLine: { flex: 1, height: 2, backgroundColor: Colors.border },
  progressLineDone: { backgroundColor: Colors.success },
  content: { paddingHorizontal: 24, paddingTop: 16 },
  docSection: { gap: 12 },
  docHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  docTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  docTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.text },
  docRequirement: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  thumbnailRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  thumbnailContainer: { position: "relative" },
  thumbnail: { width: 80, height: 106, borderRadius: 8, backgroundColor: Colors.surfaceAlt },
  removeBtn: { position: "absolute", top: -6, right: -6, backgroundColor: Colors.white, borderRadius: 11 },
  orderBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  orderBadgeText: { fontSize: 11, color: Colors.white, fontFamily: "Inter_600SemiBold" },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 12,
    borderStyle: "dashed",
  },
  scanButtonDone: { borderColor: Colors.success, borderStyle: "solid" },
  scanButtonPressed: { opacity: 0.7 },
  scanButtonText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  scanButtonTextDone: { color: Colors.success },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 24 },
  receiptGroupsContainer: { gap: 12 },
  receiptGroup: {
    gap: 6,
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 10,
  },
  receiptGroupLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  receiptNote: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 10,
  },
  receiptNoteText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
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
  nextButton: {
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  nextButtonDisabled: { backgroundColor: Colors.surfaceAlt },
  nextButtonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  nextButtonText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.white },
  nextButtonTextDisabled: { color: Colors.textLight },
});
