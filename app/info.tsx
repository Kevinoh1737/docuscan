import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  Platform,
  Alert,
  ScrollView,
  Modal,
  FlatList,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useSubmission } from "@/contexts/SubmissionContext";
import DaumPostcode from "@/components/DaumPostcode";

export default function InfoScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { userInfo, setUserInfo } = useSubmission();

  const [name, setName] = useState(userInfo.name);
  const [phone, setPhone] = useState(userInfo.phone);
  const [address, setAddress] = useState(userInfo.address);
  const [addressDetail, setAddressDetail] = useState(userInfo.addressDetail);
  const [bankName, setBankName] = useState(userInfo.bankName);
  const [bankAccount, setBankAccount] = useState(userInfo.bankAccount);
  const [bankHolder, setBankHolder] = useState(userInfo.bankHolder);
  const [showPostcode, setShowPostcode] = useState(false);
  const [showBankPicker, setShowBankPicker] = useState(false);

  const BANK_LIST = [
    "국민은행", "신한은행", "하나은행", "우리은행", "농협은행",
    "기업은행", "SC제일은행", "씨티은행", "카카오뱅크", "토스뱅크",
    "케이뱅크", "새마을금고", "우체국", "수협은행",
    "대구은행", "부산은행", "광주은행", "경남은행", "전북은행", "제주은행",
  ];

  const formatPhone = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 7)
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}`;
  };

  const handlePhoneChange = (text: string) => {
    setPhone(formatPhone(text));
  };

  const isValid = name.trim().length > 0 && phone.replace(/\D/g, "").length >= 10 && address.trim().length > 0;

  const handleNext = async () => {
    if (!isValid) {
      Alert.alert("입력 오류", "모든 필수 항목을 입력해주세요.");
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUserInfo({
      name: name.trim(),
      phone,
      address: address.trim(),
      addressDetail: addressDetail.trim(),
      bankName: bankName.trim(),
      bankAccount: bankAccount.trim(),
      bankHolder: bankHolder.trim(),
      kakaoId: userInfo.kakaoId,
    });
    router.push("/scan-select");
  };

  const handleAddressPress = async () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {};
    setShowPostcode(true);
  };

  const processAddressResult = (data: {
    zonecode: string;
    address: string;
    roadAddress: string;
    jibunAddress: string;
    buildingName: string;
    sido: string;
    sigungu: string;
  }) => {
    const fullAddress = data.roadAddress || data.address;
    const isPaju =
      data.sigungu === "파주시" ||
      data.sigungu.includes("파주시") ||
      fullAddress.includes("파주시");

    if (!isPaju) {
      Alert.alert(
        "지역 제한 안내",
        "현재 파주시 지역만 신청 가능합니다.\n다른 지역은 추후 확대 예정입니다.",
        [{ text: "확인" }]
      );
      return;
    }

    const displayAddress = data.buildingName
      ? `[${data.zonecode}] ${fullAddress} (${data.buildingName})`
      : `[${data.zonecode}] ${fullAddress}`;
    setAddress(displayAddress);
  };

  const handlePostcodeSelect = (data: {
    zonecode: string;
    address: string;
    roadAddress: string;
    jibunAddress: string;
    buildingName: string;
    sido: string;
    sigungu: string;
  }) => {
    setShowPostcode(false);
    processAddressResult(data);
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>개인정보 입력</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.progress}>
        <View style={[styles.progressDot, styles.progressActive]} />
        <View style={styles.progressLine} />
        <View style={styles.progressDot} />
        <View style={styles.progressLine} />
        <View style={styles.progressDot} />
        <View style={styles.progressLine} />
        <View style={styles.progressDot} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.form, { paddingBottom: bottomPad + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.noticeBox}>
          <Ionicons name="alert-circle" size={18} color="#e67e22" />
          <Text style={styles.noticeText}>
            이름과 전화번호, 은행 계좌정보가 정확하지 않을 경우 환급이 지연되거나 확인이 불가능 할 수 있습니다.
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>이름 <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="실명을 입력하세요"
            placeholderTextColor={Colors.textLight}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>전화번호 <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={handlePhoneChange}
            placeholder="010-1234-5678"
            placeholderTextColor={Colors.textLight}
            keyboardType="phone-pad"
            maxLength={13}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>주소 <Text style={styles.required}>*</Text></Text>
          <Pressable
            onPress={handleAddressPress}
            style={({ pressed }) => [
              styles.addressButton,
              pressed && styles.addressButtonPressed,
            ]}
          >
            {address ? (
              <Text style={styles.addressText} numberOfLines={2}>{address}</Text>
            ) : (
              <Text style={styles.addressPlaceholder}>터치하여 주소 검색</Text>
            )}
            <Ionicons name="search" size={18} color={Colors.textSecondary} />
          </Pressable>
          <View style={styles.regionNotice}>
            <Ionicons name="location" size={14} color={Colors.primary} />
            <Text style={styles.regionNoticeText}>파주시 이외 지역의 경우 신청이 불가능합니다. 가족증명서의 주소와 동일해야 합니다.</Text>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>상세주소</Text>
          <TextInput
            style={styles.input}
            value={addressDetail}
            onChangeText={setAddressDetail}
            placeholder="상세주소 입력 (선택)"
            placeholderTextColor={Colors.textLight}
          />
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>환급 계좌 정보</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>은행명</Text>
          <Pressable
            onPress={() => setShowBankPicker(true)}
            style={({ pressed }) => [
              styles.addressButton,
              pressed && styles.addressButtonPressed,
            ]}
          >
            {bankName ? (
              <Text style={styles.addressText}>{bankName}</Text>
            ) : (
              <Text style={styles.addressPlaceholder}>은행을 선택하세요</Text>
            )}
            <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>계좌번호</Text>
          <TextInput
            style={styles.input}
            value={bankAccount}
            onChangeText={setBankAccount}
            placeholder="계좌번호 입력 (- 없이)"
            placeholderTextColor={Colors.textLight}
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>예금주</Text>
          <TextInput
            style={styles.input}
            value={bankHolder}
            onChangeText={setBankHolder}
            placeholder="예금주 이름 입력"
            placeholderTextColor={Colors.textLight}
          />
          <View style={styles.regionNotice}>
            <Ionicons name="information-circle" size={14} color={Colors.primary} />
            <Text style={styles.regionNoticeText}>가족증명서에 있는 이름 중 1명으로 입력</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: bottomPad + 16 }]}>
        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.nextButton,
            !isValid && styles.nextButtonDisabled,
            pressed && isValid && styles.nextButtonPressed,
          ]}
          disabled={!isValid}
        >
          <Text style={[styles.nextButtonText, !isValid && styles.nextButtonTextDisabled]}>
            다음
          </Text>
          <Ionicons
            name="arrow-forward"
            size={20}
            color={isValid ? Colors.white : Colors.textLight}
          />
        </Pressable>
      </View>

      <DaumPostcode
        visible={showPostcode}
        onClose={() => setShowPostcode(false)}
        onSelect={handlePostcodeSelect}
      />

      <Modal
        visible={showBankPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBankPicker(false)}
      >
        <Pressable
          style={styles.bankModalOverlay}
          onPress={() => setShowBankPicker(false)}
        >
          <Pressable style={styles.bankModalContent} onPress={() => {}}>
            <View style={styles.bankModalHeader}>
              <Text style={styles.bankModalTitle}>은행 선택</Text>
              <Pressable onPress={() => setShowBankPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>
            <FlatList
              data={BANK_LIST}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setBankName(item);
                    setShowBankPicker(false);
                  }}
                  style={({ pressed }) => [
                    styles.bankItem,
                    pressed && { backgroundColor: Colors.surfaceAlt },
                    bankName === item && styles.bankItemSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.bankItemText,
                      bankName === item && styles.bankItemTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                  {bankName === item ? (
                    <Ionicons name="checkmark" size={20} color={Colors.primary} />
                  ) : null}
                </Pressable>
              )}
              showsVerticalScrollIndicator={false}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border,
  },
  scrollView: {
    flex: 1,
  },
  form: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 20,
  },
  noticeBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#fef9ee",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#f5e6c8",
    alignItems: "flex-start",
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#92650a",
    lineHeight: 19,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  sectionLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: -4,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  required: {
    color: Colors.danger,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  addressButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 50,
  },
  addressButtonPressed: {
    backgroundColor: Colors.surfaceAlt,
  },
  addressText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  addressPlaceholder: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.textLight,
  },
  regionNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  regionNoticeText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
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
  nextButtonDisabled: {
    backgroundColor: Colors.surfaceAlt,
  },
  nextButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  nextButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  nextButtonTextDisabled: {
    color: Colors.textLight,
  },
  bankModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  bankModalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "60%",
    paddingBottom: Platform.OS === "web" ? 34 : 0,
  },
  bankModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  bankModalTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  bankItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  bankItemSelected: {
    backgroundColor: Colors.surfaceAlt,
  },
  bankItemText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  bankItemTextSelected: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
});
