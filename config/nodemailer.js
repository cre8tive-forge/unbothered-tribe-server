import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from 'dotenv'
import nodemailer from 'nodemailer'
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatePath = path.join(
  __dirname,
  "../templates/email-code-template.html"
);

export const htmlTemplate = fs.readFileSync(templatePath, "utf-8");
export const mailOptions = {
  from: `Cre8tive Forge <${process.env.MAIL_USERNAME}>`,
};
export const code = Math.floor(100000 + Math.random() * 900000).toString();
export const expires_at = new Date(Date.now() + 10 * 60 * 1000);

export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
  },
});
