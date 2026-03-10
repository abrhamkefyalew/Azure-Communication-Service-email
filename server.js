require("dotenv").config();
const express = require("express");
const { EmailClient } = require("@azure/communication-email");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;
const connectionString = process.env.ACS_CONNECTION_STRING;
const senderEmail = process.env.SENDER_EMAIL;

const emailClient = new EmailClient(connectionString);

app.post("/send-email", async (req, res) => {
  try {

    // 1 Check API key in header
    const apiKey = req.headers["x-api-key"];

    if (!apiKey || apiKey !== API_KEY) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    // 2 Read request body
    const { emails, subject, body } = req.body;

    if (!emails || !subject || !body) {
      return res.status(400).json({
        error: "emails, subject and body are required"
      });
    }

    // Convert single email → array
    const emailList = Array.isArray(emails) ? emails : [emails];

    const message = {
      senderAddress: senderEmail,
      content: {
        subject: subject,
        plainText: body, // fallback for email clients that block HTML
        html: body.replace(/\n/g, "<br>") // Convert newlines to <br> for HTML
      },
      recipients: {
        to: emailList.map(e => ({ address: e }))
      }
    };

    console.log("Sending email to:", emailList);

    const poller = await emailClient.beginSend(message);
    const result = await poller.pollUntilDone();

    res.json({
      success: true,
      messageId: result.messageId
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Email sending failed"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Email API running on port ${PORT}`);
});