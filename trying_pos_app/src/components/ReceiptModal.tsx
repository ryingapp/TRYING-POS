import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  InteractionManager,
  Share,
  Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Print from 'expo-print';
import { api } from '../services/api';
import { COLORS, SPACING, RADIUS, FONTS } from '../config/theme';

interface ReceiptModalProps {
  visible: boolean;
  onClose: () => void;
  orderId?: string;
  invoiceId?: string;
  autoPrint?: boolean;
  /** Pass a local order object directly for offline receipt (no API call needed) */
  localOrder?: any;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'نقدي / Cash',
  card: 'بطاقة / Card',
  mada: 'مدى / Mada',
  stc_pay: 'STC Pay',
  apple_pay: 'Apple Pay',
  split: 'تقسيم / Split',
  bank_transfer: 'تحويل بنكي / Bank Transfer',
};

const ORDER_TYPE_AR: Record<string, string> = {
  dine_in: 'داخل المطعم',
  delivery: 'توصيل',
  pickup: 'استلام',
  takeout: 'سفري',
};
const ORDER_TYPE_EN: Record<string, string> = {
  dine_in: 'Dine In',
  delivery: 'Delivery',
  pickup: 'Pickup',
  takeout: 'Takeout',
};

export default function ReceiptModal({ visible, onClose, orderId, invoiceId, autoPrint, localOrder }: ReceiptModalProps) {
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [didAutoPrint, setDidAutoPrint] = useState(false);
  const [printing, setPrinting] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (visible && localOrder) {
      // Build a local invoice from the order data — no API needed
      const localInvoice = buildLocalInvoice(localOrder);
      setInvoice(localInvoice);
      setLoading(false);
      setError('');
    } else if (visible && (orderId || invoiceId)) {
      loadInvoice();
    }
    if (!visible) {
      setInvoice(null);
      setError('');
      setDidAutoPrint(false);
      setPrinting(false);
    }
  }, [visible, orderId, invoiceId, localOrder]);

  // Auto-print when invoice loads (safe with InteractionManager + try/catch)
  useEffect(() => {
    if (autoPrint && invoice && !didAutoPrint && !loading && !error && !printing) {
      setDidAutoPrint(true);
      let cancelled = false;
      const timer = setTimeout(() => {
        if (cancelled || !isMounted.current) return;
        // Wait for modal animation to fully settle before printing
        InteractionManager.runAfterInteractions(async () => {
          if (cancelled || !isMounted.current) return;
          try {
            await doPrint();
          } catch (e) {
            console.log('Auto-print failed:', e);
          }
        });
      }, 800);
      return () => { cancelled = true; clearTimeout(timer); };
    }
  }, [autoPrint, invoice, didAutoPrint, loading, error, printing]);

  /** Build a local invoice object from order data for offline printing */
  const buildLocalInvoice = (order: any) => {
    const sub = parseFloat(order.subtotal || '0');
    const disc = parseFloat(order.discount || '0');
    const del = parseFloat(order.deliveryFee || '0');
    const taxAmt = parseFloat(order.tax || '0');
    const tot = parseFloat(order.total || '0');
    return {
      invoiceNumber: 'LOCAL-' + (order.orderNumber || Date.now().toString().slice(-6)),
      invoiceCounter: order.orderNumber || '—',
      issuedAt: order.createdAt || new Date().toISOString(),
      createdAt: order.createdAt || new Date().toISOString(),
      subtotal: sub.toFixed(2),
      discount: disc.toFixed(2),
      deliveryFee: del.toFixed(2),
      taxRate: '15',
      taxAmount: taxAmt.toFixed(2),
      total: tot.toFixed(2),
      paymentMethod: order.paymentMethod || 'cash',
      isPaid: order.isPaid,
      customerName: order.customerName || null,
      customerPhone: order.customerPhone || null,
      restaurant: order._restaurant || null,
      order: {
        orderNumber: order.orderNumber,
        orderType: order.orderType || 'dine_in',
        notes: order.notes || null,
        items: (order.items || []).map((it: any) => ({
          id: it.menuItemId || it.id,
          quantity: it.quantity || 1,
          totalPrice: it.totalPrice || (parseFloat(it.unitPrice || it.price || '0') * (it.quantity || 1)).toFixed(2),
          itemName: it.itemName || it.nameAr || it.nameEn || '',
          notes: it.notes || null,
          menuItem: {
            nameEn: it.nameEn || it.itemName || '',
            nameAr: it.nameAr || it.itemName || '',
          },
        })),
      },
    };
  };

  const loadInvoice = async () => {
    setLoading(true);
    setError('');
    try {
      let data;
      if (orderId) {
        data = await api.getInvoiceByOrder(orderId);
      } else if (invoiceId) {
        data = await api.getInvoice(invoiceId);
      }
      if (isMounted.current) {
        setInvoice(data);
      }
    } catch (err: any) {
      if (isMounted.current) {
        setError(err.message || 'فشل في تحميل الفاتورة');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '';
    return new Date(date).toLocaleString('en-SA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const getPaymentLabel = (method: string | null) => {
    if (!method) return '';
    return PAYMENT_LABELS[method] || method;
  };

  const getItemCount = () => {
    return invoice?.order?.items?.reduce(
      (sum: number, item: any) => sum + (item.quantity || 1),
      0
    ) || 0;
  };

  const getRestaurantAddress = () => {
    const r = invoice?.restaurant;
    if (!r) return '';
    const parts = [];
    if (r.city) parts.push(r.city);
    if (r.streetName) parts.push(r.streetName);
    if (r.district) parts.push(r.district);
    if (parts.length === 0 && r.address) return r.address;
    return parts.join(' - ');
  };

  const getExternalOrderInfo = () => {
    if (invoice?.order?.orderType !== 'delivery' || !invoice?.order?.notes) return null;
    const notes = invoice.order.notes;
    const match = notes.match(/\[(HUNGERSTATION|JAHEZ)\]\s*(.*)/i);
    if (match) return { platform: match[1], orderNumber: match[2] };
    return { platform: null, orderNumber: notes };
  };

  const handleShare = async () => {
    if (!invoice) return;
    const items = invoice.order?.items?.map(
      (item: any) => `  ${item.quantity}x ${item.menuItem?.nameEn || item.itemName} = ${item.totalPrice} ر.س`
    ).join('\n') || '';

    const text = `فاتورة #${invoice.invoiceNumber}\nالطلب #${invoice.order?.orderNumber || ''}\n\n${items}\n\nالإجمالي: ${invoice.total} ر.س\nشكراً لزيارتكم - ${invoice.restaurant?.nameAr || ''}`;

    try {
      await Share.share({ message: text });
    } catch {}
  };

  // Core print logic — separated so auto-print and manual print both use it
  const doPrint = useCallback(async () => {
    if (!invoice || printing) return;
    setPrinting(true);
    try {
      await _printInvoice(invoice);
    } catch (err: any) {
      if (isMounted.current) {
        Alert.alert('خطأ في الطباعة', err.message || 'فشل في الطباعة');
      }
    } finally {
      if (isMounted.current) setPrinting(false);
    }
  }, [invoice, printing]);

  const handlePrint = () => doPrint();

  const _printInvoice = async (inv: any) => {
    const restaurantName = inv.restaurant?.nameAr || inv.restaurant?.nameEn || '';
    const restaurantNameEn = inv.restaurant?.nameEn || '';
    const address = getRestaurantAddress();
    const vatNumber = inv.restaurant?.vatNumber || '';
    const crNumber = inv.restaurant?.commercialRegistration || '';
    const phone = inv.restaurant?.phone || '';

    const itemsHtml = (inv.order?.items || []).map((item: any) => {
      const nameEn = item.menuItem?.nameEn || item.itemName || '';
      const nameAr = item.menuItem?.nameAr || '';
      return `
        <tr>
          <td style="text-align:center;padding:4px 2px;">${item.quantity}</td>
          <td style="padding:4px 2px;text-align:right;">
            <div style="font-weight:bold;">${nameEn}</div>
            ${nameAr && nameAr !== nameEn ? `<div style="font-size:10px;color:#555;">${nameAr}</div>` : ''}
            ${item.notes ? `<div style="font-size:9px;color:#888;">${item.notes}</div>` : ''}
          </td>
          <td style="text-align:left;padding:4px 2px;font-weight:bold;">${item.totalPrice} ر.س</td>
        </tr>
      `;
    }).join('');

    const orderTypeAr = inv.order?.orderType ? (ORDER_TYPE_AR[inv.order.orderType] || inv.order.orderType) : '';
    const paymentLabel = inv.paymentMethod ? getPaymentLabel(inv.paymentMethod) : '';

    const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @page { margin: 5mm; size: 80mm auto; }
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          color: #000;
          max-width: 72mm;
          margin: 0 auto;
          padding: 4px;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .solid-divider { border-top: 2px solid #000; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; }
        .total-row { display: flex; justify-content: space-between; margin: 2px 0; }
        .grand-total { font-size: 16px; font-weight: bold; }
        .order-box { border: 2px solid #000; text-align: center; padding: 6px; margin: 6px 0; font-size: 16px; font-weight: bold; }
      </style>
    </head>
    <body>
      <!-- Restaurant Info -->
      <div class="center">
        <div style="font-size:16px;font-weight:bold;">${restaurantName}</div>
        ${restaurantNameEn ? `<div style="font-size:13px;font-weight:bold;color:#333;">${restaurantNameEn}</div>` : ''}
        ${address ? `<div style="font-size:10px;color:#333;">${address}</div>` : ''}
        ${vatNumber ? `<div style="font-size:10px;">الرقم الضريبي / VAT: ${vatNumber}</div>` : ''}
        ${crNumber ? `<div style="font-size:10px;">س.ت / CR: ${crNumber}</div>` : ''}
        ${phone ? `<div style="font-size:10px;">خدمة العملاء: ${phone}</div>` : ''}
      </div>

      <div class="divider"></div>

      <div class="center">
        <div class="bold">فاتورة ضريبية مبسطة</div>
        <div style="font-size:11px;">Simplified Tax Invoice</div>
      </div>

      <div class="divider"></div>

      <div class="order-box">
        الطلب #${inv.order?.orderNumber || inv.invoiceCounter || '—'}
      </div>

      <!-- Invoice Details -->
      <div class="total-row"><span>رقم الفاتورة</span><span class="bold">${inv.invoiceNumber}</span></div>
      <div class="total-row"><span>التاريخ</span><span>${formatDate(inv.issuedAt || inv.createdAt)}</span></div>
      ${orderTypeAr ? `<div style="margin:4px 0;"><span class="bold">${orderTypeAr}</span></div>` : ''}

      <div class="solid-divider"></div>

      <!-- Items -->
      <table>
        <thead>
          <tr style="border-bottom:1px solid #000;">
            <th style="text-align:center;padding:4px 2px;width:30px;">الكمية</th>
            <th style="text-align:right;padding:4px 2px;">المنتج</th>
            <th style="text-align:left;padding:4px 2px;width:70px;">السعر</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="solid-divider"></div>

      <!-- Totals -->
      <div class="total-row"><span>المجموع الفرعي / Subtotal</span><span>${inv.subtotal} ر.س</span></div>
      ${parseFloat(inv.discount || '0') > 0 ? `<div class="total-row" style="color:#16a34a;"><span>الخصم / Discount</span><span>-${inv.discount} ر.س</span></div>` : ''}
      ${parseFloat(inv.deliveryFee || '0') > 0 ? `<div class="total-row"><span>رسوم التوصيل / Delivery</span><span>${inv.deliveryFee} ر.س</span></div>` : ''}
      <div class="total-row"><span>ضريبة القيمة المضافة ${inv.taxRate || '15'}%</span><span>${inv.taxAmount} ر.س</span></div>

      <div class="divider"></div>

      <div class="total-row grand-total"><span>الإجمالي / Total</span><span>${inv.total} ر.س</span></div>

      <div class="divider"></div>

      ${paymentLabel ? `<div class="total-row"><span>الدفع / Payment</span><span class="bold">${paymentLabel}</span></div>` : ''}
      <div style="font-size:11px;margin:4px 0;">عدد المنتجات ${getItemCount()}</div>

      <div class="divider"></div>

      <div class="center" style="margin-top:8px;">
        <div style="font-size:10px;color:#555;">شكراً لزيارتكم | Thank you for your visit</div>
        <div style="font-size:9px;color:#999;margin-top:6px;">Powered by <b>Trying</b></div>
      </div>
    </body>
    </html>
    `;

    await Print.printAsync({ html });
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerBarTitle}>الفاتورة</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handlePrint} style={styles.printBtn}>
              <Text style={styles.printBtnText}>طباعة</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
              <Text style={styles.shareBtnText}>مشاركة</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>جاري تحميل الفاتورة...</Text>
          </View>
        ) : error ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.errorEmoji}>!</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadInvoice}>
              <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : invoice ? (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.receipt}>
              {/* ====== HEADER: Logo + Restaurant Info ====== */}
              <View style={styles.headerSection}>
                {invoice.restaurant?.logo && (
                  <Image
                    source={{ uri: invoice.restaurant.logo }}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                )}
                {invoice.restaurant?.nameAr && (
                  <Text style={styles.restaurantNameAr}>
                    {invoice.restaurant.nameAr}
                  </Text>
                )}
                {invoice.restaurant?.nameEn && (
                  <Text style={styles.restaurantNameEn}>
                    {invoice.restaurant.nameEn}
                  </Text>
                )}
                {getRestaurantAddress() ? (
                  <Text style={styles.restaurantInfo}>{getRestaurantAddress()}</Text>
                ) : null}
                {invoice.restaurant?.vatNumber && (
                  <Text style={styles.restaurantInfo}>
                    الرقم الضريبي / VAT: {invoice.restaurant.vatNumber}
                  </Text>
                )}
                {invoice.restaurant?.commercialRegistration && (
                  <Text style={styles.restaurantInfo}>
                    س.ت / CR: {invoice.restaurant.commercialRegistration}
                  </Text>
                )}
                {invoice.restaurant?.phone && (
                  <Text style={styles.restaurantInfo}>
                    خدمة العملاء / Customer Service: {invoice.restaurant.phone}
                  </Text>
                )}
              </View>

              {/* ====== Dashed Divider ====== */}
              <View style={styles.dashedDivider} />

              {/* ====== TITLE ====== */}
              <View style={styles.titleSection}>
                <Text style={styles.invoiceTitleAr}>فاتورة ضريبية مبسطة</Text>
                <Text style={styles.invoiceTitleEn}>Simplified Tax Invoice</Text>
              </View>

              <View style={styles.dashedDivider} />

              {/* ====== ORDER NUMBER BOX ====== */}
              <View style={styles.orderNumberBox}>
                <Text style={styles.orderNumberText}>
                  الطلب #{invoice.order?.orderNumber || invoice.invoiceCounter || '—'}
                </Text>
              </View>

              {/* ====== Invoice Details ====== */}
              <View style={styles.detailsSection}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>رقم الفاتورة</Text>
                  <Text style={styles.detailValue}>{invoice.invoiceNumber}</Text>
                </View>
                <Text style={styles.detailLabelEn}>Invoice #</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>التاريخ</Text>
                  <Text style={styles.detailValue}>{formatDate(invoice.issuedAt || invoice.createdAt)}</Text>
                </View>
                <Text style={styles.detailLabelEn}>Date</Text>
              </View>

              <View style={styles.dashedDivider} />

              {/* ====== Order Type ====== */}
              {invoice.order?.orderType && (
                <View style={styles.orderTypeSection}>
                  <Text style={styles.orderTypeAr}>
                    {ORDER_TYPE_AR[invoice.order.orderType] || invoice.order.orderType}
                  </Text>
                  <Text style={styles.orderTypeEn}>
                    {ORDER_TYPE_EN[invoice.order.orderType] || invoice.order.orderType}
                  </Text>

                  {/* Customer Info */}
                  {invoice.customerName && (
                    <Text style={styles.customerInfo}>العميل : {invoice.customerName}</Text>
                  )}
                  {invoice.customerPhone && (
                    <Text style={styles.customerInfo}>الجوال : {invoice.customerPhone}</Text>
                  )}

                  {/* External Order */}
                  {getExternalOrderInfo() && (
                    <Text style={styles.customerInfo}>
                      الرقم الخارجي: {getExternalOrderInfo()?.platform ? `${getExternalOrderInfo()?.platform}: ` : ''}
                      {getExternalOrderInfo()?.orderNumber}
                    </Text>
                  )}
                </View>
              )}

              {/* ====== Solid Divider ====== */}
              <View style={styles.solidDivider} />

              {/* ====== ITEMS TABLE ====== */}
              <View style={styles.itemsSection}>
                {/* Header */}
                <View style={styles.itemsHeader}>
                  <Text style={[styles.itemsHeaderText, { width: 35 }]}>الكمية</Text>
                  <Text style={[styles.itemsHeaderText, { flex: 1, textAlign: 'center' }]}>المنتج</Text>
                  <Text style={[styles.itemsHeaderText, { width: 70, textAlign: 'left' }]}>السعر</Text>
                </View>
                <View style={styles.itemsHeaderEn}>
                  <Text style={[styles.itemsHeaderEnText, { width: 35 }]}>Qty</Text>
                  <Text style={[styles.itemsHeaderEnText, { flex: 1, textAlign: 'center' }]}>Item</Text>
                  <Text style={[styles.itemsHeaderEnText, { width: 70, textAlign: 'left' }]}>Price</Text>
                </View>

                <View style={styles.itemsHeaderDivider} />

                {/* Items */}
                {invoice.order?.items?.map((item: any, index: number) => {
                  const nameEn = item.menuItem?.nameEn || item.itemName || '';
                  const nameAr = item.menuItem?.nameAr || '';
                  return (
                    <View key={item.id || index} style={styles.itemRow}>
                      <View style={styles.itemMainRow}>
                        <Text style={styles.itemQty}>{item.quantity}</Text>
                        <Text style={styles.itemName} numberOfLines={2}>{nameEn}</Text>
                        <Text style={styles.itemPrice}>{item.totalPrice} ر.س</Text>
                      </View>
                      {nameAr && nameAr !== nameEn && (
                        <Text style={styles.itemNameAr}>{nameAr}</Text>
                      )}
                      {item.notes && (
                        <Text style={styles.itemNotes}>{item.notes}</Text>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* ====== Solid Divider ====== */}
              <View style={styles.solidDivider} />

              {/* ====== TOTALS ====== */}
              <View style={styles.totalsSection}>
                {/* Subtotal */}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>المجموع الفرعي</Text>
                  <Text style={styles.totalValue}>{invoice.subtotal} ر.س</Text>
                </View>
                <Text style={styles.totalLabelEn}>Subtotal</Text>

                {/* Discount */}
                {parseFloat(invoice.discount || '0') > 0 && (
                  <>
                    <View style={styles.totalRow}>
                      <Text style={[styles.totalLabel, { color: '#16a34a' }]}>الخصم</Text>
                      <Text style={[styles.totalValue, { color: '#16a34a' }]}>-{invoice.discount} ر.س</Text>
                    </View>
                    <Text style={[styles.totalLabelEn, { color: '#16a34a' }]}>Discount</Text>
                  </>
                )}

                {/* Delivery Fee */}
                {parseFloat(invoice.deliveryFee || '0') > 0 && (
                  <>
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>رسوم التوصيل</Text>
                      <Text style={styles.totalValue}>{invoice.deliveryFee} ر.س</Text>
                    </View>
                    <Text style={styles.totalLabelEn}>Delivery Fee</Text>
                  </>
                )}

                {/* VAT */}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    VAT {invoice.taxRate || '15'}%({invoice.taxRate || '15'}.0%)
                  </Text>
                  <Text style={styles.totalValue}>{invoice.taxAmount} ر.س</Text>
                </View>
                <Text style={styles.totalLabelEn}>
                  ({invoice.taxRate || '15'}.0%) ضريبة القيمة المضافة {invoice.taxRate || '15'}%
                </Text>

                <View style={styles.dashedDivider} />

                {/* Grand Total */}
                <View style={styles.totalRow}>
                  <Text style={styles.grandTotalLabel}>الإجمالي</Text>
                  <Text style={styles.grandTotalValue}>{invoice.total} ر.س</Text>
                </View>
                <Text style={[styles.totalLabelEn, { fontWeight: 'bold' }]}>Total</Text>
              </View>

              <View style={styles.dashedDivider} />

              {/* ====== PAYMENT METHOD ====== */}
              {invoice.paymentMethod && (
                <View style={styles.paymentSection}>
                  <View style={styles.totalRow}>
                    <Text style={styles.paymentLabel}>
                      الدفع - {getPaymentLabel(invoice.paymentMethod)}
                    </Text>
                    <Text style={styles.paymentValue}>{invoice.total} ر.س</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.paymentLabelEn}>
                      Payment - {getPaymentLabel(invoice.paymentMethod)}
                    </Text>
                    <Text style={styles.paymentValueEn}>{invoice.total} ر.س</Text>
                  </View>
                </View>
              )}

              {/* ====== Product Count ====== */}
              <Text style={styles.productCount}>عدد المنتجات {getItemCount()}</Text>

              <View style={styles.dashedDivider} />

              {/* ====== QR Code ====== */}
              {invoice.qrCodeData && (
                <View style={styles.qrSection}>
                  <QRCode
                    value={invoice.qrCodeData}
                    size={150}
                    backgroundColor="#fff"
                    color="#000"
                  />
                </View>
              )}

              {/* ====== Footer ====== */}
              <View style={styles.footerSection}>
                <Text style={styles.footerTextAr}>شكراً لزيارتكم</Text>
                <Text style={styles.footerTextEn}>Thank you for your visit</Text>
              </View>

              {/* ====== Powered by Trying ====== */}
              <View style={styles.brandingSection}>
                <Text style={styles.brandingText}>
                  Powered by <Text style={styles.brandingBold}>Trying</Text>
                </Text>
              </View>
            </View>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    paddingTop: SPACING.xl + 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 18,
    color: COLORS.textSecondary,
    fontWeight: 'bold',
  },
  headerBarTitle: {
    ...FONTS.title,
    color: COLORS.text,
    fontSize: 18,
  },
  shareBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primaryLight,
  },
  shareBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  printBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: '#1D4ED8',
  },
  printBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    ...FONTS.subtitle,
    color: COLORS.textLight,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  errorText: {
    ...FONTS.subtitle,
    color: COLORS.error,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },

  // ===== Receipt Card =====
  receipt: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.xxl,
    padding: SPACING.lg,
    paddingHorizontal: SPACING.md + 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },

  // ===== Header Section =====
  headerSection: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  },
  restaurantNameAr: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 1,
    textAlign: 'center',
  },
  restaurantNameEn: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  restaurantInfo: {
    fontSize: 10,
    color: '#333',
    textAlign: 'center',
    marginTop: 1,
  },

  // ===== Dividers =====
  dashedDivider: {
    borderTopWidth: 1,
    borderTopColor: '#000',
    borderStyle: 'dashed',
    marginVertical: 8,
  },
  solidDivider: {
    borderTopWidth: 2,
    borderTopColor: '#000',
    marginVertical: 8,
  },

  // ===== Title =====
  titleSection: {
    alignItems: 'center',
    marginVertical: 4,
  },
  invoiceTitleAr: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
  },
  invoiceTitleEn: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333',
  },

  // ===== Order Number =====
  orderNumberBox: {
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    padding: 6,
    marginVertical: 8,
  },
  orderNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },

  // ===== Details =====
  detailsSection: {
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: '#000',
  },
  detailValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000',
  },
  detailLabelEn: {
    fontSize: 10,
    color: '#555',
    marginBottom: 4,
  },

  // ===== Order Type =====
  orderTypeSection: {
    marginBottom: 6,
  },
  orderTypeAr: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 1,
  },
  orderTypeEn: {
    fontSize: 10,
    color: '#555',
    marginBottom: 4,
  },
  customerInfo: {
    fontSize: 11,
    color: '#000',
    marginBottom: 2,
  },

  // ===== Items =====
  itemsSection: {
    marginBottom: 4,
  },
  itemsHeader: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  itemsHeaderText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  itemsHeaderEn: {
    flexDirection: 'row',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 4,
  },
  itemsHeaderEnText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#555',
  },
  itemsHeaderDivider: {
    display: 'none',
  },
  itemRow: {
    marginBottom: 8,
  },
  itemMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemQty: {
    width: 35,
    fontSize: 12,
    color: '#000',
  },
  itemName: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
    paddingHorizontal: 4,
  },
  itemPrice: {
    width: 70,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'left',
  },
  itemNameAr: {
    fontSize: 10,
    color: '#333',
    marginTop: 1,
    marginLeft: 35,
  },
  itemNotes: {
    fontSize: 9,
    color: '#555',
    marginTop: 1,
    marginLeft: 35,
  },

  // ===== Totals =====
  totalsSection: {
    marginBottom: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  totalLabel: {
    fontSize: 12,
    color: '#000',
  },
  totalValue: {
    fontSize: 12,
    color: '#000',
  },
  totalLabelEn: {
    fontSize: 10,
    color: '#555',
    marginBottom: 4,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  grandTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },

  // ===== Payment =====
  paymentSection: {
    marginVertical: 6,
  },
  paymentLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
  },
  paymentValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
  },
  paymentLabelEn: {
    fontSize: 10,
    color: '#555',
  },
  paymentValueEn: {
    fontSize: 10,
    color: '#555',
  },

  // ===== Product Count =====
  productCount: {
    fontSize: 11,
    color: '#000',
    marginVertical: 6,
  },

  // ===== QR =====
  qrSection: {
    alignItems: 'center',
    marginVertical: 12,
  },
  qrHint: {
    fontSize: 9,
    color: '#555',
    marginTop: 6,
  },

  // ===== Footer =====
  footerSection: {
    alignItems: 'center',
    marginTop: 8,
  },
  footerTextAr: {
    fontSize: 10,
    color: '#555',
  },
  footerTextEn: {
    fontSize: 10,
    color: '#555',
    marginTop: 1,
  },

  // ===== Branding =====
  brandingSection: {
    alignItems: 'center',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    borderStyle: 'dotted',
    paddingTop: 6,
  },
  brandingText: {
    fontSize: 9,
    color: '#999',
  },
  brandingBold: {
    fontWeight: 'bold',
    color: '#666',
  },
});
