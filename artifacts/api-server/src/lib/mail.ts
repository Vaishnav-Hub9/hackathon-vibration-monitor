import nodemailer from "nodemailer";
import { logger } from "./logger.js";
import { User } from "../models/User.js";

/**
 * Email alert delivery — SMTP via nodemailer, configured from the api-server
 * .env (see .env.example):
 *
 *   SMTP_HOST= smtp.gmail.com        (defaults to Gmail)
 *   SMTP_PORT=587                    (defaults to Gmail STARTTLS)
 *   SMTP_USER=you@gmail.com          (the sending account)
 *   SMTP_PASS=                       (Gmail: an App Password, not the login password)
 *   MAIL_FROM=                       (optional; defaults to SMTP_USER)
 *   MAIL_RECIPIENT=you@gmail.com     (optional; ALWAYS notified in addition to
 *                                     registered users' emails)
 *
 * Recipients are the emails users registered with, plus MAIL_RECIPIENT when
 * set. Delivery is best-effort and fail-soft — if SMTP is unconfigured or a
 * send fails, the alert is logged and the application continues.
 */

/**
 * Credentials are read from process.env at call time (not import time): the
 * api-server calls dotenv.config() AFTER the module graph evaluates, so any
 * const captured here would see an empty environment.
 */
function smtpConfig(): { host: string; port: number; user: string; pass: string; from: string } | null {
  const user = process.env.SMTP_USER ?? "";
  const pass = process.env.SMTP_PASS ?? "";
  if (!user || !pass) return null;
  const port = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);
  return {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number.isFinite(port) ? port : 587,
    user,
    pass,
    from: process.env.MAIL_FROM || user,
  };
}

export function isMailConfigured(): boolean {
  return smtpConfig() !== null;
}

let warnedUnconfigured = false;
function warnUnconfigured(): void {
  if (warnedUnconfigured) return;
  warnedUnconfigured = true;
  logger.warn(
    "Email alerts disabled — set SMTP_USER / SMTP_PASS in the api-server .env to enable delivery.",
  );
}

/** Every address that should receive alerts: registered users + MAIL_RECIPIENT. */
async function recipients(): Promise<string[]> {
  const users = await User.find({ email: { $exists: true, $ne: "" } })
    .select("email alertEmail")
    .lean();
  const addresses = new Set<string>();
  for (const user of users) {
    // Prefer the user's alert email (set in Settings); fall back to the
    // account email they registered with.
    const address = (user.alertEmail || user.email || "").trim().toLowerCase();
    if (address) addresses.add(address);
  }
  const extra = (process.env.MAIL_RECIPIENT ?? "").trim().toLowerCase();
  if (extra) addresses.add(extra);
  return [...addresses].filter(Boolean);
}

export interface MailAlertPayload {
  machineId: string;
  machineName?: string;
  severity: "critical" | "warning";
  message: string;
  technicianSummary?: string;
  prevention?: string[];
  anomalyScore?: number;
  estimatedTimeToFailure?: string | null;
  detectedAt?: Date;
}

/** Plain-text alert body — matches the dashboard warning wording. */
export function buildMailText(payload: MailAlertPayload): string {
  const tag = payload.severity === "critical" ? "[CRITICAL]" : "[WARNING]";
  const machine = `${payload.machineName || payload.machineId} (${payload.machineId})`;
  const lines = [
    `SmartBearing ${tag} - ${machine}`,
    payload.message,
    payload.anomalyScore !== undefined
      ? `Anomaly score: ${payload.anomalyScore.toFixed(2)}`
      : "",
    payload.estimatedTimeToFailure
      ? `Est. time to failure: ${payload.estimatedTimeToFailure}`
      : "",
    payload.technicianSummary ? `Summary: ${payload.technicianSummary}` : "",
  ].filter(Boolean);

  if (payload.prevention && payload.prevention.length > 0) {
    lines.push(`Action: ${payload.prevention.slice(0, 2).join(" ")}`);
  }
  return lines.join("\n");
}

/** Simple HTML version of the same alert. */
function buildMailHtml(payload: MailAlertPayload): string {
  const text = buildMailText(payload);
  const accent = payload.severity === "critical" ? "#dc2626" : "#d97706";
  return [
    `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">`,
    `<div style="background:${accent};color:#fff;padding:12px 16px;font-weight:bold">SmartBearing ${payload.severity.toUpperCase()} Alert</div>`,
    `<pre style="padding:16px;margin:0;font-size:13px;line-height:1.6;white-space:pre-wrap;font-family:Consolas,Menlo,monospace">${text}</pre>`,
    `<div style="padding:8px 16px;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0">Sent by the SmartBearing vibration monitoring system · ${new Date().toUTCString()}</div>`,
    `</div>`,
  ].join("\n");
}

export async function sendMail(to: string, payload: MailAlertPayload): Promise<boolean> {
  const cfg = smtpConfig();
  if (!cfg) return false;

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transporter.sendMail({
      from: cfg.from,
      to,
      subject: `SmartBearing [${payload.severity.toUpperCase()}] ${payload.machineName || payload.machineId} - ${payload.message.slice(0, 60)}`,
      text: buildMailText(payload),
      html: buildMailHtml(payload),
    });
    logger.info({ to }, "Email alert delivered");
    return true;
  } catch (err: any) {
    logger.warn({ to, err: err?.message }, "Email alert send failed");
    return false;
  }
}

/**
 * Fire-and-forget alert delivery to every recipient. Never throws; callers can
 * `void` the promise — alert creation must not depend on email.
 */
export async function notifyMailAlert(payload: MailAlertPayload): Promise<void> {
  if (!isMailConfigured()) {
    warnUnconfigured();
    return;
  }
  for (const to of await recipients()) {
    await sendMail(to, payload);
  }
}
