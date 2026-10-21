"use client";

/**
 * Email delivery is not claimed until a real transactional email provider is
 * configured. The current safe action generates a local download instead of
 * pretending that an email was sent.
 *
 * The panel stays collapsed until asked for so it never competes with the
 * checklist itself, and the sent state repeats the address back so the user can
 * spot a typo, which is the one thing that actually goes wrong with this flow.
 */
import React, { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

export default function EmailChecklist({ docCount }: { docCount: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "downloaded">("idle");

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const content = `vaytiendanang — danh sách hồ sơ\n\nSố mục hồ sơ: ${docCount}\n\nDanh sách được tạo trên thiết bị của bạn. Hãy kiểm tra yêu cầu chính thức của bên cho vay trước khi nộp.\n`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vaytiendanang-checklist.txt";
    link.click();
    URL.revokeObjectURL(url);
    setState("downloaded");
  };

  if (state === "downloaded") {
    return (
      <div className="mail-card sent">
        <span className="mail-tick">✓</span>
        <div className="mail-body">
          <b>{t("mail_download_done")}</b>
          <p>{t("mail_download_note")}</p>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setState("idle");
            setOpen(false);
          }}
        >
          {t("mail_download_again")}
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button className="mail-open" onClick={() => setOpen(true)}>
        <span className="mail-ic">✉</span>
        <span>
        <b>{t("mail_download")}</b>
          <small>{t("mail_download_sub").replace("{n}", String(docCount))}</small>
        </span>
        <span className="mail-arrow">→</span>
      </button>
    );
  }

  return (
    <form className="mail-card" onSubmit={send}>
      <div className="mail-head">
        <b>{t("mail_download_title")}</b>
        <button type="button" className="mail-x" onClick={() => setOpen(false)} aria-label={t("mail_close")}>
          ×
        </button>
      </div>
      <div className="mail-row">
        <div className="mail-input" style={{ padding: "12px 0" }}>{t("mail_download_note")}</div>
        <button className="btn btn-green">
          {t("mail_download_action")}
        </button>
      </div>
    </form>
  );
}
