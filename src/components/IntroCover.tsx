import { ArrowRight, QrCode, ReceiptText, Sparkles } from 'lucide-react';

interface IntroCoverProps {
  hasExistingSession: boolean;
  onStartNow: () => void;
  onTrySample: () => void;
  onOpenPoster: () => void;
}

const FEATURES = [
  {
    index: '01',
    accentBg: 'bg-[#FF4D1A] text-[#FFFDF9]',
    title: '灵活均摊',
    desc: '一键排除不喝酒 / 晚到成员，支持「+」号连加与自定义金额校验，0.01 元公平轮转。',
  },
  {
    index: '02',
    accentBg: 'bg-[#0D9468] text-[#FFFDF9]',
    title: '零后端扫码同步',
    desc: '整本账经 LZ 压缩编码进链接与二维码，朋友微信扫一扫免登录直看并一键存副本。',
  },
  {
    index: '03',
    accentBg: 'bg-[#141413] text-[#FFFDF9]',
    title: '热敏小票长图',
    desc: '一键打印带锯齿撕裂边、已结清印章与专属二维码的电子结算单，发群明算账。',
  },
] as const;

const BARCODE_BARS = [
  3, 1, 2, 1, 4, 2, 1, 2, 3, 1, 2, 3, 1, 1, 4, 2, 1, 2, 3, 1, 2, 2, 1, 3, 2, 1,
  4, 1, 2, 2, 1, 3,
];

