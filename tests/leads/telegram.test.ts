import { afterEach, describe, expect, it, vi } from "vitest";
import {
  sendTelegramDocument,
  telegramConfigLooksValid,
  verifyTelegramConfiguration,
} from "@/lib/leads/telegram";

const runtime = {
  TELEGRAM_BOT_TOKEN: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
  TELEGRAM_CHAT_ID: "-1001234567890",
};

afterEach(() => vi.restoreAllMocks());

describe("Telegram document delivery", () => {
  it("rejects missing or malformed configuration before any request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    expect(telegramConfigLooksValid({})).toBe(false);
    expect(await verifyTelegramConfiguration({})).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verifies both the bot and destination chat", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { id: 1 } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { id: -1001234567890 } })));
    await expect(verifyTelegramConfiguration(runtime)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/getMe");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/getChat");
  });

  it("sends the original bytes and only accepts Telegram confirmation", async () => {
    const sourceBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02]);
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 77, document: { file_id: "file-77" } } })));
    const result = await sendTelegramDocument(runtime, {
      bytes: sourceBytes.buffer,
      contentType: "image/jpeg",
      fileName: "cccd-front.jpg",
      caption: "privacy-v2",
    });
    expect(result).toEqual({ messageId: 77, fileId: "file-77" });
    const request = fetchMock.mock.calls[0]?.[1];
    expect(request?.method).toBe("POST");
    const form = request?.body as FormData;
    const uploaded = form.get("document");
    expect(uploaded).toBeInstanceOf(Blob);
    expect(Array.from(new Uint8Array(await (uploaded as Blob).arrayBuffer()))).toEqual(Array.from(sourceBytes));
  });
});
