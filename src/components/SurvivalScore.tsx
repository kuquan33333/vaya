"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";
import { type Purpose } from "@/data/banks";
import { fmtMonthly, monthly } from "@/lib/loanEngine";
import {
  monteCarlo,
  fvShort,
  suggestImprovementsSurv,
  type SurvInput,
  type MCResult,
  type RepayMethod,
  type Suggestion,
} from "@/lib/survival";
import SurvivalChart from "@/components/charts/SurvivalChart";
import Term from "@/components/Term";
import { SURV_FORM_KEY, parseNum as NUM } from "@/lib/savedProfile";

/** Number of Monte-Carlo paths. Shared by the headline simulation and the
 * improvement-suggestion re-simulations so their scores stay comparable. */
const MC_PATHS = 220;

/** Digits only, kept as the raw source of truth in state. */
const DIGITS = (s: string) => (s || "").replace(/\D/g, "");
/** Renders 2000000000 as "2,000,000,000" for readability while typing. */
const GROUPED = (s: string) => {
  const d = DIGITS(s);
  return d ? Number(d).toLocaleString("en-US") : "";
};

const PURP_KEYS: Purpose[] = ["home", "car", "business", "personal", "secured"];
const EMP = [
  ["salaried", "emp_salaried"],
  ["gov", "emp_gov"],
  ["business", "emp_business"],
  ["self", "emp_self"],
  ["freelance", "emp_freelance"],
];
const COL = [
  ["re", "colt_re"],
  ["vehicle", "colt_vehicle"],
  ["savings", "colt_savings"],
  ["none", "colt_none"],
];

