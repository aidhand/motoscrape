import { CustomOpenAIClient } from "./llm_clients/customOpenAI_client";
import type { ConstructorParams } from "@browserbasehq/stagehand";
import dotenv from "dotenv";

import { OpenAI } from "openai";

dotenv.config();

const openRouterClient = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const StagehandConfig: ConstructorParams = {
  verbose: 1 /* Verbosity level for logging: 0 = silent, 1 = info, 2 = all */,
  domSettleTimeoutMs: 30_000 /* Timeout for DOM to settle in milliseconds */,

  // LLM configuration
  llmClient: new CustomOpenAIClient({
    modelName: "openai/gpt-4.1-nano",
    client: openRouterClient,
  }),

  // Browser configuration
  env: "LOCAL" /* Environment to run in: LOCAL or BROWSERBASE */,

  localBrowserLaunchOptions: {
    headless: true,
    viewport: {
      width: 1024,
      height: 768,
    },
  } /* Configuration options for the local browser */,
};

export default StagehandConfig;
