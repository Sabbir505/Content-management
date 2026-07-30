export interface LlmProviderConfig {
  provider: string;
  apiKey: string;
  apiEndpoint: string;
  model: string;
}

export const LLM_PROVIDERS = [
  {
    id: "kimi",
    label: "Kimi (DeepSeek V4 Pro)",
    endpoint: "https://ai2.18.show/v1/chat/completions",
    model: "DeepSeek-V4-Pro",
  },
  {
    id: "openai",
    label: "OpenAI Compatible",
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    endpoint: "https://api.anthropic.com/v1/messages",
    model: "claude-sonnet-4-20250514",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    model: "anthropic/claude-sonnet-4",
  },
] as const;

const STORAGE_KEY = "tubeforge_llm_config";

export function getSavedLlmConfig(): LlmProviderConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LlmProviderConfig;
  } catch {
    return null;
  }
}

export function saveLlmConfig(config: LlmProviderConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearLlmConfig(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function getDefaultConfig(): LlmProviderConfig {
  return {
    provider: "kimi",
    apiKey: "",
    apiEndpoint: "https://ai2.18.show/v1/chat/completions",
    model: "DeepSeek-V4-Pro",
  };
}

export function resolveProviderConfig(
  providerId: string,
  apiKey: string,
  customEndpoint?: string,
  customModel?: string,
): LlmProviderConfig {
  const preset = LLM_PROVIDERS.find((p) => p.id === providerId);
  if (!preset) return getDefaultConfig();
  return {
    provider: providerId,
    apiKey,
    apiEndpoint: customEndpoint?.trim() || preset.endpoint,
    model: customModel?.trim() || preset.model,
  };
}
