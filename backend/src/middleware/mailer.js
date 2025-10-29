// backend/src/middleware/mailer.js
import nodemailer from "nodemailer";
import pool from "../models/db.js";

let transporterPromise = null;

async function buildTransporter() {
  // Use Ethereal if ETHEREAL_USER/PASS are provided
  const useEthereal = (process.env.ETHEREAL_USER && process.env.ETHEREAL_PASS);

  if (useEthereal) {
    if (process.env.ETHEREAL_USER && process.env.ETHEREAL_PASS) {
      const t = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, // STARTTLS
        auth: {
          user: process.env.ETHEREAL_USER,
          pass: process.env.ETHEREAL_PASS,
        },
      });
      return t;
    }
    // Fallback- Auto-generate a dev account
    // const test = await nodemailer.createTestAccount();
    // const t = nodemailer.createTransport({
    //   host: test.smtp.host,
    //   port: test.smtp.port,
    //   secure: test.smtp.secure,
    //   auth: { user: test.user, pass: test.pass },
    // });
    // console.log("[ethereal] user:", test.user);
    // console.log("[ethereal] pass:", test.pass);
    // return t;
  }

}

async function getTransporter() {
  if (!transporterPromise) transporterPromise = buildTransporter();
  return transporterPromise;
}

export async function sendMail(to, subject, text) {
  const transporter = await getTransporter();
  const from =
    process.env.MAIL_FROM ||
    process.env.SMTP_USER ||
    "no-reply@example.test";

  const info = await transporter.sendMail({ from, to, subject, text });

  // If Ethereal is used, print preview URL to console
  const url = nodemailer.getTestMessageUrl(info);
  if (url) {
    console.log("[ethereal] preview:", url);
  }
  return info;
}

export async function getEmailsForGroups(groupsCsv) {
  const wanted = (groupsCsv || [])
    .map((s) => String(s || "").trim().toLowerCase())
    .filter(Boolean);
  if (!wanted.length) return [];

  const [rows] = await pool.query(
    "SELECT email, usergroups FROM accounts WHERE email IS NOT NULL"
  );

  const out = new Set();
  for (const r of rows) {
    const have = String(r.usergroups || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (wanted.some((g) => have.includes(g))) {
      out.add(String(r.email).trim());
    }
  }
  return Array.from(out);
}
