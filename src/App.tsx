import { useState, useMemo } from "react";
import { Printer, Pencil, Loader2, AlertCircle, Stethoscope } from "lucide-react";

const DISEASES = ["chd", "stroke", "diabetes", "hypertension", "mace"] as const;
type DiseaseKey = (typeof DISEASES)[number];

const DISEASE_LABEL: Record<DiseaseKey, string> = {
  chd: "冠心病",
  stroke: "腦中風",
  diabetes: "糖尿病",
  hypertension: "高血壓",
  mace: "心血管不良事件 (MACE)",
};

const DISEASE_DESC: Record<DiseaseKey, string> = {
  chd: "未來 10 年發生冠狀動脈心臟病的機率",
  stroke: "未來 10 年發生腦中風的機率",
  diabetes: "未來 10 年罹患第二型糖尿病的機率",
  hypertension: "未來 10 年罹患高血壓的機率",
  mace: "未來 10 年發生重大心血管事件的綜合機率",
};

interface RiskOK { risk: number; populationAvg: number; multipleDiff: number; }
interface RiskErr { error: string; }
type Risk = RiskOK | RiskErr;
const isOK = (r: Risk | undefined): r is RiskOK => !!r && "risk" in r;
type RiskResponse = Record<DiseaseKey, Risk>;

interface PatientForm {
  name: string;
  chartNo: string;
  gender: "" | "0" | "1";
  age: string;
  reportDate: string;
  sbp: string; dbp: string;
  hdlc: string; ldlc: string; chol: string; tg: string;
  glu: string; hba1c: string;
  height: string; weight: string; waist: string;
  hbp: "" | "0" | "1";
  diabetes: "" | "0" | "1";
  smoke: "" | "0" | "1";
}

const today = () => new Date().toISOString().slice(0, 10);

const initialForm: PatientForm = {
  name: "", chartNo: "", gender: "", age: "", reportDate: today(),
  sbp: "", dbp: "", hdlc: "", ldlc: "", chol: "", tg: "",
  glu: "", hba1c: "", height: "", weight: "", waist: "",
  hbp: "", diabetes: "", smoke: "",
};

interface Level { tone: "green" | "yellow" | "red"; label: string; }
function classify(r: RiskOK): Level {
  if (r.multipleDiff >= 1.5) return { tone: "red", label: "高風險" };
  if (r.multipleDiff >= 1.0) return { tone: "yellow", label: "中度風險" };
  return { tone: "green", label: "風險低於平均" };
}
const TONE_BG: Record<Level["tone"], string> = {
  green: "bg-emerald-50 border-emerald-200",
  yellow: "bg-amber-50 border-amber-200",
  red: "bg-rose-50 border-rose-200",
};
const TONE_TEXT: Record<Level["tone"], string> = {
  green: "text-emerald-700",
  yellow: "text-amber-700",
  red: "text-rose-700",
};
const TONE_DOT: Record<Level["tone"], string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-rose-500",
};

interface LabRow { label: string; value: string; unit: string; flag?: "high" | "low"; }
function buildLabRows(f: PatientForm): LabRow[] {
  const rows: LabRow[] = [];
  const num = (s: string) => (s === "" ? null : Number(s));
  const push = (label: string, value: string, unit: string, flag?: "high" | "low") =>
    value && rows.push({ label, value, unit, flag });

  const sbp = num(f.sbp), dbp = num(f.dbp);
  push("收縮壓 (SBP)", f.sbp, "mmHg", sbp != null && sbp >= 130 ? "high" : undefined);
  push("舒張壓 (DBP)", f.dbp, "mmHg", dbp != null && dbp >= 80 ? "high" : undefined);

  const tc = num(f.chol);
  push("總膽固醇", f.chol, "mg/dL", tc != null && tc >= 200 ? "high" : undefined);
  const ldl = num(f.ldlc);
  push("LDL (壞膽固醇)", f.ldlc, "mg/dL", ldl != null && ldl >= 130 ? "high" : undefined);
  const hdl = num(f.hdlc);
  let hdlFlag: "high" | "low" | undefined;
  if (hdl != null && f.gender === "1" && hdl < 40) hdlFlag = "low";
  if (hdl != null && f.gender === "0" && hdl < 50) hdlFlag = "low";
  push("HDL (好膽固醇)", f.hdlc, "mg/dL", hdlFlag);
  const tg = num(f.tg);
  push("三酸甘油酯 (TG)", f.tg, "mg/dL", tg != null && tg >= 150 ? "high" : undefined);

  const glu = num(f.glu);
  push("空腹血糖", f.glu, "mg/dL", glu != null && glu >= 100 ? "high" : undefined);
  const a1c = num(f.hba1c);
  push("HbA1c", f.hba1c, "%", a1c != null && a1c >= 5.7 ? "high" : undefined);

  const ht = num(f.height), wt = num(f.weight);
  if (ht && wt) {
    const bmi = wt / (ht / 100) ** 2;
    push("BMI", bmi.toFixed(1), "kg/m²", bmi >= 24 ? "high" : undefined);
  }
  const waist = num(f.waist);
  let waistFlag: "high" | undefined;
  if (waist != null && f.gender === "1" && waist >= 90) waistFlag = "high";
  if (waist != null && f.gender === "0" && waist >= 80) waistFlag = "high";
  push("腰圍", f.waist, "cm", waistFlag);

  return rows;
}

