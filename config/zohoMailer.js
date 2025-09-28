import axios from "axios";

export async function getAccessToken() {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  try {
    const res = await axios.post(
      "https://accounts.zoho.com/oauth/v2/token",
      null,
      {
        params: {
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        },
      }
    );

    return res.data.access_token;
  } catch (err) {
    console.error("Zoho token error:", err.response?.data || err.message);
    throw err;
  }
}

async function getAccountId(accessToken) {
  if (!accessToken) {
    throw new Error("Access Token is required to fetch Account ID.");
  }

  const res = await axios.get("https://mail.zoho.com/api/accounts", {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  if (!res.data.data || res.data.data.length === 0) {
    throw new Error("Could not find any Zoho Mail accounts.");
  }

  return res.data.data[0].accountId;
}
export async function sendEmail({ to, subject, html }) {
  const mailAccessToken = await getAccessToken();
  const accountId = await getAccountId(mailAccessToken);
  const userEmail = process.env.ZOHO_USER_EMAIL; // must match your verified Zoho Mail address

  const response = await axios.post(
    `https://mail.zoho.com/api/accounts/${accountId}/messages`,
    {
      fromAddress: userEmail,
      toAddress: to,

      // ✅ Use flat subject
      subject: subject,

      // ✅ Use 'content' key directly for the HTML string
      content: html,

      // ✅ Use mailFormat to specify it's HTML
      mailFormat: "html",
    },
    {
      headers: {
        Authorization: `Zoho-oauthtoken ${mailAccessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
}