export default function SurvivalScore() {
  const { t } = useI18n();
  const sp = useSearchParams();
  const bankParam = sp.get("bank");
  const fromChat = bankParam != null || sp.get("a") != null;

  // Load persisted financial profile from localStorage (NOT pkg/amount/term)
  const saved = useMemo(() => {
    try {
      const raw = localStorage.getItem(SURV_FORM_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const [f, setF] = useState(() => {
    const base = {
      purpose: sp.get("p") || "home",
      amount: sp.get("a") || "2000000000",
      term: sp.get("t") || "240",
      annualRate: sp.get("r") || "",
      income: sp.get("i") || "45000000",
      expenses: fromChat ? "" : "18000000",
      debt: fromChat ? "" : "4000000",
      savings: fromChat ? "" : "150000000",
      down: fromChat ? "" : "600000000",
      dependents: fromChat ? "" : "1",
      employment: fromChat ? "" : "salaried",
      collateral: fromChat ? "" : "re",
      method: "ANNUITY" as RepayMethod,
    };
    // Restore only financial profile fields from localStorage (skip when arriving from chat)
    if (saved && !fromChat) {
      const finKeys = [
        "income",
        "expenses",
        "debt",
        "savings",
        "down",
        "dependents",
        "employment",
        "collateral",
        "annualRate",
      ] as const;
      for (const k of finKeys) {
        if (saved[k] != null) base[k] = saved[k];
      }
    }
    return base;
  });
  const [res, setRes] = useState<{
    mc: MCResult;
    T: number;
    inp: SurvInput;
  } | null>(null);
  const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({});
  const [emiBreakdown, setEmiBreakdown] = useState<{
    emi: number;
    income: number;
    pct: number;
    rate: number;
  } | null>(null);

  // Persist only financial profile to localStorage
  useEffect(() => {
    try {
      const {
        income,
        expenses,
        debt,
        savings,
        down,
        dependents,
        employment,
        collateral,
        annualRate,
      } = f;
      localStorage.setItem(
        SURV_FORM_KEY,
        JSON.stringify({
          income,
          expenses,
          debt,
          savings,
          down,
          dependents,
          employment,
          collateral,
          annualRate,
        }),
      );
    } catch {
      /* noop */
    }
  }, [f]);

  const set = (k: string, v: string) =>
    setF((o: typeof f) => ({ ...o, [k]: v }));

  const run = () => {
    const amount = NUM(f.amount);
    const term = NUM(f.term);
    const income = NUM(f.income);
    const rate = NUM(f.annualRate);

    // Validate inputs — errors keyed to field name
    const fe: Record<string, string> = {};
    let emiBd: typeof emiBreakdown = null;
    if (amount <= 0) fe.amount = t("err_amount_zero");
    if (income <= 0) fe.income = t("err_income_zero");
    if (rate <= 0) fe.annualRate = t("err_rate_zero");
    const emiVal = monthly(amount, rate, Math.max(1, term));
    if (amount > 0 && income > 0 && emiVal > income * 0.9) {
      fe.amount = t("err_emi_income");
      emiBd = { emi: emiVal, income, pct: (emiVal / income) * 100, rate };
    }
    setFieldErrs(fe);
    setEmiBreakdown(emiBd);
    if (Object.keys(fe).length > 0) {
      setRes(null);
      return;
    }

    const inp: SurvInput = {
      pkgIdx: null,
      purpose: f.purpose,
      amount,
      term,
      income,
      expenses: NUM(f.expenses),
      debt: NUM(f.debt),
      savings: NUM(f.savings),
      down: NUM(f.down),
      dependents: NUM(f.dependents),
      employment: f.employment,
      collateral: f.collateral,
      method: f.method as RepayMethod,
      annualRate: rate,
    };
    const T = Math.max(6, Math.min(Math.round(inp.term || 60), 60));
    setRes({ mc: monteCarlo(inp, T, MC_PATHS), T, inp });
  };

  const numField = (label: string, key: keyof typeof f, step: number) => (
    <label className={`fq${fieldErrs[key] ? " fq-err" : ""}`}>
      <span>{t(label)}</span>
      <input
        type="text"
        inputMode="numeric"
        value={GROUPED(f[key])}
        onChange={(e) => set(key, DIGITS(e.target.value))}
      />
      {fieldErrs[key] && <em className="field-err">⚠ {fieldErrs[key]}</em>}
    </label>
  );

  return (
    <section className="pageview on">
      <div className="wrap">
        {/* Two columns on purpose: the intro used to stop at 720px and strand the
            right half of the page, and the score means nothing to a first-time
            reader without knowing what is being simulated. */}
        <div className="surv-hero has-aside">
          <div>
            <span className="sec-tag">{t("nav_surv")}</span>
            <h2>{t("surv_title")}</h2>
            <p>{t("surv_sub")}</p>
          </div>
          <div className="surv-how">
            <div className="glab">{t("sh_title")}</div>
            <ol className="surv-how-l">
              <li>
                <b>{t("sh_1_t")}</b>
                <span>{t("sh_1_d")}</span>
              </li>
              <li>
                <b>{t("sh_2_t")}</b>
                <span>{t("sh_2_d")}</span>
              </li>
              <li>
                <b>{t("sh_3_t")}</b>
                <span>{t("sh_3_d")}</span>
              </li>
            </ol>
          </div>
        </div>
        {fromChat && (
          <div className="surv-notice">{t("surv_from_chat_notice")}</div>
        )}
        <div className="surv-grid">
          <form className="surv-form" onSubmit={(e) => e.preventDefault()}>
            <div className="fgroup">
              <div className="glab">{t("g_loan")}</div>
              <label className="fq">
                <span>{t("q_purpose")}</span>
                <select
                  value={f.purpose}
                  onChange={(e) => {
                    set("purpose", e.target.value);
                  }}
                >
                  {PURP_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {t("f_" + k)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`fq${fieldErrs.annualRate ? " fq-err" : ""}`}>
                <span>{t("surv_rate")}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={f.annualRate}
                  onChange={(e) => set("annualRate", e.target.value)}
                  placeholder="Ví dụ: 8.5"
                />
                {fieldErrs.annualRate && <em className="field-err">⚠ {fieldErrs.annualRate}</em>}
              </label>
              {numField("q_amount", "amount", 10000000)}
              {numField("q_term", "term", 6)}
              <label className="fq">
                <span>{t("ana_method")}</span>
                <select
                  value={f.method}
                  onChange={(e) => set("method", e.target.value)}
                >
                  <option value="ANNUITY">{t("ana_annuity")}</option>
                  <option value="EQUAL_PRINCIPAL">
                    {t("ana_equal_principal")}
                  </option>
                </select>
              </label>
            </div>
            <div className="fgroup">
              <div className="glab">{t("g_income")}</div>
              {numField("q_income", "income", 1000000)}
              {numField("q_expenses", "expenses", 1000000)}
              {numField("q_debt", "debt", 1000000)}
            </div>
            <div className="fgroup">
              <div className="glab">{t("g_buffer")}</div>
              {numField("q_savings", "savings", 10000000)}
              {numField("q_down", "down", 10000000)}
            </div>
            <div className="fgroup">
              <div className="glab">{t("g_profile")}</div>
              {numField("q_dependents", "dependents", 1)}
              <label className="fq">
                <span>{t("q_employment")}</span>
                <select
                  value={f.employment}
                  onChange={(e) => set("employment", e.target.value)}
                >
                  {EMP.map(([v, k]) => (
                    <option key={v} value={v}>
                      {t(k)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="fq">
                <span>{t("q_collateral")}</span>
                <select
                  value={f.collateral}
                  onChange={(e) => set("collateral", e.target.value)}
                >
                  {COL.map(([v, k]) => (
                    <option key={v} value={v}>
                      {t(k)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              className="btn btn-green surv-gen"
              onClick={() => run()}
            >
              {t("surv_gen")}
            </button>
            {emiBreakdown && (
              <div className="emi-flow">
                <div className="emi-flow-title">{t("emi_flow_title")}</div>
                <div className="emi-flow-steps">
                  <div className="emi-step">
                    <span className="emi-step-n">1</span>
                    <span>
                      {t("emi_flow_1")
                        .replace(
                          "{amt}",
                          fvShort(emiBreakdown.emi * Math.max(1, NUM(f.term))),
                        )
                        .replace("{rate}", emiBreakdown.rate.toFixed(1))
                        .replace("{term}", f.term)}
                    </span>
                  </div>
                  <div className="emi-step">
                    <span className="emi-step-n">2</span>
                    <span>
                      {t("emi_flow_2").replace(
                        "{emi}",
                        fmtMonthly(emiBreakdown.emi),
                      )}
                    </span>
                  </div>
                  <div className="emi-step">
                    <span className="emi-step-n">3</span>
                    <span>
                      {t("emi_flow_3")
                        .replace("{inc}", fmtMonthly(emiBreakdown.income))
                        .replace(
                          "{pct}",
                          Math.round(emiBreakdown.pct).toString(),
                        )}
                    </span>
                  </div>
                  <div className="emi-step emi-step-fail">
                    <span className="emi-step-n">✗</span>
                    <span>{t("emi_flow_4")}</span>
                  </div>
                </div>
              </div>
            )}
          </form>

          <div className="surv-result">
            {res ? (
              <Result res={res} t={t} />
            ) : (
              <div className="surv-empty">{t("surv_empty")}</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Result({
  res,
  t,
}: {
  res: { mc: MCResult; T: number; inp: SurvInput };
  t: (k: string) => string;
}) {
  const { mc, T, inp } = res;
  const met = mc.met;
  const suggestions = useMemo(
    () => suggestImprovementsSurv(inp, T, MC_PATHS),
    [inp, T],
  );
  const sc = met.score;
  const vclass = sc >= 70 ? "good" : sc >= 45 ? "ok" : "risk";
  const vlab = sc >= 70 ? t("r_good") : sc >= 45 ? t("r_ok") : t("r_risk");
  // third element is the glossary id — every acronym on this grid gets a
  // plain-language explanation on tap, since DTI/PTI/LTV mean nothing to most
  // first-time borrowers.
  const metrics: [string, string, string][] = [
    ["m_emi", fmtMonthly(met.emi), "emi"],
    ["m_dti", met.dti.toFixed(0) + "%", "dti"],
    ["m_pti", met.pti.toFixed(0) + "%", "pti"],
    ["m_ltv", met.ltv.toFixed(0) + "%", "ltv"],
    ["m_disp", fmtMonthly(met.disposable), "disp"],
    ["m_efr", met.efr.toFixed(1) + " " + t("r_mo"), "efr"],
    ["m_stab", met.stab + "/100", "stab"],
  ];
  const verdict = sc >= 70 ? t("v_yes") : sc >= 45 ? t("v_care") : t("v_no");
  const risks: string[] = [];
  if (met.dti > 45) risks.push(t("risk_dti"));
  if (met.efr < 3) risks.push(t("risk_efr"));
  if (met.disposable < 0) risks.push(t("risk_neg"));
  if (met.ltv > 80) risks.push(t("risk_ltv"));
  if (met.stab < 60) risks.push(t("risk_stab"));
  if (!risks.length) risks.push(t("risk_none"));
  const adjust =
    met.dti > 40 || met.disposable < 0
      ? t("adj_amount")
      : met.ltv > 80
        ? t("adj_down")
        : t("adj_ok");
  const recos: [string, string][] = [
    [t("reco_borrow"), verdict],
    [t("rate"), `${met.rate.toFixed(2)}%/${t("yr")} · ${t("surv_rate_source")}`],
  ];
  recos.push(
    [t("reco_prob"), (mc.ruin * 100).toFixed(1) + "%"],
    [t("reco_risk"), risks.join(" · ")],
    [t("reco_adjust"), adjust],
  );

  return (
    <>
      <div className={"score-head sc-" + vclass}>
        <div className="score-num">{sc}</div>
        <div className="score-meta">
          <div className="score-lab">
            <Term id="score" label={t("r_score")} />
          </div>
          <div className="score-verdict">{vlab}</div>
        </div>
        <div className="score-ruin">
          <span>
            <Term id="ruin" label={t("r_ruin")} />
          </span>
          <b>{(mc.ruin * 100).toFixed(1)}%</b>
        </div>
      </div>
      <div className="rc-clab">{t("r_metrics")}</div>
      <div className="sm-grid">
        {metrics.map((m) => (
          <div className="sm" key={m[0]}>
            <div className="smk">
              <Term id={m[2]} label={t(m[0])} />
            </div>
            <div className="smv">{m[1]}</div>
          </div>
        ))}
      </div>
      <div className="rc-clab">{t("r_chart")}</div>
      <div className="surv-chart">
        <SurvivalChart mc={mc} T={T} t={t} />
      </div>
      <div className="surv-legend">
        <span className="lg lg-med">{t("r_median")}</span>
        <span className="lg lg-band">{t("r_band")}</span>
        <span className="lg lg-stress">{t("r_stress")}</span>
      </div>
      <div className="rc-clab">{t("r_reco")}</div>
      <div className="reco-list">
        {recos.map((r, i) => (
          <div className="reco-i" key={i}>
            <span className="reco-k">{r[0]}</span>
            <span className="reco-v">{r[1]}</span>
          </div>
        ))}
      </div>
      <div className="rc-clab">{t("sc_why")}</div>
      <div className="sc-explain">
        {met.dti > 45 && (
          <p className="sc-reason">
            <b>
              {t("m_dti")} = {met.dti.toFixed(0)}%
            </b>{" "}
            — {t("why_dti")}
          </p>
        )}
        {met.efr < 3 && (
          <p className="sc-reason">
            <b>
              {t("m_efr")} = {met.efr.toFixed(1)} {t("r_mo")}
            </b>{" "}
            — {t("why_efr")}
          </p>
        )}
        {met.disposable < 0 && (
          <p className="sc-reason">
            <b>
              {t("m_disp")} = {fmtMonthly(met.disposable)}
            </b>{" "}
            — {t("why_neg")}
          </p>
        )}
        {met.ltv > 80 && (
          <p className="sc-reason">
            <b>
              {t("m_ltv")} = {met.ltv.toFixed(0)}%
            </b>{" "}
            — {t("why_ltv")}
          </p>
        )}
        {met.stab < 60 && (
          <p className="sc-reason">
            <b>
              {t("m_stab")} = {met.stab}/100
            </b>{" "}
            — {t("why_stab")}
          </p>
        )}
        {mc.ruin > 0.3 && (
          <p className="sc-reason">
            <b>
              {t("r_ruin")} = {(mc.ruin * 100).toFixed(1)}%
            </b>{" "}
            — {t("why_ruin")}
          </p>
        )}
        {met.dti <= 45 &&
          met.efr >= 3 &&
          met.disposable >= 0 &&
          met.ltv <= 80 &&
          met.stab >= 60 &&
          mc.ruin <= 0.3 && (
            <p className="sc-reason sc-ok-msg">{t("why_ok")}</p>
          )}
      </div>

      {/* Improvement suggestions */}
      {suggestions.length > 0 && (
        <>
          <div className="rc-clab">{t("ana_improvements")}</div>
          <div className="ana-improve">
            {suggestions.map((s, i) => (
              <p key={i} className="ana-sug">
                {s.icon} {formatSuggestion(s, t)}
              </p>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function formatSuggestion(s: Suggestion, t: (k: string) => string): string {
  const parts = s.text.split(":");
  const key = parts[0];
  if (key === "extend_term") {
    return t("sug_extend_term")
      .replace("{old}", parts[1])
      .replace("{new}", parts[2])
      .replace("{base}", parts[3])
      .replace("{new_sc}", parts[4]);
  }
  if (key === "reduce_amount") {
    return t("sug_reduce_amount")
      .replace("{pct}", parts[1])
      .replace("{base}", parts[2])
      .replace("{new_sc}", parts[3]);
  }
  if (key === "increase_buffer") {
    return t("sug_increase_buffer")
      .replace("{base}", parts[1])
      .replace("{new_sc}", parts[2]);
  }
  if (key === "switch_method") {
    return t("sug_switch_method")
      .replace("{base}", parts[1])
      .replace("{new_sc}", parts[2]);
  }
  return s.text;
}
