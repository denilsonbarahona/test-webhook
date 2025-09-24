// Import Express.js
require("dotenv").config();
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const axios = require("axios");
const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const express = require("express");

// Create an Express app
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Set port and verify_token
const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;

const prompt = `responde a cada mensaje siguiendo una conversacion entre el que envia el mensaje y tu, solo responde en español`;

// Route for GET requests
app.get("/", (req, res) => {
  const {
    "hub.mode": mode,
    "hub.challenge": challenge,
    "hub.verify_token": token,
  } = req.query;

  if (mode === "subscribe" && token === verifyToken) {
    console.log("WEBHOOK VERIFIED");
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});

// Route for POST requests
app.post("/", async (req, res) => {
  const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey: process.env.GOOGLE_API_KEY, // <-- ENV
    temperature: 0,
  });

  const agent = createReactAgent({
    llm,
    tools: [],
    stateModifier: prompt,
  });

  const message =
    req?.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body ||
    "Hola, como estas?";

  const response = await agent.invoke({
    messages: [{ role: "user", content: message }],
  });

  // usar el mismo número que envió el mensaje (wa_id del webhook)
  const waId =
    req.body?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.wa_id ||
    process.env.TEL;

  const url = `https://graph.facebook.com/v22.0/783616344834680/messages`;

  // *** Payload EXACTO que pediste, con 'to' dinámico ***
  const data = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: waId, // <-- mismo número que envió
    type: "text",
    text: {
      body:
        response?.messages?.[response?.messages?.length - 1]?.content ||
        "error de la IA",
    },
  };

  console.log(data, "data");

  const whsResponse = await axios.post(url, data, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, // <-- ENV
    },
  });

  console.log(whsResponse, "whsResponse");

  res.status(200).end();
});

// Start the server
app.listen(port, () => {
  console.log(`\nListening on port ${port}\n`);
});
