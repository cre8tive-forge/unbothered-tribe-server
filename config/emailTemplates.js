import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const codeEmailTemplate = fs.readFileSync(
  path.join(__dirname, "../templates/email-code-template.html"),
  "utf-8"
);

export const PasswordChangedMail = fs.readFileSync(
  path.join(__dirname, "../templates/PasswordChangedMail.html"),
  "utf-8"
);
export const adminWelcomeMail = fs.readFileSync(
  path.join(__dirname, "../templates/adminWelcomeMail.html"),
  "utf-8"
);
export const welcomeMail = fs.readFileSync(
  path.join(__dirname, "../templates/welcomeMail.html"),
  "utf-8"
);
export const newslettermail = fs.readFileSync(
  path.join(__dirname, "../templates/newslettermail.html"),
  "utf-8"
);
export const adminNewslettermail = fs.readFileSync(
  path.join(__dirname, "../templates/adminNewslettermail.html"),
  "utf-8"
);
