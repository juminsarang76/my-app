"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Lang = "th" | "vi" | "my" | "id" | "km" | "uk" | "zh" | "ar";
type Word = { ko: string } & Record<Lang, string>;

const WORDS: Word[] = [
  { ko: "일", th: "งาน", vi: "công việc", my: "အလုပ်", id: "pekerjaan", km: "ការងារ", uk: "робота", zh: "工作", ar: "عمل" },
  { ko: "병원", th: "โรงพยาบาล", vi: "bệnh viện", my: "ဆေးရုံ", id: "rumah sakit", km: "មន្ទីរពេទ្យ", uk: "лікарня", zh: "医院", ar: "مستشفى" },
  { ko: "약", th: "ยา", vi: "thuốc", my: "ဆေး", id: "obat", km: "ថ្នាំ", uk: "ліки", zh: "药", ar: "دواء" },
  { ko: "안전", th: "ความปลอดภัย", vi: "an toàn", my: "ဘေးကင်းရေး", id: "keselamatan", km: "សុវត្ថិភាព", uk: "безпека", zh: "安全", ar: "سلامة" },
  { ko: "월급", th: "เงินเดือน", vi: "tiền lương", my: "လစာ", id: "gaji", km: "ប្រាក់ខែ", uk: "зарплата", zh: "工资", ar: "راتب" },
  { ko: "계약서", th: "สัญญา", vi: "hợp đồng", my: "စာချုပ်", id: "kontrak", km: "កិច្ចសន្យា", uk: "контракт", zh: "合同", ar: "عقد" },
  { ko: "휴가", th: "วันหยุด", vi: "ngày nghỉ", my: "အားလပ်ရက်", id: "cuti", km: "ថ្ងៃឈប់សម្រាក", uk: "відпустка", zh: "休假", ar: "إجازة" },
  { ko: "공장", th: "โรงงาน", vi: "nhà máy", my: "စက်ရုံ", id: "pabrik", km: "រោងចក្រ", uk: "завод", zh: "工厂", ar: "مصنع" },
  { ko: "기숙사", th: "หอพัก", vi: "ký túc xá", my: "အဆောင်", id: "asrama", km: "កន្លែងស្នាក់នៅ", uk: "гуртожиток", zh: "宿舍", ar: "سكن العمال" },
  { ko: "사장님", th: "เจ้านาย", vi: "ông chủ", my: "သူဌေး", id: "bos", km: "ថៅកែ", uk: "начальник", zh: "老板", ar: "مدير" },
  { ko: "가족", th: "ครอบครัว", vi: "gia đình", my: "မိသားစု", id: "keluarga", km: "គ្រួសារ", uk: "сім'я", zh: "家人", ar: "عائلة" },
  { ko: "시간", th: "เวลา", vi: "thời gian", my: "အချိန်", id: "waktu", km: "ពេលវេលា", uk: "час", zh: "时间", ar: "وقت" },
  { ko: "내일", th: "พรุ่งนี้", vi: "ngày mai", my: "မနက်ဖြန်", id: "besok", km: "ថ្ងៃស្អែក", uk: "завтра", zh: "明天", ar: "غداً" },
  { ko: "밥", th: "ข้าว", vi: "cơm", my: "ထမင်း", id: "nasi", km: "បាយ", uk: "рис", zh: "米饭", ar: "أرز" },
  { ko: "물", th: "น้ำ", vi: "nước", my: "ရေ", id: "air", km: "ទឹក", uk: "вода", zh: "水", ar: "ماء" },
  { ko: "돈", th: "เงิน", vi: "tiền", my: "ပိုက်ဆံ", id: "uang", km: "លុយ", uk: "гроші", zh: "钱", ar: "مال" },
  { ko: "위험", th: "อันตราย", vi: "nguy hiểm", my: "အန္တရာယ်", id: "bahaya", km: "គ្រោះថ្នាក់", uk: "небезпека", zh: "危险", ar: "خطر" },
  { ko: "조심", th: "ระวัง", vi: "cẩn thận", my: "သတိထား", id: "hati-hati", km: "ប្រយ័ត្ន", uk: "обережно", zh: "小心", ar: "انتبه" },
  { ko: "친구", th: "เพื่อน", vi: "bạn bè", my: "သူငယ်ချင်း", id: "teman", km: "មិត្តភក្តិ", uk: "друг", zh: "朋友", ar: "صديق" },
  { ko: "고향", th: "บ้านเกิด", vi: "quê hương", my: "ဇာတိ", id: "kampung halaman", km: "ស្រុកកំណើត", uk: "рідний край", zh: "家乡", ar: "مسقط الرأس" },
];

const LANGS: [Lang, string][] = [
  ["th", "ไทย"],
  ["vi", "Tiếng Việt"],
  ["my", "မြန်မာ"],
  ["id", "Indonesia"],
  ["km", "ខ្មែរ"],
  ["uk", "Українська"],
  ["zh", "中文"],
  ["ar", "العربية"],
];

