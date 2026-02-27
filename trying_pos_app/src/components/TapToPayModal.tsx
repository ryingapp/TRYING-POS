/**
 * TapToPayModal — Visual NFC tap-to-pay overlay.
 *
 * Shows a "tap your card" animation.  In demo mode the animation runs
 * for ~2.5 seconds and then resolves; in real mode the SDK controls
 * the flow via EdfaPayPlugin.purchase().
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { edfaPaySoftPos } from '../services/edfapay-softpos';
import { COLORS, SPACING, RADIUS } from '../config/theme';

interface TapToPayModalProps {
  visible: boolean;
  amount: string;          // e.g. "25.50"
  orderId?: string;        // pass to SDK for tracking
  onSuccess: (tx: any) => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}

export default function TapToPayModal({
  visible,
  amount,
  orderId,
  onSuccess,
  onCancel,
  onError,
}: TapToPayModalProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [status, setStatus] = useState<'waiting' | 'processing' | 'done' | 'error'>('waiting');
  const processingRef = useRef(false);

  // Pulse animation
  useEffect(() => {
    if (!visible) return;
    setStatus('waiting');
    processingRef.current = false;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  // Trigger payment after short delay
  useEffect(() => {
    if (!visible || processingRef.current) return;
    processingRef.current = true;

    const timeout = setTimeout(async () => {
      setStatus('processing');
      try {
        const result = await edfaPaySoftPos.purchase(amount, orderId);
        if (result.success) {
          setStatus('done');
          setTimeout(() => onSuccess(result.transaction), 600);
        } else if (result.cancelledByUser) {
          onCancel();
        } else {
          setStatus('error');
          onError(result.error || 'فشلت العملية');
        }
      } catch (e: any) {
        setStatus('error');
        onError(e?.message || 'خطأ غير متوقع');
      }
    }, edfaPaySoftPos.isDemoMode() ? 2500 : 500);

    return () => clearTimeout(timeout);
  }, [visible]);

  const isDemo = edfaPaySoftPos.isDemoMode();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={s.overlay}>
        <View style={s.card}>
          {isDemo && <Text style={s.demoBadge}>وضع تجريبي</Text>}

          <Animated.View
            style={[
              s.nfcCircle,
              status === 'done' && s.nfcCircleSuccess,
              status === 'error' && s.nfcCircleError,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <Text style={s.nfcIcon}>
              {status === 'done' ? '✓' : status === 'error' ? '✕' : '•••'}
            </Text>
          </Animated.View>

          <Text style={s.title}>
            {status === 'done'
              ? 'تمت العملية بنجاح!'
              : status === 'error'
              ? 'فشلت العملية'
              : status === 'processing'
              ? 'جارٍ المعالجة...'
              : 'قرّب البطاقة من الجهاز'}
          </Text>

          <Text style={s.amount}>{amount} ر.س</Text>

          {status !== 'done' && (
            <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
              <Text style={s.cancelText}>إلغاء</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: '85%',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  demoBadge: {
    position: 'absolute',
    top: 12,
    left: 16,
    backgroundColor: '#fbbf24',
    color: '#78350f',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  nfcCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.successLight || '#0d2818',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  nfcCircleSuccess: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  nfcCircleError: {
    backgroundColor: COLORS.errorLight || '#3b1111',
    borderColor: COLORS.error,
  },
  nfcIcon: {
    fontSize: 48,
    color: COLORS.text,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  amount: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 24,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.errorLight || '#3b1111',
  },
  cancelText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: '600',
  },
});
