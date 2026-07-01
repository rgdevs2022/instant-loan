"use strict";

/*
  MyCashBridge Instant Loan — Standalone Server
  ═══════════════════════════════════════════════════════════════
  Serves the frontend static files AND mock API endpoints from
  a single process. Designed for:
    • Local development  : node server.js  (or npm run dev)
    • Subdomain deploy   : instantloan.mycashbridge.com

  Architecture (mock → real API swap):
  ────────────────────────────────────
  Every API route is thin — it calls a service function.
  To connect real banking APIs later, replace only the service
  functions in /src/services/. The routes and frontend never change.

  API endpoints:
    POST /api/otp/send          — send OTP (mock: always succeeds)
    POST /api/otp/verify        — verify OTP (mock OTP: 123456)
    POST /api/eligibility/check — check eligibility (mock offers)
    POST /api/application/submit— submit application (mock)
    GET  /api/application/status— track application (mock)
    GET  /health                — health check

  Environment (.env):
    PORT=8080
    NODE_ENV=development
    ALLOWED_ORIGIN=http://localhost:8080
*/

require("dotenv").config();

const path    = require("path");
const express = require("express");
const helmet  = require("helmet");
const cors    = require("cors");
const rateLimit = require("express-rate-limit");

const PORT           = parseInt(process.env.PORT, 10) || 8080;
const NODE_ENV       = process.env.NODE_ENV || "development";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:" + PORT;

const app = express();
app.set("trust proxy", 1);

/* ── Security headers ──────────────────────────────────────────────────────── */
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === "production" ? {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:     ["'self'", "https://fonts.gstatic.com"],
      imgSrc:      ["'self'", "data:", "https:"],
      connectSrc:  ["'self'"],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
    },
  } : false,   /* disabled in development for easy local testing */
  crossOriginEmbedderPolicy: false,
}));

/* ── CORS ──────────────────────────────────────────────────────────────────── */
app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
}));

/* ── Body parsing ──────────────────────────────────────────────────────────── */
app.use(express.json({ limit: "16kb" }));

/* ── Rate limiting ─────────────────────────────────────────────────────────── */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   /* 15 minutes */
  max: 60,                     /* max 60 API calls per window per IP */
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
app.use("/api/", apiLimiter);

/* ── Serve static frontend files ───────────────────────────────────────────── */
app.use(express.static(path.join(__dirname), {
  setHeaders: function (res, filePath) {
    if (filePath.endsWith(".html")) {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "no-cache");
    }
    if (filePath.endsWith(".css") || filePath.endsWith(".js")) {
      res.setHeader("Cache-Control", "public, max-age=3600");
    }
  },
}));

/* ══════════════════════════════════════════════════════════════════════════════
   MOCK SERVICES
   ══════════════════════════════════════════════════════════════════════════════
   Each service exposes the same interface as the real API will.
   Future: replace these functions with HTTP calls to bank/NBFCs APIs.
   ══════════════════════════════════════════════════════════════════════════════ */

/* In-memory store for demo applications (resets on server restart) */
const applicationStore = new Map();

/**
 * OtpService (mock)
 * Future: integrate Twilio / MSG91 / Kaleyra for real OTP
 */
const OtpService = {
  MOCK_OTP: "123456",
  /** @param {string} mobile */
  sendOTP: function (mobile) {
    /* In production: call SMS provider API here */
    console.log("[OTP] Sent mock OTP " + this.MOCK_OTP + " to +" + mobile);
    return Promise.resolve({ success: true, message: "OTP sent successfully." });
  },
  /** @param {string} mobile @param {string} otp */
  verifyOTP: function (mobile, otp) {
    if (otp === this.MOCK_OTP) {
      return Promise.resolve({ success: true, message: "Verified." });
    }
    return Promise.resolve({ success: false, message: "Invalid OTP. Please try again." });
  },
};

/**
 * EligibilityService (mock)
 * Future: integrate bank FLDG / CIBIL / Bureau APIs
 */