const shuffle = <T,>(a: T[]) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

export default function QuizPage() {
  const [lang, setLang] = useState<Lang>("th");
  const [order, setOrder] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<Word[]>([]);
  const [picked, setPicked] = useState<Word | null>(null);
  const [options, setOptions] = useState<Word[]>([]);

  const start = useCallback(() => {
    setOrder(shuffle(WORDS.map((_, i) => i)));
    setIdx(0);
    setScore(0);
    setWrong([]);
    setPicked(null);
  }, []);

  useEffect(() => start(), [start]);

  const word = order.length > 0 && idx < order.length ? WORDS[order[idx]] : null;

  useEffect(() => {
    if (!word) return;
    setOptions(shuffle([word, ...shuffle(WORDS.filter((w) => w !== word)).slice(0, 3)]));
    setPicked(null);
  }, [word]);

  const done = order.length > 0 && idx >= order.length;

  const pick = (o: Word) => {
    if (picked || !word) return;
    setPicked(o);
    if (o === word) setScore((s) => s + 1);
    else setWrong((w) => [...w, word]);
  };

  const pct = useMemo(() => (order.length ? Math.round((idx / order.length) * 100) : 0), [idx, order.length]);

  return (
    <div className="min-h-screen px-4 py-6" style={{ background: "#0e1715", color: "#e7efec" }}>
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-xl font-extrabold">TOPIK 단어 퀴즈 🇰🇷</h1>
        <p className="mb-4 mt-0.5 text-xs" style={{ color: "#93a8a3" }}>
          힌트 언어를 고르세요 · Choose your language
        </p>

        <div className="mb-4 grid grid-cols-4 gap-1.5">
          {LANGS.map(([code, label]) => (
            <button
              key={code}
              onClick={() => { setLang(code); start(); }}
              className="rounded-xl border px-1 py-2 text-[12.5px] font-bold"
              style={
                lang === code
                  ? { borderColor: "#4fc4b0", background: "#1c332e", color: "#4fc4b0" }
                  : { borderColor: "#273633", background: "#16211f", color: "#e7efec" }
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border p-5 text-center" style={{ borderColor: "#273633", background: "#16211f" }}>
          {!done && word && (
            <>
              <div className="mb-1 text-xs tabular-nums" style={{ color: "#93a8a3" }}>
                {idx + 1} / {order.length} · 맞힌 것 {score}
              </div>
              <div className="mx-auto mb-3 h-1 w-full overflow-hidden rounded-full" style={{ background: "#273633" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "#4fc4b0" }} />
              </div>
              <div className="my-2 text-5xl font-extrabold">{word.ko}</div>
              <div className="mb-4 text-xs" style={{ color: "#93a8a3" }}>무슨 뜻일까요? · What does it mean?</div>
              <div className="grid gap-2">
                {options.map((o, i) => {
                  const isAnswer = o === word;
                  const st =
                    picked && isAnswer
                      ? { borderColor: "#52c893", color: "#52c893", background: "#1c332e" }
                      : picked === o && !isAnswer
                        ? { borderColor: "#e0a05e", color: "#e0a05e", background: "#33281a" }
                        : { borderColor: "#273633", background: "#0e1715", color: "#e7efec" };
                  return (
                    <button key={i} disabled={!!picked} onClick={() => pick(o)}
                      className="rounded-xl border-2 px-3 py-3 text-lg font-bold active:scale-[.98]" style={st}>
                      {o[lang]}
                    </button>
                  );
                })}
              </div>
              {picked && (
                <button onClick={() => setIdx((i) => i + 1)}
                  className="mt-4 w-full rounded-xl py-3 text-base font-extrabold"
                  style={{ background: "#4fc4b0", color: "#0e1715" }}>
                  다음 →
                </button>
              )}
            </>
          )}
          {done && (
            <>
              <div className="text-sm">점수 · Score</div>
              <div className="my-1 text-5xl font-extrabold" style={{ color: "#4fc4b0" }}>
                {score} / {order.length}
              </div>
              {wrong.length > 0 ? (
                <div className="mt-3 text-left text-[15px]">
                  <p className="mb-1 font-extrabold">다시 볼 단어 · Review</p>
                  {wrong.map((w, i) => (
                    <div key={i} className="border-b py-1.5" style={{ borderColor: "#273633" }}>
                      <b style={{ color: "#4fc4b0" }}>{w.ko}</b> — {w[lang]}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2">완벽해요! 🎉</p>
              )}
              <button onClick={start} className="mt-4 w-full rounded-xl py-3 text-base font-extrabold"
                style={{ background: "#4fc4b0", color: "#0e1715" }}>
                다시 하기 · Try again
              </button>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed" style={{ color: "#93a8a3" }}>
          이 앱은 클로드(Claude)에게 한 문장으로 부탁해 만들었습니다 —<br />
          &quot;TOPIK 단어 20개로 8개 언어 힌트 퀴즈 앱 만들어줘&quot;
        </p>
      </div>
    </div>
  );
}
