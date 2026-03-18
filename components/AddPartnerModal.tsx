import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { useCandle } from '@/contexts/CandleContext';
import { Colors, Spacing } from '@/constants/theme';

type Tab = 'generate' | 'scan';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function AddPartnerModal({ visible, onClose }: Props) {
  const { partnership, pairCode, generatePairCode, joinWithCode } = useCandle();
  const [activeTab, setActiveTab] = useState<Tab>('generate');
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Use existing code if we already generated one, otherwise null
  const existingCode = pairCode || partnership?.pair_code || null;
  const isWaiting = !!partnership && !partnership.user2_id;

  const handleGenerateCode = async () => {
    setLoading(true);
    await generatePairCode();
    setLoading(false);
  };

  const handleCopy = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied!', 'Pair code copied to clipboard');
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);

    const code = data.trim().toUpperCase();
    const { error } = await joinWithCode(code);
    setLoading(false);

    if (error) {
      Alert.alert('Error', error, [{ text: 'Try Again', onPress: () => setScanned(false) }]);
    } else {
      Alert.alert('Paired!', "You're now connected with your partner 🕯️", [
        { text: 'OK', onPress: onClose },
      ]);
    }
  };

  const handleClose = () => {
    setScanned(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Add Partner</Text>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.warmWhite} />
          </Pressable>
        </View>

        {/* Tab toggle */}
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, activeTab === 'generate' && styles.tabActive]}
            onPress={() => setActiveTab('generate')}
          >
            <Text style={[styles.tabText, activeTab === 'generate' && styles.tabTextActive]}>
              Get a Code
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'scan' && styles.tabActive]}
            onPress={() => setActiveTab('scan')}
          >
            <Text style={[styles.tabText, activeTab === 'scan' && styles.tabTextActive]}>
              Scan QR
            </Text>
          </Pressable>
        </View>

        {/* Tab content */}
        {activeTab === 'generate' ? (
          <GenerateTab
            existingCode={existingCode}
            isWaiting={isWaiting}
            loading={loading}
            onGenerate={handleGenerateCode}
            onCopy={handleCopy}
          />
        ) : (
          <ScanTab
            permission={cameraPermission}
            onRequestPermission={requestCameraPermission}
            scanned={scanned}
            loading={loading}
            onScanned={handleBarcodeScanned}
            onReset={() => setScanned(false)}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Generate Code Tab
// ─────────────────────────────────────────────

type GenerateTabProps = {
  existingCode: string | null;
  isWaiting: boolean;
  loading: boolean;
  onGenerate: () => void;
  onCopy: (code: string) => void;
};

function GenerateTab({ existingCode, isWaiting, loading, onGenerate, onCopy }: GenerateTabProps) {
  if (!existingCode) {
    return (
      <View style={styles.tabContent}>
        <Text style={styles.description}>
          Generate a code and share it with your partner. They'll use it to connect with you.
        </Text>
        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onGenerate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Generate Code</Text>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <Text style={styles.description}>
        {isWaiting
          ? 'Waiting for your partner to scan or enter this code...'
          : 'Share this with your partner to connect.'}
      </Text>

      {/* QR Code */}
      <View style={styles.qrContainer}>
        <QRCode
          value={existingCode}
          size={200}
          color={Colors.warmWhite}
          backgroundColor={Colors.surface}
        />
      </View>

      {/* Text code + copy */}
      <View style={styles.codeRow}>
        <Text style={styles.codeText}>{existingCode}</Text>
        <Pressable onPress={() => onCopy(existingCode)} style={styles.copyButton}>
          <Ionicons name="copy-outline" size={22} color={Colors.flame} />
        </Pressable>
      </View>

      <Text style={styles.hint}>Your partner can scan the QR code or enter the text code manually.</Text>
    </View>
  );
}

// ─────────────────────────────────────────────
// Scan QR Tab
// ─────────────────────────────────────────────

type ScanTabProps = {
  permission: { granted: boolean } | null;
  onRequestPermission: () => void;
  scanned: boolean;
  loading: boolean;
  onScanned: (data: { data: string }) => void;
  onReset: () => void;
};

function ScanTab({ permission, onRequestPermission, scanned, loading, onScanned, onReset }: ScanTabProps) {
  if (!permission?.granted) {
    return (
      <View style={styles.tabContent}>
        <Ionicons name="camera-outline" size={64} color={Colors.warmGray} style={styles.permissionIcon} />
        <Text style={styles.description}>Camera access is needed to scan your partner's QR code.</Text>
        <Pressable style={styles.button} onPress={onRequestPermission}>
          <Text style={styles.buttonText}>Allow Camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.scanContainer}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : onScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Viewfinder overlay */}
      <View style={styles.viewfinder} />

      <Text style={styles.scanHint}>Point your camera at your partner's QR code</Text>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.flame} />
        </View>
      )}

      {scanned && !loading && (
        <View style={styles.scannedOverlay}>
          <Pressable style={styles.button} onPress={onReset}>
            <Text style={styles.buttonText}>Scan Again</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.warmWhite,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  tabs: {
    flexDirection: 'row',
    margin: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: Colors.flame,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.warmGray,
  },
  tabTextActive: {
    color: '#fff',
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    paddingTop: Spacing.xl,
  },
  description: {
    fontSize: 16,
    color: Colors.warmGray,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  button: {
    backgroundColor: Colors.flame,
    borderRadius: 14,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    minWidth: 180,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  qrContainer: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  codeText: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.flame,
    letterSpacing: 6,
  },
  copyButton: {
    padding: Spacing.sm,
  },
  hint: {
    fontSize: 13,
    color: Colors.coolGray,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Scan tab
  scanContainer: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: Spacing.xl,
  },
  viewfinder: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: Colors.flame,
    borderRadius: 16,
    top: '50%',
    marginTop: -110,
  },
  scanHint: {
    color: Colors.warmWhite,
    fontSize: 15,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    overflow: 'hidden',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannedOverlay: {
    position: 'absolute',
    bottom: Spacing.xl,
  },
  permissionIcon: {
    marginBottom: Spacing.lg,
  },
  warmGray: Colors.warmGray,
});