export function IntroCover({
  hasExistingSession,
  onStartNow,
  onTrySample,
  onOpenPoster,
}: IntroCoverProps) {
  return (
    <div
      data-testid="intro-cover"
      className="min-h-dvh w-full flex justify-center bg-[#E4DFD5]"
    >
      <div className="w-full max-w-[430px] min-h-dvh paper-texture relative flex flex-col px-4 pt-safe pb-safe shadow-[0_0_40px_rgba(20,20,19,0.08)]">
        {/* 顶部极简瑞士工业眉标 */}
        <div className="flex items-center justify-between pt-2 pb-3 text-[10px] font-mono uppercase tracking-[0.14em] text-[#68645B]">
          <span>SWISS RECEIPT UTILITY</span>
          <span>ZERO-LOGIN · FREE</span>
        </div>

        {/* 拟真深色金属热敏打印机出纸槽 */}
        <div className="relative z-10 rounded-2xl bg-gradient-to-b from-[#292926] via-[#191917] to-[#111110] px-3.5 pt-2.5 pb-3 shadow-[0_10px_24px_rgba(20,20,19,0.22)] border border-black/40">
          <div className="flex items-center justify-between text-[10px] font-mono tracking-wider mb-2">
            <span className="inline-flex items-center gap-1.5 text-[#ABA69C]">
              <span className="w-2 h-2 rounded-full bg-[#0D9468] shadow-[0_0_8px_rgba(13,148,104,0.85)]" />
              THERMAL PRINTER // SS-01
            </span>
            <span className="text-[#FF4D1A] font-bold">PRINTING</span>
          </div>
          {/* 内凹深黑出纸缝隙 */}
          <div className="h-2.5 rounded-full bg-[#070706] shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)] border-b border-white/10" />
        </div>

        {/* 从出纸槽吐出的「产品说明书小票」 */}
        <article className="relative -mt-2 mx-2 bg-[#FFFDF9] border-x border-[#DED8CC] receipt-zig-zag-bottom shadow-[0_10px_28px_rgba(20,20,19,0.09)]">
          {/* 出纸口落在纸张顶部的真实内阴影 */}
          <div
            className="h-4 w-full pointer-events-none"
            style={{
              background:
                'linear-gradient(180deg, rgba(20,20,19,0.14) 0%, rgba(20,20,19,0.03) 60%, rgba(20,20,19,0) 100%)',
            }}
          />

          <div className="px-4 pb-5 -mt-1 space-y-4">
            {/* 小票编号头 */}
            <div className="flex items-center justify-between text-[10px] font-mono text-[#68645B] pb-2 border-b-2 border-[#141413]">
              <span>PRODUCT MANUAL · 说明书</span>
              <span className="font-bold text-[#141413]">NO.SS-2026</span>
            </div>

            {/* 品牌主标题与核心价值主张 */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <h1 className="text-[28px] leading-none font-bold tracking-tight text-[#141413]">
                  极速分账
                </h1>
                <span className="px-2.5 py-1 rounded-md bg-[#FF4D1A] text-[#FFFDF9] font-mono text-xs font-bold tracking-wider">
                  SPLITSNAP
                </span>
              </div>
              <p className="mt-2.5 text-[13px] font-medium text-[#4A463F] leading-relaxed">
                聚餐旅行 AA 乱账，30 秒压缩成最少转账
              </p>
            </div>

            {/* 核心卖点可视化对比框：7 笔乱账 ➔ 2 笔结清 */}
            <div className="rounded-xl bg-[#F4F0E7] border border-[#DED8CC] p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#68645B] mb-2">
                MIN-CASH-FLOW · 最小转账路径算法
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                {/* 左：7 笔交叉乱账 */}
                <div className="rounded-lg bg-[#FFFDF9] border border-[#DED8CC] p-2 text-center">
                  <svg
                    viewBox="0 0 110 56"
                    className="w-full h-11 mx-auto"
                    aria-hidden="true"
                  >
                    <g
                      stroke="#FF4D1A"
                      strokeOpacity="0.45"
                      strokeWidth="1.4"
                      strokeDasharray="3 2"
                    >
                      <line x1="20" y1="14" x2="90" y2="14" />
                      <line x1="20" y1="42" x2="90" y2="42" />
                      <line x1="20" y1="14" x2="20" y2="42" />
                      <line x1="90" y1="14" x2="90" y2="42" />
                      <line x1="20" y1="14" x2="90" y2="42" />
                      <line x1="90" y1="14" x2="20" y2="42" />
                    </g>
                    {[
                      [20, 14, 'A'],
                      [90, 14, 'B'],
                      [20, 42, 'C'],
                      [90, 42, 'D'],
                    ].map(([cx, cy, label]) => (
                      <g key={String(label)}>
                        <circle cx={Number(cx)} cy={Number(cy)} r="8.5" fill="#141413" />
                        <text
                          x={Number(cx)}
                          y={Number(cy) + 3}
                          textAnchor="middle"
                          fontSize="8.5"
                          fontWeight="700"
                          fontFamily="JetBrains Mono, monospace"
                          fill="#FFFDF9"
                        >
                          {label}
                        </text>
                      </g>
                    ))}
                  </svg>
                  <div className="text-[11px] font-bold text-[#141413] mt-1">
                    多人交叉垫付
                  </div>
                  <div className="tabular-money text-[11px] font-bold text-[#FF4D1A]">
                    7 笔乱账
                  </div>
                </div>

                {/* 中：信号橙箭头 */}
                <div className="w-7 h-7 rounded-full bg-[#FF4D1A] text-[#FFFDF9] flex items-center justify-center shadow-xs shrink-0">
                  <ArrowRight className="w-4 h-4 stroke-[2.8]" />
                </div>

                {/* 右：2 笔结清 */}
                <div className="rounded-lg bg-[#EFF8F4] border border-[#0D9468]/40 p-2 text-center">
                  <svg
                    viewBox="0 0 110 56"
                    className="w-full h-11 mx-auto"
                    aria-hidden="true"
                  >
                    {[
                      { y: 17, from: 'C', to: 'A' },
                      { y: 39, from: 'D', to: 'B' },
                    ].map((row) => (
                      <g key={row.from}>
                        <circle
                          cx="22"
                          cy={row.y}
                          r="8"
                          fill="#FFFDF9"
                          stroke="#0D9468"
                          strokeWidth="1.6"
                        />
                        <text
                          x="22"
                          y={row.y + 3}
                          textAnchor="middle"
                          fontSize="8"
                          fontWeight="700"
                          fontFamily="JetBrains Mono, monospace"
                          fill="#0D9468"
                        >
                          {row.from}
                        </text>
                        <line
                          x1="33"
                          y1={row.y}
                          x2="75"
                          y2={row.y}
                          stroke="#0D9468"
                          strokeWidth="2"
                        />
                        <polyline
                          points={`70,${row.y - 3.5} 75,${row.y} 70,${row.y + 3.5}`}
                          fill="none"
                          stroke="#0D9468"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="88" cy={row.y} r="8" fill="#0D9468" />
                        <text
                          x="88"
                          y={row.y + 3}
                          textAnchor="middle"
                          fontSize="8"
                          fontWeight="700"
                          fontFamily="JetBrains Mono, monospace"
                          fill="#FFFDF9"
                        >
                          {row.to}
                        </text>
                      </g>
                    ))}
                  </svg>
                  <div className="text-[11px] font-bold text-[#141413] mt-1">
                    算法精简
                  </div>
                  <div className="tabular-money text-[11px] font-bold text-[#0D9468]">
                    仅需 2 笔结清
                  </div>
                </div>
              </div>
            </div>

            {/* 三条瑞士网格特性清单 */}
            <div className="divide-y divide-dashed divide-[#E5E0D5] border-y border-dashed border-[#DED8CC]">
              {FEATURES.map((feat) => (
                <div
                  key={feat.index}
                  className="py-3 grid grid-cols-[34px_1fr] gap-2.5 items-start"
                >
                  <span
                    className={`h-6 rounded-md font-mono text-[11px] font-bold flex items-center justify-center mt-0.5 ${feat.accentBg}`}
                  >
                    {feat.index}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[#141413]">
                      {feat.title}
                    </div>
                    <p className="text-[11px] text-[#68645B] leading-relaxed mt-0.5">
                      {feat.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* 底部纯矢量条形码装饰 */}
            <div className="pt-0.5 flex flex-col items-center">
              <div
                className="flex items-stretch justify-center gap-[2px] h-7"
                aria-hidden="true"
              >
                {BARCODE_BARS.map((w, idx) => (
                  <span
                    key={idx}
                    className={idx % 2 === 0 ? 'bg-[#141413]' : 'bg-transparent'}
                    style={{ width: `${w * 1.5}px` }}
                  />
                ))}
              </div>
              <span className="mt-1.5 text-[10px] font-mono tracking-widest text-[#9A958A]">
                * SPLITSNAP · CLEAR BILLS · GOOD TIMES *
              </span>
            </div>
          </div>
        </article>

        {/* 底部行动按钮组 */}
        <div className="mt-6 space-y-2.5 pb-4">
          <button
            type="button"
            data-testid="intro-start-btn"
            onClick={onStartNow}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#FF4D1A] text-[#FFFDF9] text-[15px] font-bold flex items-center justify-center gap-2 shadow-[0_8px_22px_rgba(255,77,26,0.32)] active:scale-[0.98] transition cursor-pointer"
          >
            <ReceiptText className="w-4 h-4" />
            <span>
              {hasExistingSession
                ? '撕开小票 · 进入我的账本'
                : '撕开新小票 · 立即算账'}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              data-testid="intro-sample-btn"
              onClick={onTrySample}
              className="py-2.5 px-3 rounded-xl bg-[#FFFDF9] border border-[#DED8CC] text-[#141413] text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FF4D1A]" />
              <span>体验示例账单</span>
            </button>

            <button
              type="button"
              data-testid="intro-poster-btn"
              onClick={onOpenPoster}
              className="py-2.5 px-3 rounded-xl bg-[#141413] text-[#FFFDF9] text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-[#FF4D1A]" />
              <span>产品介绍海报</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
