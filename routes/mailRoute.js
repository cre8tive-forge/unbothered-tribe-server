import express from "express";
import axios from "axios";

const router = express.Router();

router.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("No code in query string");

  try {
    const tokenRes = await axios.post(
      "https://accounts.zoho.com/oauth/v2/token",
      null,
      {
        params: {
          client_id: process.env.ZOHO_CLIENT_ID,
          client_secret: process.env.ZOHO_CLIENT_SECRET,
          grant_type: "authorization_code",
          redirect_uri:
            "https://househunter-ng-server-d0b6.onrender.com/api/mail/callback",
          code: code,
        },
      }
    );

    const { access_token, refresh_token } = tokenRes.data;

    console.log("Access Token:", access_token);
    console.log("Refresh Token:", refresh_token);

    res.send("✅ Tokens received. Check your server logs for refresh token.");
  } catch (err) {
    console.error("Error exchanging code:", err.response?.data || err.message);
    res.status(500).send("Error getting tokens");
  }
});

export default router;
