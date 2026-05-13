import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useSubmission } from "@/contexts/SubmissionContext";

export default function CompleteScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { clearAll } = useSubmission();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleDone = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearAll();
    router.replace("/");
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: topPad + 40, paddingBottom: bottomPad + 16 },
      ]}
    >
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.iconCircle,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Ionicons name="checkmark" size={56} color={Colors.white} />
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim, alignItems: "center", gap: 8 }}>
          <Text style={styles.title}>접수 완료</Text>
          <Text style={styles.subtitle}>
            문서가 성공적으로 접수되었습니다.{"\n"}
            처리 결과는 관리자 페이지에서 확인하실 수 있습니다.
          </Text>
        </Animated.View>

        <Animated.View
          style={[styles.infoBox, { opacity: fadeAnim }]}
        >
          <View style={styles.infoItem}>
            <Ionicons name="time" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>접수 확인까지 1-2 영업일 소요</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="notifications" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>처리 완료 시 알림 발송</Text>
          </View>
        </Animated.View>
      </View>

      <Pressable
        onPress={handleDone}
        style={({ pressed }) => [
          styles.doneButton,
          pressed && styles.doneButtonPressed,
        ]}
      >
        <Text style={styles.doneButtonText}>확인</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  infoBox: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 16,
    width: "100%",
    maxWidth: 320,
    marginTop: 16,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  doneButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  doneButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  doneButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
});
