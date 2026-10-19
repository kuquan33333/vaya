"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ChatAdvisor from "@/components/ChatAdvisor";

function ChatInner() {
  const params = useSearchParams();
  const q = params.get("q") ?? undefined;
  // `?offer=<offerId>&post=<postId>` opens the advisor in "discuss this offer"
  // mode, scoped to one reverse-auction offer (used by the Marketplace button).
  const offerId = params.get("offer") ?? undefined;
  const postId = params.get("post") ?? undefined;
  // `?restore=<historyId>` reopens an archived conversation from the history
  // index (used by the history panel) exactly as it was saved.
  const restoreId = params.get("restore") ?? undefined;
  // `key` forces a fresh engine instance when the entry point changes.
  const key =
    restoreId != null
      ? "restore:" + restoreId
      : offerId != null
        ? "offer:" + offerId
        : (q ?? "__none__");
  return (
    <ChatAdvisor
      key={key}
      seed={q}
      offerId={offerId}
      postId={postId}
      restoreId={restoreId}
    />
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatInner />
    </Suspense>
  );
}
