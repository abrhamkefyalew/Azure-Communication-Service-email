require("dotenv").config();
const express = require("express");
const { EmailClient } = require("@azure/communication-email");
const winston = require("winston");
require("winston-daily-rotate-file");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;
const connectionString = process.env.ACS_CONNECTION_STRING;
const senderEmail = process.env.SENDER_EMAIL;

const emailClient = new EmailClient(connectionString);

/*
|--------------------------------------------------------------------------
| Helper: Current Time
|--------------------------------------------------------------------------
*/

function now() {
  return new Date().toISOString();
}

/*
|--------------------------------------------------------------------------
| Logger Configuration
|--------------------------------------------------------------------------
*/

const successTransport = new winston.transports.DailyRotateFile({
  dirname: "logs",
  filename: "email-success-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "30d"
});

const errorTransport = new winston.transports.DailyRotateFile({
  dirname: "logs",
  filename: "email-error-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  level: "error",
  maxSize: "20m",
  maxFiles: "30d"
});

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss"
    }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    successTransport,
    errorTransport
  ]
});

/*
|--------------------------------------------------------------------------
| Email Endpoint
|--------------------------------------------------------------------------
*/

app.post("/send-email", async (req, res) => {

  const requestTime = now();

  try {

    logger.info(`Incoming email request at ${requestTime}`);

    const apiKey = req.headers["x-api-key"];

    if (!apiKey || apiKey !== API_KEY) {

      logger.error(`Unauthorized request - Invalid API key - at ${requestTime}`);

      return res.status(401).json({
        success: false,
        time: requestTime,
        error: "Unauthorized - Invalid API key"
      });

    }

    const { emails, subject, body } = req.body;

    if (!emails || !subject || !body) {

      logger.error(`Invalid request body at ${requestTime}`);

      return res.status(400).json({
        success: false,
        time: requestTime,
        error: "emails, subject and body are required"
      });

    }

    const emailList = Array.isArray(emails) ? emails : [emails];

    logger.info(`Preparing email`);
    logger.info(`Recipients: ${emailList.join(", ")}`);
    logger.info(`Subject: ${subject}`);
    logger.info(`Body: ${body}`);

    const message = {
      senderAddress: senderEmail,
      content: {
        subject: subject,
        plainText: body,
        html: body.replace(/\n/g, "<br>")
      },
      recipients: {
        to: emailList.map(e => ({ address: e }))
      }
    };

    logger.info(`Sending email via Azure Communication Services`);

    const poller = await emailClient.beginSend(message);
    const result = await poller.pollUntilDone();

    const successTime = now();

    logger.info(`Email sent successfully at ${successTime}`);
    logger.info(`Message ID: ${result.messageId}`);

    emailList.forEach(email => {
      logger.info(`SUCCESS -> ${email} | subject="${subject}" | body="${body}"`);
    });

    res.json({
      success: true,
      time: successTime,
      recipients: emailList,
      messageId: result.messageId
    });

  } catch (error) {

    const errorTime = now();

    logger.error(`Email sending failed at ${errorTime}`);
    logger.error(error.stack || error.message);

    res.status(500).json({
      success: false,
      time: errorTime,
      error: "Email sending failed"
    });

  }

});

/*
|--------------------------------------------------------------------------
| Server Start
|--------------------------------------------------------------------------
*/

app.listen(PORT, () => {

  const startTime = now();

  logger.info(`Email API started at ${startTime}`);
  logger.info(`Server running on port ${PORT}`);

});