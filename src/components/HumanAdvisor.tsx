"use client";

/**
 * "Talk to a human" hand-off.
 *
 * The hand-off writes a real lead through the same consented registration API
 * as every other CTA. It never displays a success state before D1 accepts it.
 */
import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";
import TurnstileWidget from "./TurnstileWidget";

const TOPICS = ["hm_topic_pkg", "hm_topic_docs", "hm_topic_reject", "hm_topic_other"];

export default function HumanAdvisor() {
  const { t } = useI18n();
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [note, setNote] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const idempotencyKeyRef = useRef<string | null>(null);

  const valid = name.trim().length > 1 && phone.replace(/\D/g, "").length >= 9;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || state === "sending") return;
    setState("sending");
    setError("");
    try {
      const idempotencyKey = idempotencyKeyRef.current ?? (idempotencyKeyRef.current = crypto.randomUUID());
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          fullName: name,
          phone,
          province: "Đà Nẵng",
          loanType: topic,
          note: note || null,
          source: "human",
          consentContact: true,
          consentProcessingNotice: true,
          consentDocumentUpload: false,
          turnstileToken,
        }),
      });
      if (!response.ok) throw new Error("Không thể lưu yêu cầu. Vui lòng thử lại hoặc mở form đăng ký.");
      setState("sent");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Không thể lưu yêu cầu.");
      setState("error");
    }
  };

  return (
    <section className="pageview on">
      <div className="wrap">
        <button className="linkback" onClick={() => router.push("/chat")}>
          {t("hm_back")}
        </button>

        <div className="surv-hero has-aside">
          <div>
            <span className="sec-tag">{t("hm_tag")}</span>
            <h2>{t("hm_title")}</h2>
            <p>{t("hm_sub")}</p>
          </div>
          <div className="hm-hours">
            <div className="glab">{t("hm_hours_lab")}</div>
            <p>{t("hm_hours_pending")}</p>
          </div>
        </div>

        <div className="hm-banner">
          <span className="hm-dot" />
          <div>
            <b>{t("hm_intake_t")}</b>
            <p>{t("hm_intake_d")}</p>
          </div>
          <button className="btn btn-green btn-sm" onClick={() => router.push("/chat")}>
            {t("hm_use_ai")}
          </button>
        </div>

        <div className="hm-layout">
          <div>
            <div className="rc-clab">{t("hm_team")}</div>
            <div className="hm-team">
              <div className="hm-agent">
                <span className="hm-av">👥</span>
                <div className="hm-who">
                  <b>{t("hm_staff_desk")}</b>
                  <small>{t("hm_staff_scope")}</small>
                </div>
                <span className="hm-status"><i /> {t("hm_staff_status")}</span>
              </div>
            </div>
            <p className="chk-hint">{t("hm_note")}</p>
          </div>

          <div className="hm-form-card">
            <div className="rc-clab">{t("hm_cb_title")}</div>
            {state === "sent" ? (
              <div className="hm-done">
                <div className="hm-done-ic">✓</div>
                <b>{t("hm_done_t")}</b>
                <p>{t("hm_done_d").replace("{phone}", phone)}</p>
                <div className="hm-done-act">
                  <button className="btn btn-ghost btn-sm" onClick={() => setState("idle")}>
                    {t("hm_done_again")}
                  </button>
                  <button className="btn btn-green btn-sm" onClick={() => router.push("/chat")}>
                    {t("hm_use_ai")}
                  </button>
                </div>
              </div>
            ) : (
              <form className="surv-form hm-form" onSubmit={submit}>
                <label className="fq">
                  <span>{t("hm_f_name")}</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("hm_f_name_ph")} />
                </label>
                <label className="fq">
                  <span>{t("hm_f_phone")}</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="09xx xxx xxx"
                  />
                </label>
                <label className="fq">
                  <span>{t("hm_f_topic")}</span>
                  <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                    {TOPICS.map((k) => (
                      <option value={k} key={k}>
                        {t(k)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="fq">
                  <span>{t("hm_f_note")}</span>
                  <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("hm_f_note_ph")} />
                </label>
                <TurnstileWidget onToken={setTurnstileToken} />
                <button className="btn btn-green" disabled={!valid || state === "sending"}>
                  {state === "sending" ? t("hm_sending") : t("hm_send")}
                </button>
                {error && <p className="form-error">{error}</p>}
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
