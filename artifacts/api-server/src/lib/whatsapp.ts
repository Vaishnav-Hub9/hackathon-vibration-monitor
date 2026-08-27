import { logger } from "./logger.js";

/**
 * whatsapp.ts — WhatsApp alert delivery via Meta WhatsApp Cloud API.
 *
 * This uses Meta's free Cloud API directly — no third-party messaging service
 * or paid Business Account required (the Cloud API test number is free).
 *
 * Required env:
 *   WHATSAPP_ACCESS_TOKEN     — Permanent access token from Meta Business Suite
 *   WHATSAPP_PHONE_NUMBER_ID  — Your WhatsApp phone number ID from Meta (e.g. "6155551234")
 *
 * How to get started (free):
 *   1. Go to https://business.facebook.com → Settings → Apps → Create App
 *   2. Add "WhatsApp" product to the app
 *   3. In WhatsApp → Getting Started: copy the Phone Number ID and generate a permanent token
 *   4. Meta gives you a free test number — add YOUR phone in "To" field and send yourself a message
 *   5. For production: add a real WhatsApp Business number
 *
 * Without these env vars the sender reports unconfigured and callers degrade gracefully.
 */

export interface WhatsAppAlertPayload {
  to: string; // recipient in E.164, e.g. +919876543210
  machineId: string;
  machineName?: string;
  severity: string;
  message: string;
  technicianSummary?: string;
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

function formatAlertText(p: WhatsAppAlertPayload): string {
  const lines = [
    `⚙️ SmartBearing ${p.severity.toUpperCase()} ALERT`,
    `Machine: ${p.machineName || p.machineId} (${p.machineId})`,
    ``,
    p.message,
  ];
  if (p.technicianSummary) {
    lines.push(``, `🧠 Assessment: ${p.technicianSummary}`);
  }
  lines.push(``, `⚠️ Fault predictions are probabilistic — an engineer must confirm before action.`);
  return lines.join("\n");
}

/** Send one WhatsApp text message via Meta Cloud API. Returns true when accepted. */
export async function sendWhatsAppMessage(to: string, text: string): Promise<boolean> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return false;

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/^\+/, ""), // Cloud API strips the leading +
        type: "text",
        text: { body: text },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await res.json().catch(() => ({})) as Record<string, unknown>;

    if (!res.ok) {
      const errMsg = (data as any)?.error?.message || `HTTP ${res.status}`;
      logger.warn({ status: res.status, errMsg, to }, "WhatsApp Cloud API send failed");
      return false;
    }

    logger.info({ to, messageId: (data as any)?.messages?.[0]?.id }, "WhatsApp alert delivered");
    return true;
  } catch (err: any) {
    logger.warn({ err: err?.message, to }, "WhatsApp alert send failed");
    return false;
  }
}

/** Fire-and-forget alert delivery — never throws. */
export async function notifyWhatsAppAlert(p: Omit<WhatsAppAlertPayload, "to"> & { to?: string }): Promise<boolean> {
  const to = p.to || process.env.MESSAGEBIRD_ALERT_TO || process.env.WHATSAPP_ALERT_TO || "";
  if (!isWhatsAppConfigured() || !to) return false;
  try {
    return await sendWhatsAppMessage(to, formatAlertText({ ...p, to }));
  } catch {
    return false;
  }
}