function buildRecommendations(results: RiskResponse, f: PatientForm): string[] {
  const recs: string[] = [];
  const reds: string[] = [];
  DISEASES.forEach((k) => {
    const r = results[k];
    if (isOK(r) && classify(r).tone === "red") reds.push(DISEASE_LABEL[k]);
  });

  if (reds.length === 0) {
    recs.push("整體慢性病風險屬於可接受範圍，請維持目前的健康生活型態。");
  } else {
    recs.push(`您在以下項目屬於高風險：${reds.join("、")}。建議與醫師討論個人化追蹤與治療計畫。`);
  }

  const elevated = (k: DiseaseKey) => {
    const r = results[k];
    return isOK(r) && classify(r).tone !== "green";
  };

  if (elevated("hypertension")) {
    recs.push("血壓控制：每日固定時間量測並紀錄，限鈉攝取每日小於 5 g 食鹽，規律有氧運動每週至少 150 分鐘。");
  }
  if (elevated("chd") || elevated("mace")) {
    recs.push("心血管保護：地中海或得舒(DASH)飲食、減少飽和脂肪與反式脂肪、控制 LDL 膽固醇至建議目標。");
  }
  if (elevated("diabetes")) {
    recs.push("血糖管理：減少精緻糖與含糖飲料、增加全穀與膳食纖維、每年複檢空腹血糖與 HbA1c。");
  }
  if (elevated("stroke")) {
    recs.push("中風預防：戒菸、控制血壓與血脂、若有心房顫動需與醫師討論抗凝血治療。");
  }
  if (f.smoke === "1") {
    recs.push("戒菸：吸菸是所有心血管疾病最強的可改變風險因子，建議尋求戒菸門診協助。");
  }
  recs.push(
    `建議追蹤頻率：${reds.length >= 2 ? "每 3 個月" : reds.length === 1 ? "每 6 個月" : "每 12 個月"}回診評估。`,
  );
  return recs;
}