const EligibilityService = {
  BANKS: [
    { id:"hdfc",     name:"HDFC Bank",           baseRate:18.00, maxAmt:300000, minAmt:10000, feeRange:[1.5,2.5],  tenures:[12,18,24,36] },
    { id:"icici",    name:"ICICI Bank",           baseRate:19.50, maxAmt:300000, minAmt:10000, feeRange:[2.0,3.0],  tenures:[12,18,24,36] },
    { id:"axis",     name:"Axis Bank",            baseRate:21.00, maxAmt:250000, minAmt:10000, feeRange:[2.0,3.5],  tenures:[12,18,24,36] },
    { id:"kotak",    name:"Kotak Mahindra Bank",  baseRate:22.00, maxAmt:300000, minAmt:10000, feeRange:[1.5,2.5],  tenures:[12,24,36]    },
    { id:"idfc",     name:"IDFC FIRST Bank",      baseRate:24.00, maxAmt:250000, minAmt:10000, feeRange:[2.0,4.0],  tenures:[12,18,24,36] },
    { id:"federal",  name:"Federal Bank",         baseRate:28.00, maxAmt:200000, minAmt:10000, feeRange:[2.5,4.0],  tenures:[12,18,24]    },
    { id:"indusind", name:"IndusInd Bank",        baseRate:30.00, maxAmt:200000, minAmt:10000, feeRange:[3.0,4.25], tenures:[12,18,24]    },
    { id:"yes",      name:"YES Bank",             baseRate:36.00, maxAmt:150000, minAmt:10000, feeRange:[3.0,4.25], tenures:[12,18,24]    },
  ],

  _det: function (seed, min, max) {
    var v = ((seed * 9301 + 49297) % 233280) / 233280;
    return min + v * (max - min);
  },

  _emi: function (P, rate, n) {
    var r = rate / 12 / 100;
    if (r === 0) return Math.round(P / n);
    return Math.round(P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
  },

  /** @param {{ fullName, loanAmount, employmentType, monthlyIncome, pincode }} profile */
  checkEligibility: function (profile) {
    var income   = parseInt(profile.monthlyIncome, 10) || 30000;
    var reqAmt   = parseInt(profile.loanAmount, 10)    || 100000;
    var multi    = profile.employmentType === "Salaried" ? 20 : 14;
    var maxByInc = income * multi;

    var offers = this.BANKS.map(function (bank) {
      var seed = 0;
      for (var i = 0; i < bank.name.length; i++) seed += bank.name.charCodeAt(i);

      var cap   = Math.min(maxByInc, bank.maxAmt, reqAmt * 1.2);
      var rawAmt = cap - EligibilityService._det(seed + 1, 0, 30000);
      var eligible = Math.max(bank.minAmt, Math.round(rawAmt / 5000) * 5000);

      var rate    = parseFloat((bank.baseRate + EligibilityService._det(seed + 2, 0, 1.25)).toFixed(2));
      var tidx    = Math.floor(EligibilityService._det(seed + 3, 0, bank.tenures.length - 0.01));
      var tenure  = bank.tenures[Math.min(tidx, bank.tenures.length - 1)];
      if (income > 50000 && bank.tenures.length > 2) tenure = bank.tenures[bank.tenures.length - 2];

      var feeR    = EligibilityService._det(seed + 4, bank.feeRange[0], bank.feeRange[1]);
      var fee     = Math.max(500, Math.round(eligible * feeR / 100 / 100) * 100);
      var emi     = EligibilityService._emi(eligible, rate, tenure);

      return {
        bankId:         bank.id,
        bankName:       bank.name,
        eligibleAmount: eligible,
        interestRate:   rate,
        tenureMonths:   tenure,
        processingFee:  fee,
        monthlyEmi:     emi,
        tag:            "",
      };
    });

    offers.sort(function (a, b) {
      var d = a.interestRate - b.interestRate;
      return Math.abs(d) > 0.01 ? d : b.eligibleAmount - a.eligibleAmount;
    });
    if (offers.length > 0) offers[0].tag = "Best Offer";
    if (offers.length > 1) offers[1].tag = "Lowest Rate";

    return Promise.resolve({ offers: offers });
  },
};

/**
 * ApplicationService (mock)
 * Future: route to selected lender's loan origination API
 */
const ApplicationService = {
  submit: function (application) {
    var appId = "MCB" + new Date().getFullYear() + String(Date.now()).slice(-5);
    var record = {
      applicationId:   appId,
      mobile:          application.mobile,
      bank:            application.selectedBank || "MyCashBridge",
      status:          "Submitted",
      createdAt:       new Date().toISOString(),
      profile:         application.profile,
      offer:           application.offer,
    };
    applicationStore.set(appId, record);
    console.log("[Application] Submitted:", appId, "| Bank:", record.bank);
    return Promise.resolve({
      success:          true,
      applicationId:    appId,
      status:           "Submitted",
      bank:             record.bank,
      estimatedCallback: "30 minutes – 2 hours*",
    });
  },

  getStatus: function (appId, mobile) {
    var stored = applicationStore.get(appId) || null;
    if (stored && stored.mobile.replace(/\D/g, "").slice(-10) !== mobile.replace(/\D/g, "").slice(-10)) {
      return Promise.reject(new Error("Application ID and mobile number do not match."));
    }
    return Promise.resolve({
      applicationId: appId,
      bank:          stored ? stored.bank : "HDFC Bank",
      currentStage:  "Verification Pending",
      stages: [
        { key:"submitted",    label:"Application Submitted", icon:"send",        done:true,  active:false, date:"Today" },
        { key:"received",     label:"Bank Received",         icon:"landmark",    done:true,  active:false, date:"Today" },
        { key:"verification", label:"Verification Pending",  icon:"scan-search", done:false, active:true,  date:"In progress — 30 min to 2 hrs*" },
        { key:"review",       label:"Under Review",          icon:"file-search", done:false, active:false, date:"Pending" },
        { key:"approved",     label:"Approved",              icon:"badge-check", done:false, active:false, date:"Pending" },
        { key:"disbursed",    label:"Disbursed",             icon:"banknote",    done:false, active:false, date:"Within 30 min – 2 hrs*" },
      ],
    });
  },
};

/* ══════════════════════════════════════════════════════════════════════════════
   API ROUTES
   ══════════════════════════════════════════════════════════════════════════════ */

/* Health check */
app.get("/health", function (req, res) {
  res.json({ status: "ok", service: "instantloan-mcb", ts: new Date().toISOString() });
});

/* POST /api/otp/send */
app.post("/api/otp/send", function (req, res) {
  var mobile = (req.body.mobile || "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(mobile)) {
    return res.status(400).json({ success: false, message: "Invalid mobile number." });
  }
  OtpService.sendOTP(mobile)
    .then(function (r) { res.json(r); })
    .catch(function (e) { res.status(500).json({ success: false, message: "Could not send OTP." }); });
});

/* POST /api/otp/verify */
app.post("/api/otp/verify", function (req, res) {
  var mobile = (req.body.mobile || "").replace(/\D/g, "").slice(-10);
  var otp    = String(req.body.otp || "").trim();
  if (!mobile || !otp) {
    return res.status(400).json({ success: false, message: "Mobile and OTP are required." });
  }
  OtpService.verifyOTP(mobile, otp)
    .then(function (r) { res.json(r); })
    .catch(function (e) { res.status(500).json({ success: false, message: "Verification failed." }); });
});

/* POST /api/eligibility/check */
app.post("/api/eligibility/check", function (req, res) {
  var profile = req.body || {};
  if (!profile.monthlyIncome || !profile.employmentType) {
    return res.status(400).json({ success: false, message: "Profile is incomplete." });
  }
  EligibilityService.checkEligibility(profile)
    .then(function (r) { res.json(r); })
    .catch(function (e) { res.status(500).json({ success: false, message: "Eligibility check failed." }); });
});

/* POST /api/application/submit */
app.post("/api/application/submit", function (req, res) {
  var body = req.body || {};
  if (!body.mobile) {
    return res.status(400).json({ success: false, message: "Mobile is required." });
  }
  ApplicationService.submit(body)
    .then(function (r) { res.json(r); })
    .catch(function (e) { res.status(500).json({ success: false, message: "Submission failed." }); });
});

/* GET /api/application/status?appId=&mobile= */
app.get("/api/application/status", function (req, res) {
  var appId  = (req.query.appId  || "").trim();
  var mobile = (req.query.mobile || "").trim();
  if (!appId || !mobile) {
    return res.status(400).json({ success: false, message: "appId and mobile are required." });
  }
  ApplicationService.getStatus(appId, mobile)
    .then(function (r) { res.json(r); })
    .catch(function (e) { res.status(404).json({ success: false, message: e.message || "Not found." }); });
});

/* SPA fallback — serve index.html for any unknown route */
app.get("*", function (req, res) {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* ── Start server ──────────────────────────────────────────────────────────── */
app.listen(PORT, function () {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  MyCashBridge Instant Loan Server");
  console.log("  URL   : http://localhost:" + PORT);
  console.log("  Env   : " + NODE_ENV);
  console.log("  OTP   : 123456 (mock)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});

/* Graceful shutdown */
process.on("SIGTERM", function () { process.exit(0); });
process.on("SIGINT",  function () { process.exit(0); });
