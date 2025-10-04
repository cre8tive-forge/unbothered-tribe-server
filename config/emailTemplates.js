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
export const kycApprovedMail = fs.readFileSync(
  path.join(__dirname, "../templates/kyc-approved-mail.html"),
  "utf-8"
);
export const listingsubmittedmail = fs.readFileSync(
  path.join(__dirname, "../templates/listing-submitted.html"),
  "utf-8"
);
export const listingApprovedMail = fs.readFileSync(
  path.join(__dirname, "../templates/listing-approved.html"),
  "utf-8"
);
export const freePlanMail = fs.readFileSync(
  path.join(__dirname, "../templates/freePlanMail.html"),
  "utf-8"
);
export const paymentSuccessMail = fs.readFileSync(
  path.join(__dirname, "../templates/subscriptionmail.html"),
  "utf-8"
);
export const adSubmissionMail = fs.readFileSync(
  path.join(__dirname, "../templates/adsubmissionmail.html"),
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