export default function App() {
  const [form, setForm] = useState<PatientForm>(initialForm);
  const [view, setView] = useState<"edit" | "report">("edit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<RiskResponse | null>(null);

  const update = <K extends keyof PatientForm>(k: K, v: PatientForm[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
  };

  const labRows = useMemo(() => buildLabRows(form), [form]);
  const recs = useMemo(
    () => (results ? buildRecommendations(results, form) : []),
    [results, form],
  );

  const canSubmit = form.gender !== "" && form.age !== "" && Number(form.age) >= 20;

  const submit = async () => {
    setError(null); setLoading(true);
    try {
      const num = (s: string) => (s === "" ? undefined : Number(s));
      const flag = (s: "" | "0" | "1") => (s === "" ? undefined : (Number(s) as 0 | 1));
      const payload: Record<string, unknown> = {
        gender: Number(form.gender) as 0 | 1,
        age: Number(form.age),
        sbp: num(form.sbp), dbp: num(form.dbp),
        hdlc: num(form.hdlc), ldlc: num(form.ldlc),
        chol: num(form.chol), tg: num(form.tg),
        glu: num(form.glu), hba1c: num(form.hba1c),
        height: num(form.height), weight: num(form.weight), waist: num(form.waist),
        hbp: flag(form.hbp), diabetes: flag(form.diabetes), smoke: flag(form.smoke),
      };
      const clean = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== undefined),
      );
      const res = await fetch("/api/risk-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clean),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`伺服器錯誤 ${res.status}：${txt.slice(0, 200)}`);
      }
      setResults((await res.json()) as RiskResponse);
      setView("report");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white sticky top-0 z-10 no-print">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">安安診所 · 健檢風險評估報告</div>
              <div className="text-xs text-slate-500 leading-tight">資料來源：國健署科學算病館</div>
            </div>
          </div>
          {view === "report" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView("edit")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-slate-100"
              >
                <Pencil className="w-4 h-4" /> 回編輯
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                <Printer className="w-4 h-4" /> 列印 / 存 PDF
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 print:py-0 print:px-0">
        {view === "edit" ? (
          <EditForm
            form={form}
            update={update}
            canSubmit={canSubmit}
            loading={loading}
            error={error}
            submit={submit}
          />
        ) : (
          results && (
            <ReportView form={form} labRows={labRows} results={results} recommendations={recs} />
          )
        )}
      </main>
    </div>
  );
}

interface EditProps {
  form: PatientForm;
  update: <K extends keyof PatientForm>(k: K, v: PatientForm[K]) => void;
  canSubmit: boolean;
  loading: boolean;
  error: string | null;
  submit: () => void;
}

function EditForm({ form, update, canSubmit, loading, error, submit }: EditProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">健檢報告產生器</h1>
        <p className="text-sm text-slate-600 mt-1">
          輸入病人健檢數值，系統自動透過國健署「科學算病館」計算 5 種慢性病 10 年風險。
        </p>
      </div>

      <Section title="病人資料">
        <Field label="姓名">
          <input value={form.name} onChange={(e) => update("name", e.target.value)} className="input" />
        </Field>
        <Field label="病歷號">
          <input value={form.chartNo} onChange={(e) => update("chartNo", e.target.value)} className="input" />
        </Field>
        <Field label="性別 *">
          <select
            value={form.gender}
            onChange={(e) => update("gender", e.target.value as PatientForm["gender"])}
            className="input"
          >
            <option value="">— 選擇 —</option>
            <option value="1">男</option>
            <option value="0">女</option>
          </select>
        </Field>
        <Field label="年齡 *">
          <input type="number" min={20} max={100} value={form.age} onChange={(e) => update("age", e.target.value)} className="input" />
        </Field>
        <Field label="報告日期">
          <input type="date" value={form.reportDate} onChange={(e) => update("reportDate", e.target.value)} className="input" />
        </Field>
      </Section>

      <Section title="體檢數值">
        <Field label="收縮壓 SBP (mmHg)">
          <input type="number" value={form.sbp} onChange={(e) => update("sbp", e.target.value)} className="input" />
        </Field>
        <Field label="舒張壓 DBP (mmHg)">
          <input type="number" value={form.dbp} onChange={(e) => update("dbp", e.target.value)} className="input" />
        </Field>
        <Field label="總膽固醇 (mg/dL)">
          <input type="number" value={form.chol} onChange={(e) => update("chol", e.target.value)} className="input" />
        </Field>
        <Field label="LDL (mg/dL)">
          <input type="number" value={form.ldlc} onChange={(e) => update("ldlc", e.target.value)} className="input" />
        </Field>
        <Field label="HDL (mg/dL)">
          <input type="number" value={form.hdlc} onChange={(e) => update("hdlc", e.target.value)} className="input" />
        </Field>
        <Field label="三酸甘油酯 TG (mg/dL)">
          <input type="number" value={form.tg} onChange={(e) => update("tg", e.target.value)} className="input" />
        </Field>
        <Field label="空腹血糖 (mg/dL)">
          <input type="number" value={form.glu} onChange={(e) => update("glu", e.target.value)} className="input" />
        </Field>
        <Field label="HbA1c (%)">
          <input type="number" step="0.1" value={form.hba1c} onChange={(e) => update("hba1c", e.target.value)} className="input" />
        </Field>
        <Field label="身高 (cm)">
          <input type="number" value={form.height} onChange={(e) => update("height", e.target.value)} className="input" />
        </Field>
        <Field label="體重 (kg)">
          <input type="number" step="0.1" value={form.weight} onChange={(e) => update("weight", e.target.value)} className="input" />
        </Field>
        <Field label="腰圍 (cm)">
          <input type="number" value={form.waist} onChange={(e) => update("waist", e.target.value)} className="input" />
        </Field>
      </Section>

      <Section title="病史 (是 / 否)">
        <YesNoField label="高血壓" value={form.hbp} onChange={(v) => update("hbp", v)} />
        <YesNoField label="糖尿病" value={form.diabetes} onChange={(v) => update("diabetes", v)} />
        <YesNoField label="抽菸" value={form.smoke} onChange={(v) => update("smoke", v)} />
      </Section>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-md text-sm text-rose-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-sm border rounded-md hover:bg-slate-100"
        >
          清除
        </button>
        <button
          disabled={!canSubmit || loading}
          onClick={submit}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50 hover:bg-indigo-700"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "計算中…" : "產生報告"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg bg-white p-5">
      <h2 className="font-semibold mb-4 pb-2 border-b">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-600 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function YesNoField({
  label, value, onChange,
}: {
  label: string;
  value: "" | "0" | "1";
  onChange: (v: "" | "0" | "1") => void;
}) {
  return (
    <div>
      <span className="text-xs text-slate-600 mb-1 block">{label}</span>
      <div className="flex gap-1">
        {(["1", "0", ""] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`px-3 py-1.5 text-sm border rounded-md ${
              value === v ? "bg-indigo-600 text-white border-indigo-600" : "hover:bg-slate-100"
            }`}
          >
            {v === "1" ? "是" : v === "0" ? "否" : "未知"}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ReportProps {
  form: PatientForm;
  labRows: LabRow[];
  results: RiskResponse;
  recommendations: string[];
}

function ReportView({ form, labRows, results, recommendations }: ReportProps) {
  return (
    <article className="bg-white space-y-5 p-6 print:p-0 border print:border-0 rounded-lg print:rounded-none">
      <header className="flex items-start justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">安安診所</h1>
          <p className="text-sm text-slate-600 mt-0.5">健康檢查 · 慢性病風險評估報告</p>
        </div>
        <div className="text-right text-xs text-slate-500 space-y-0.5">
          <div>報告日期：{form.reportDate}</div>
          {form.chartNo && <div>病歷號：{form.chartNo}</div>}
        </div>
      </header>

      <section className="grid grid-cols-3 gap-4 text-sm">
        <InfoRow label="姓名" value={form.name || "—"} />
        <InfoRow label="性別" value={form.gender === "1" ? "男" : form.gender === "0" ? "女" : "—"} />
        <InfoRow label="年齡" value={form.age ? `${form.age} 歲` : "—"} />
      </section>

      <section className="break-inside-avoid">
        <h2 className="font-semibold mb-2 text-base">本次體檢數值</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
          {labRows.length === 0 ? (
            <div className="col-span-full text-xs text-slate-500 italic">未填入體檢數值</div>
          ) : (
            labRows.map((r) => (
              <div
                key={r.label}
                className={`flex justify-between items-baseline px-3 py-2 rounded border ${
                  r.flag === "high"
                    ? "bg-rose-50 border-rose-200"
                    : r.flag === "low"
                    ? "bg-amber-50 border-amber-200"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <span className="text-slate-600">{r.label}</span>
                <span className="font-medium">
                  {r.value} <span className="text-xs text-slate-500">{r.unit}</span>
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="break-inside-avoid">
        <h2 className="font-semibold mb-2 text-base">10 年慢性病風險評估</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DISEASES.map((d) => (
            <RiskCard key={d} disease={d} result={results[d]} />
          ))}
        </div>
      </section>

      <section className="break-inside-avoid">
        <h2 className="font-semibold mb-2 text-base">個人化健康建議</h2>
        <ul className="space-y-1.5 text-sm list-disc list-inside marker:text-slate-400">
          {recommendations.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-2 gap-6 pt-6 text-sm">
        <div>
          <div className="text-xs text-slate-600 mb-8">醫師簽名</div>
          <div className="border-b border-slate-700" />
        </div>
        <div>
          <div className="text-xs text-slate-600 mb-8">病人簽收</div>
          <div className="border-b border-slate-700" />
        </div>
      </section>

      <footer className="pt-4 border-t text-xs text-slate-500 space-y-1">
        <p>
          風險分數來源：衛生福利部國民健康署「科學算病館」慢性疾病風險評估平台 v4
          (https://cdrc.hpa.gov.tw)。
        </p>
        <p>本評估僅供參考，不取代醫師臨床判斷與治療建議。如有疑問請與您的醫師討論。</p>
        <p>安安診所 · 報告產生時間 {form.reportDate}</p>
      </footer>
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-600">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function RiskCard({ disease, result }: { disease: DiseaseKey; result: Risk }) {
  if (!isOK(result)) {
    return (
      <div className="border rounded-lg p-3 bg-slate-50">
        <div className="text-sm font-medium">{DISEASE_LABEL[disease]}</div>
        <div className="text-xs text-slate-500 mt-1">無法評估：{result.error}</div>
      </div>
    );
  }
  const lvl = classify(result);
  return (
    <div className={`border rounded-lg p-3 ${TONE_BG[lvl.tone]}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-medium">{DISEASE_LABEL[disease]}</div>
        <div className={`flex items-center gap-1.5 text-xs font-medium ${TONE_TEXT[lvl.tone]}`}>
          <span className={`w-2 h-2 rounded-full ${TONE_DOT[lvl.tone]}`} />
          {lvl.label}
        </div>
      </div>
      <div className="text-xs text-slate-600 mb-2">{DISEASE_DESC[disease]}</div>
      <div className="flex items-baseline gap-3">
        <div>
          <div className="text-xs text-slate-600">您的風險</div>
          <div className={`text-2xl font-bold ${TONE_TEXT[lvl.tone]}`}>
            {result.risk.toFixed(1)}<span className="text-sm">%</span>
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-600">同族群平均</div>
          <div className="text-base font-medium">{result.populationAvg.toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-xs text-slate-600">倍數差</div>
          <div className="text-base font-medium">{result.multipleDiff.toFixed(2)}×</div>
        </div>
      </div>
    </div>
  );
}
