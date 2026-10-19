export interface TelegramRuntime {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

export interface TelegramDocumentInput {
  bytes: ArrayBuffer;
  contentType: string;
  fileName: string;
  caption: string;
}

export interface TelegramDocumentResult {
  messageId: number;
  fileId: string | null;
}

interface TelegramResponse<T> {
  ok?: boolean;
  result?: T;
  description?: string;
}

interface TelegramMessage {
  message_id?: number;
  document?: { file_id?: string };
}

function tokenLooksValid(token: string): boolean {
  // Telegram bot tokens are numeric bot ids followed by a colon and an
  // opaque token. This is only a syntax gate; getMe/getChat below are the
  // authoritative configuration check.
  return /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(token);
}

function chatIdLooksValid(chatId: string): boolean {
  return /^-?\d{1,20}$/.test(chatId) || /^@[A-Za-z0-9_]{5,}$/.test(chatId);
}

export function telegramConfigLooksValid(runtime: TelegramRuntime): boolean {
  const token = runtime.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const chatId = runtime.TELEGRAM_CHAT_ID?.trim() ?? "";
  return tokenLooksValid(token) && chatIdLooksValid(chatId);
}

function apiUrl(token: string, method: string): string {
  return `https://api.telegram.org/bot${encodeURIComponent(token)}/${method}`;
}

async function callTelegram<T>(token: string, method: string, body: BodyInit): Promise<TelegramResponse<T>> {
  const response = await fetch(apiUrl(token, method), {
    method: "POST",
    body,
  });
  let payload: TelegramResponse<T> = {};
  try {
    payload = (await response.json()) as TelegramResponse<T>;
  } catch {
    payload = {};
  }
  if (!response.ok || payload.ok !== true) {
    throw new Error(`telegram_${method}_failed`);
  }
  return payload;
}

/**
 * Check both the bot token and the destination before reading an uploaded
 * image. This prevents accepting a sensitive file when Telegram is missing,
 * malformed, or the bot cannot reach the configured chat.
 */
export async function verifyTelegramConfiguration(runtime: TelegramRuntime): Promise<boolean> {
  if (!telegramConfigLooksValid(runtime)) return false;
  const token = runtime.TELEGRAM_BOT_TOKEN!.trim();
  const chatId = runtime.TELEGRAM_CHAT_ID!.trim();
  try {
    await callTelegram<{ id?: number }>(token, "getMe", new URLSearchParams());
    await callTelegram<unknown>(token, "getChat", new URLSearchParams({ chat_id: chatId }));
    return true;
  } catch {
    return false;
  }
}

/** Send the original bytes without resizing, recompression, or metadata rewriting. */
export async function sendTelegramDocument(
  runtime: TelegramRuntime,
  input: TelegramDocumentInput,
): Promise<TelegramDocumentResult> {
  if (!telegramConfigLooksValid(runtime)) throw new Error("telegram_not_configured");
  const token = runtime.TELEGRAM_BOT_TOKEN!.trim();
  const chatId = runtime.TELEGRAM_CHAT_ID!.trim();
  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("caption", input.caption);
  form.append("document", new Blob([input.bytes], { type: input.contentType }), input.fileName);
  const payload = await callTelegram<TelegramMessage>(token, "sendDocument", form);
  const messageId = payload.result?.message_id;
  if (typeof messageId !== "number") throw new Error("telegram_sendDocument_missing_message_id");
  return { messageId, fileId: payload.result?.document?.file_id ?? null };
}

/** Best-effort deletion; Telegram retention and chat permissions can prevent revocation. */
export async function deleteTelegramMessage(runtime: TelegramRuntime, messageId: number): Promise<boolean> {
  if (!telegramConfigLooksValid(runtime)) return false;
  try {
    const payload = await callTelegram<boolean>(
      runtime.TELEGRAM_BOT_TOKEN!.trim(),
      "deleteMessage",
      new URLSearchParams({ chat_id: runtime.TELEGRAM_CHAT_ID!.trim(), message_id: String(messageId) }),
    );
    return payload.result === true;
  } catch {
    return false;
  }
}
