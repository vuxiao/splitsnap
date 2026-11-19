import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  Download,
  Link2,
  Loader2,
  QrCode,
  Receipt,
  X,
} from 'lucide-react';
import type { Bill, SettlementResult } from '../types/bill';
import { buildShareUrl } from '../core/shareCodec';
import { generateReceiptImage } from '../core/receiptCanvas';

export type ShareModalTab = 'share' | 'receipt';

interface ShareModalProps {
  open: boolean;
  initialTab: ShareModalTab;
  bill: Bill;
  settlement: SettlementResult;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export function ShareModal({
  open,
  initialTab,
  bill,
  settlement,
  onClose,
  onToast,
}: ShareModalProps) {
  const [activeTab, setActiveTab] = useState<ShareModalTab>(initialTab);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [receiptDataUrl, setReceiptDataUrl] = useState<string>('');
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(
    () => (open ? buildShareUrl(bill) : ''),
    [open, bill]
  );

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      setCopied(false);
    }
  }, [open, initialTab]);

  // 生成专属账单二维码
  useEffect(() => {
    if (!open || !shareUrl) return;
    let cancelled = false;
    QRCode.toDataURL(shareUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#141413',
        light: '#FFFDF9',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [open, shareUrl]);

  // 生成热敏纸小票长图
  useEffect(() => {
    if (!open || activeTab !== 'receipt' || !shareUrl) return;
    let cancelled = false;
    setLoadingReceipt(true);
    generateReceiptImage(bill, settlement, shareUrl)
      .then((url) => {
        if (!cancelled) {
          setReceiptDataUrl(url);
          setLoadingReceipt(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadingReceipt(false);
          onToast('小票生成失败，请重试');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, activeTab, bill, settlement, shareUrl, onToast]);

  if (!open) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      onToast('专属账单链接已复制，快发给同桌吧');
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // 兼容非 HTTPS 或无剪贴板权限环境
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      onToast('专属账单链接已复制');
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleDownloadReceipt = () => {
    if (!receiptDataUrl) return;
    const link = document.createElement('a');
    const safeTitle = bill.title.replace(/[^\w\u4e00-\u9fa5-]+/g, '_');
    link.download = `SplitSnap_${safeTitle}_${bill.receiptNo}.png`;
    link.href = receiptDataUrl;
    link.click();
    onToast('热敏小票长图已开始保存');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] animate-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[430px] max-h-[92dvh] bg-[#FAF7F0] rounded-t-3xl border-t border-x border-[#DED8CC] flex flex-col overflow-hidden shadow-2xl animate-sheet-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="分享账单与导出热敏小票"
      >
        {/* 顶部栏 + Tab 切换 */}
        <div className="px-4 pt-3.5 pb-3 border-b border-dashed border-[#DED8CC] bg-[#FFFDF9] shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-[#141413]">分享给同桌</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#68645B] hover:bg-[#F0ECE2] cursor-pointer"
              aria-label="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#F0ECE2] border border-[#DED8CC]">
            <button
              type="button"
              data-testid="modal-tab-share"
              onClick={() => setActiveTab('share')}
              className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'share'
                  ? 'bg-[#FFFDF9] text-[#141413] shadow-xs'
                  : 'text-[#68645B]'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-[#FF4D1A]" />
              扫码 / 链接同步
            </button>
            <button
              type="button"
              data-testid="modal-tab-receipt"
              onClick={() => setActiveTab('receipt')}
              className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'receipt'
                  ? 'bg-[#FFFDF9] text-[#141413] shadow-xs'
                  : 'text-[#68645B]'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 text-[#FF4D1A]" />
              热敏小票长图
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe">
          {activeTab === 'share' ? (
            <div className="space-y-4">
              <div className="bg-[#FFFDF9] border border-[#DED8CC] rounded-2xl p-5 text-center shadow-xs">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#68645B]">
                  ZERO-BACKEND URL SYNC
                </div>
                <div className="text-sm font-bold text-[#141413] mt-1">
                  {bill.title}
                </div>

                <div className="mt-4 inline-flex items-center justify-center p-3 rounded-2xl bg-[#FFFDF9] border-2 border-[#141413]">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="账单专属分享二维码"
                      data-testid="share-qr-image"
                      className="w-48 h-48 block"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-[#68645B]" />
                    </div>
                  )}
                </div>

                <p className="mt-3 text-xs text-[#68645B] leading-relaxed">
                  朋友用微信扫一扫，无需注册登录，
                  <br />
                  即可直接查看完整明细与最少转账方案，并一键存副本。
                </p>
              </div>

              {/* 压缩链接展示与复制 */}
              <div className="bg-[#FFFDF9] border border-[#DED8CC] rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#68645B]">
                  <span className="inline-flex items-center gap-1">
                    <Link2 className="w-3.5 h-3.5" />
                    专属同步链接
                  </span>
                  <span>LZ 压缩 · {shareUrl.length} 字符</span>
                </div>
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  data-testid="share-url-input"
                  onFocus={(e) => e.target.select()}
                  className="w-full px-2.5 py-2 rounded-xl bg-[#F5F2EB] border border-[#E5E0D5] text-[11px] font-mono text-[#68645B] focus:outline-none"
                />
                <button
                  type="button"
                  data-testid="copy-share-url-btn"
                  onClick={handleCopyLink}
                  className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer ${
                    copied
                      ? 'bg-[#0D9468] text-white'
                      : 'bg-[#FF4D1A] text-white shadow-[0_6px_16px_rgba(255,77,26,0.25)]'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      已复制链接
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      一键复制账单链接
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="bg-[#E6E1D6] border border-[#DED8CC] rounded-2xl p-3 max-h-[54dvh] overflow-y-auto flex flex-col items-center">
                {loadingReceipt || !receiptDataUrl ? (
                  <div className="py-20 flex flex-col items-center gap-2 text-[#68645B]">
                    <Loader2 className="w-7 h-7 animate-spin text-[#FF4D1A]" />
                    <span className="text-xs font-medium">正在打印热敏小票…</span>
                  </div>
                ) : (
                  <img
                    src={receiptDataUrl}
                    alt="热敏纸结算小票长图"
                    data-testid="receipt-preview-image"
                    className="w-full max-w-[340px] rounded-lg shadow-md block"
                  />
                )}
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={!receiptDataUrl || loadingReceipt}
                  data-testid="download-receipt-btn"
                  onClick={handleDownloadReceipt}
                  className="w-full py-3.5 rounded-2xl bg-[#141413] text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  一键保存高清小票长图 (PNG)
                </button>
                <p className="text-center text-[11px] text-[#68645B]">
                  微信内也可长按上方小票图片直接发送给好友或保存相册
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
