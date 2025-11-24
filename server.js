import express from "express";
import cors from "cors";
import { create } from "@wppconnect-team/wppconnect";

const app = express();
app.use(cors());
app.use(express.json());

let currentQR = null;
let clientRef = null;
let isClientReady = false;

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    clientReady: isClientReady,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/qr", (req, res) => {
  if (!currentQR) {
    return res.status(404).json({ error: "QR code not available yet" });
  }
  return res.json({ qr: currentQR });
});

app.get("/api/status", (req, res) => {
  return res.json({ 
    clientReady: isClientReady,
    hasQR: !!currentQR
  });
});

app.post("/api/send-whatsapp", async (req, res) => {
  try {
    if (!isClientReady || !clientRef) {
      return res.status(503).json({ 
        success: false, 
        error: "WhatsApp client not ready yet" 
      });
    }

    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ 
        success: false, 
        error: "phone & message required" 
      });
    }

    const normalized = phone.replace(/\D/g, "");
    await clientRef.sendText(`${normalized}@c.us`, message);

    return res.json({ success: true });
  } catch (e) {
    console.error("Erro ao enviar:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Configuração otimizada para Railway
const puppeteerOptions = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    '--disable-gpu',
    '--disable-features=AudioService',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--memory-pressure-off'
  ],
  ignoreDefaultArgs: ['--disable-extensions'],
  timeout: 60000
};

// Tenta diferentes caminhos do Chromium
const possibleChromePaths = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome'
];

for (const path of possibleChromePaths) {
  try {
    const fs = await import('fs');
    if (fs.existsSync(path)) {
      puppeteerOptions.executablePath = path;
      console.log(`✅ Usando Chromium em: ${path}`);
      break;
    }
  } catch (e) {
    continue;
  }
}

console.log('🚀 Iniciando WhatsApp com configuração Railway...');

create({
  session: "milhasstudio",
  catchQR: (base64Qr, asciiQR, attempt, urlCode) => {
    console.log("📸 QR Code recebido!");
    currentQR = base64Qr;
  },
  statusFind: (statusSession, session) => {
    console.log('Status Session: ', statusSession);
    console.log('Session name: ', session);
  },
  headless: true,
  devtools: false,
  useChrome: true,
  debug: false,
  logQR: true,
  browserWS: '',
  browserArgs: puppeteerOptions.args,
  puppeteerOptions: puppeteerOptions,
  disableWelcome: true,
  updatesLog: false,
  autoClose: 0
})
  .then((client) => {
    clientRef = client;
    console.log("💚 WhatsApp cliente inicializado!");

    client.onReady(() => {
      console.log("✅ WhatsApp totalmente conectado!");
      isClientReady = true;
      currentQR = null;
    });

    client.onDisconnected((reason) => {
      console.log("❌ WhatsApp desconectado:", reason);
      isClientReady = false;
      clientRef = null;
    });

  })
  .catch((err) => {
    console.error("Erro crítico ao iniciar WhatsApp:", err);
  });

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor online na porta ${PORT}`);
});