import { describe, expect, test } from "bun:test";
import { BUILTIN_PROVIDER_CATALOG } from "./provider-catalog";
import { getProviderIconSrc } from "./provider-icon";
import { resolveAuthFlow } from "./providers";

describe("provider auth flow resolution", () => {
  test("uses Claude's PKCE OAuth flow instead of import", () => {
    expect(resolveAuthFlow("claude", "oauth")).toBe("oauth");
  });

  test("resolves Grok Build aliases to device flow", () => {
    expect(resolveAuthFlow("grok-build", "oauth")).toBe("device");
    expect(resolveAuthFlow("gb", "oauth")).toBe("device");
  });

  test("publishes Grok Build as a device-code provider", () => {
    const grok = BUILTIN_PROVIDER_CATALOG.find((provider) => provider.id === "grok-cli");
    expect(grok?.authType).toBe("device");
    expect(grok?.authModes).toEqual(["device"]);
  });

  test("keeps Cursor on import flow", () => {
    expect(resolveAuthFlow("cursor", "import")).toBe("import");
  });

  test("uses the Swoosh mark for Agent Router", () => {
    const agentRouter = BUILTIN_PROVIDER_CATALOG.find((provider) => provider.id === "agentrouter");
    expect(agentRouter?.name).toBe("Agent Router");
    expect(getProviderIconSrc("agentrouter")).toBe("/providers/SwooshCustom.svg");
  });

  test("uses the local SumoPod mark", () => {
    const sumopod = BUILTIN_PROVIDER_CATALOG.find((provider) => provider.id === "sumopod");
    expect(sumopod?.name).toBe("SumoPod");
    expect(getProviderIconSrc("sumopod")).toBe("/providers/sumopod.svg");
  });
});
