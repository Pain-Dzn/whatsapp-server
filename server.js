import express from "express";
import cors from "cors";
import { create } from "@wppconnect-team/wppconnect";

const app = express();
app.use(cors());
app.use(express.json());

let currentQR = null;
let clientRef = null;
let isClientReady = false;

// Health check (OBRIGATÓRIO para Railway)
app.get("/", (req, res) => {
  res.json({ 
    status: "WhatsApp Server Online", 
    clientReady: isClientReady,
    hasQR: !!currentQR,
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "OK" });
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

// Inicializar WhatsApp
create({
  session: "milhasstudio",
  headless: true,
  puppeteerOptions: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  },
  disableWelcome: true
})
  .then((client) => {
    clientRef = client;
    console.log("💚 WhatsApp conectado ou à espera do QR...");

    client.onQRCode((qr) => {
      console.log("📸 QR atualizado!");
      currentQR = qr;
    });

    client.onReady(() => {
      console.log("✅ WhatsApp totalmente conectado!");
      isClientReady = true;
      currentQR = null;
    });

    client.onDisconnected(() => {
      console.log("❌ WhatsApp desconectado");
      isClientReady = false;
      clientRef = null;
    });
  })
  .catch((err) => console.error("Erro ao iniciar:", err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor online na porta ${PORT}`);
});
