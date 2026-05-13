import React, { createContext, useContext, useState, useMemo, useCallback, ReactNode } from "react";

export interface ScannedDoc {
  id: string;
  uri: string;
  documentType: "family_certificate" | "receipt";
  imageOrder: number;
  receiptGroupId?: string;
  partNumber?: number;
  fileName?: string;
  uploadUrl?: string;
}

interface UserInfo {
  name: string;
  phone: string;
  address: string;
  addressDetail: string;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
}

interface SubmissionContextValue {
  userInfo: UserInfo;
  setUserInfo: (info: UserInfo) => void;
  scannedDocs: ScannedDoc[];
  addScannedDoc: (doc: ScannedDoc) => void;
  removeScannedDoc: (id: string) => void;
  updateScannedDoc: (id: string, updates: Partial<ScannedDoc>) => void;
  clearAll: () => void;
  currentScanType: "family_certificate" | "receipt";
  setCurrentScanType: (type: "family_certificate" | "receipt") => void;
  currentReceiptGroupId: string | null;
  startNewReceiptGroup: () => string;
  getReceiptGroupNumber: (groupId: string) => number;
  getNextPartNumber: (groupId: string) => number;
}

const defaultUserInfo: UserInfo = {
  name: "",
  phone: "",
  address: "",
  addressDetail: "",
  bankName: "",
  bankAccount: "",
  bankHolder: "",
};

const SubmissionContext = createContext<SubmissionContextValue | null>(null);

export function SubmissionProvider({ children }: { children: ReactNode }) {
  const [userInfo, setUserInfo] = useState<UserInfo>(defaultUserInfo);
  const [scannedDocs, setScannedDocs] = useState<ScannedDoc[]>([]);
  const [currentScanType, setCurrentScanType] = useState<"family_certificate" | "receipt">("family_certificate");
  const [currentReceiptGroupId, setCurrentReceiptGroupId] = useState<string | null>(null);

  const addScannedDoc = (doc: ScannedDoc) => {
    setScannedDocs((prev) => [...prev, doc]);
  };

  const removeScannedDoc = (id: string) => {
    setScannedDocs((prev) => prev.filter((d) => d.id !== id));
  };

  const updateScannedDoc = (id: string, updates: Partial<ScannedDoc>) => {
    setScannedDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
  };

  const clearAll = () => {
    setUserInfo(defaultUserInfo);
    setScannedDocs([]);
    setCurrentScanType("family_certificate");
    setCurrentReceiptGroupId(null);
  };

  const startNewReceiptGroup = useCallback(() => {
    const groupId = "rg_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    setCurrentReceiptGroupId(groupId);
    return groupId;
  }, []);

  const getReceiptGroupNumber = useCallback((groupId: string) => {
    const allGroupIds = [...new Set(
      scannedDocs
        .filter(d => d.documentType === "receipt" && d.receiptGroupId)
        .map(d => d.receiptGroupId!)
    )];
    const idx = allGroupIds.indexOf(groupId);
    return idx >= 0 ? idx + 1 : allGroupIds.length + 1;
  }, [scannedDocs]);

  const getNextPartNumber = useCallback((groupId: string) => {
    const groupDocs = scannedDocs.filter(
      d => d.documentType === "receipt" && d.receiptGroupId === groupId
    );
    return groupDocs.length + 1;
  }, [scannedDocs]);

  const value = useMemo(
    () => ({
      userInfo,
      setUserInfo,
      scannedDocs,
      addScannedDoc,
      removeScannedDoc,
      updateScannedDoc,
      clearAll,
      currentScanType,
      setCurrentScanType,
      currentReceiptGroupId,
      startNewReceiptGroup,
      getReceiptGroupNumber,
      getNextPartNumber,
    }),
    [userInfo, scannedDocs, currentScanType, currentReceiptGroupId, startNewReceiptGroup, getReceiptGroupNumber, getNextPartNumber]
  );

  return (
    <SubmissionContext.Provider value={value}>
      {children}
    </SubmissionContext.Provider>
  );
}

export function useSubmission() {
  const context = useContext(SubmissionContext);
  if (!context) {
    throw new Error("useSubmission must be used within a SubmissionProvider");
  }
  return context;
}
