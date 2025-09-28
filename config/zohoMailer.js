import axios from "axios";

async function getAccessToken() {
  const res = await axios.post(
    "https://accounts.zoho.com/oauth/v2/token",
    null,
    {
      params: {
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        grant_type: "refresh_token",
      },
    }
  );
  return res.data.access_token;
}

export async function sendEmail({ to, subject, content }) {
  const accessToken = await getAccessToken();

  const response = await axios.post(
    `https://mail.zoho.com/api/accounts/${process.env.ZOHO_USER_EMAIL}/messages`,
    {
      fromAddress: `Househunter <${process.env.ZOHO_USER_EMAIL}>`,
      toAddress: to,
      subject: subject,
      content: content,
    },
    {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
    }
  );

  return response.data;
}
