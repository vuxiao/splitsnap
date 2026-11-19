import { useEffect, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import {
  generateIntroPosterImage,
  getOfficialRootUrl,
} from '../core/introPosterCanvas';

interface IntroPosterModalProps {
  open: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export function IntroPosterModal({
  open,
  onClose,
  onToast,
}: IntroPosterModalProps) {
  const [posterUrl, setPosterUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    generateIntroPosterImage()
      .then((url) => {
        if (!cancelled) {
          setPosterUrl(url);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          onToast('海报生成失败，请重试');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, onToast]);

  if (!open) return null;

  const handleDownload = () => {
    if (!posterUrl) return;
    const link = document.createElement('a');
    link.download = 'SplitSnap_产品介绍二维码海报.png';
    link.href = posterUrl;
    link.click();
    onToast('产品介绍二维码海报已开始保存');
  };

  const rootUrl = getOfficialRootUrl();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-[2px] animate-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[430px] max-h-[92dvh] bg-[#FAF7F0] rounded-t-3xl border-t border-x border-[#DED8CC] flex flex-col overflow-hidden shadow-2xl animate-sheet-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="产品介绍二维码海报"
      >
        <div className="px-4 py-3.5 border-b border-dashed border-[#DED8CC] bg-[#FFFDF9] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#141413]">
              产品介绍二维码海报
            </h2>
            <p className="text-[11px] font-mono text-[#68645B] truncate max-w-[280px]">
              1080×1920 高清竖版 · 扫码直达 {rootUrl.replace(/^https?:\/\//, '')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#68645B] hover:bg-[#F0ECE2] cursor-pointer"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe space-y-3.5">
          <div className="bg-[#E6E1D6] border border-[#DED8CC] rounded-2xl p-3 flex items-center justify-center min-h-[340px]">
            {loading || !posterUrl ? (
              <div className="py-16 flex flex-col items-center gap-2 text-[#68645B]">
                <Loader2 className="w-7 h-7 animate-spin text-[#FF4D1A]" />
                <span className="text-xs font-medium">正在印制官方介绍海报…</span>
              </div>
            ) : (
              <img
                src={posterUrl}
                alt="极速分账 SplitSnap 官方产品介绍二维码海报"
                data-testid="intro-poster-image"
                className="w-full max-w-[290px] rounded-xl shadow-lg block"
              />
            )}
          </div>

          <div className="space-y-2">
            <button
              type="button"
              disabled={loading || !posterUrl}
              data-testid="download-intro-poster-btn"
              onClick={handleDownload}
              className="w-full py-3.5 rounded-2xl bg-[#141413] text-[#FFFDF9] text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              保存高清介绍海报 (PNG)
            </button>
            <p className="text-center text-[11px] text-[#68645B]">
              手机端可直接长按海报保存或转发微信群，把好用的分账工具安利给朋友
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
