const express = require("express");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================
// WEBSITE
// =============================

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =============================
// QPAY SETTINGS
// =============================

const QPAY_BASE_URL =
  process.env.QPAY_BASE_URL || "https://merchant-sandbox.qpay.mn";

const QPAY_CLIENT_ID = process.env.QPAY_CLIENT_ID;
const QPAY_CLIENT_SECRET = process.env.QPAY_CLIENT_SECRET;
const QPAY_INVOICE_CODE = process.env.QPAY_INVOICE_CODE;
const CALLBACK_URL = process.env.CALLBACK_URL;

// =============================
// GET QPAY ACCESS TOKEN
// =============================

async function getQPayToken() {
  const auth = Buffer.from(
    `${QPAY_CLIENT_ID}:${QPAY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await axios.post(
    `${QPAY_BASE_URL}/v2/auth/token`,
    {},
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data.access_token;
}

// =============================
// CREATE QPAY INVOICE
// =============================

app.post("/api/create-payment", async (req, res) => {
  try {
    const token = await getQPayToken();

    const senderInvoiceNo =
      "MONGOLTEST-" +
      Date.now() +
      "-" +
      Math.floor(Math.random() * 10000);

    const invoice = {
      invoice_code: QPAY_INVOICE_CODE,

      sender_invoice_no: senderInvoiceNo,

      invoice_receiver_code: "MONGOLTEST",

      invoice_description: "MONGOL TEST PREMIUM",

      amount: 2000,

      callback_url: CALLBACK_URL
    };

    const response = await axios.post(
      `${QPAY_BASE_URL}/v2/invoice`,
      invoice,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("QPAY INVOICE CREATED");

    res.json({
      success: true,
      invoice_id: response.data.invoice_id,
      qr_text: response.data.qr_text,
      qr_image: response.data.qr_image,
      urls: response.data.urls
    });

  } catch (error) {

    console.error(
      "QPAY ERROR:",
      error.response?.data || error.message
    );

    res.status(500).json({
      success: false,
      message: "QPay invoice үүсгэхэд алдаа гарлаа.",
      error: error.response?.data || error.message
    });
  }
});

// =============================
// QPAY CALLBACK
// =============================

app.post("/api/qpay/callback", async (req, res) => {

  console.log("QPAY CALLBACK RECEIVED:");
  console.log(req.body);

  try {

    const invoiceId =
      req.body.invoice_id ||
      req.body.invoiceId;

    if (!invoiceId) {
      return res.json({
        success: true,
        message: "Callback received"
      });
    }

    const token = await getQPayToken();

    const response = await axios.post(
      `${QPAY_BASE_URL}/v2/payment/check`,
      {
        object_type: "INVOICE",
        object_id: invoiceId,
        offset: {
          page_number: 1,
          page_limit: 100
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("QPAY PAYMENT CHECK:");
    console.log(response.data);

    res.json({
      success: true
    });

  } catch (error) {

    console.error(
      "CALLBACK ERROR:",
      error.response?.data || error.message
    );

    res.status(500).json({
      success: false
    });
  }
});

// =============================
// MANUAL PAYMENT CHECK
// =============================

app.get("/api/check-payment/:invoiceId", async (req, res) => {

  try {

    const token = await getQPayToken();

    const response = await axios.post(
      `${QPAY_BASE_URL}/v2/payment/check`,
      {
        object_type: "INVOICE",
        object_id: req.params.invoiceId,
        offset: {
          page_number: 1,
          page_limit: 100
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json(response.data);

  } catch (error) {

    console.error(
      "PAYMENT CHECK ERROR:",
      error.response?.data || error.message
    );

    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

// =============================
// START SERVER
// =============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`MONGOL TEST running on port ${PORT}`);
});