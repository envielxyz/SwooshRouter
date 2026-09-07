import { describe, expect, test } from "bun:test";
import {
  generateAuthData,
  getProviderFlowType,
  providerRequiresDeviceCodeVerifier,
  providerUsesPkce,
  resolveProviderName,
} from "./index.js";

describe("OAuth flow contracts", () => {
  test("Claude is an authorization-code PKCE provider", () => {
    expect(getProviderFlowType("claude")).toBe("authorization_code_pkce");
    expect(providerUsesPkce("claude")).toBe(true);
  });

  test("Antigravity is a standard authorization-code provider", () => {
    expect(getProviderFlowType("antigravity")).toBe("authorization_code");
    expect(providerUsesPkce("antigravity")).toBe(false);
  });

  test("Grok Build aliases the no-PKCE Grok CLI device flow", () => {
    expect(resolveProviderName("grok-build")).toBe("grok-cli");
    expect(resolveProviderName("gb")).toBe("grok-cli");
    expect(getProviderFlowType("grok-build")).toBe("device_code");
    expect(getProviderFlowType("gb")).toBe("device_code");
    expect(providerRequiresDeviceCodeVerifier("grok-cli")).toBe(false);
  });

  test("Qoder is the registered device flow with a verifier", () => {
    expect(providerRequiresDeviceCodeVerifier("qoder")).toBe(true);
  });
});

describe("browser OAuth URL contracts", () => {
  test("Claude uses its PKCE callback contract", async () => {
    const auth = await generateAuthData("claude", "http://localhost:14045/callback");
    const url = new URL(auth.authUrl);

    expect(url.origin + url.pathname).toBe("https://claude.ai/oauth/authorize");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:14045/callback");
    expect(url.searchParams.get("code")).toBe("true");
    expect(url.searchParams.get("code_challenge")).toBe(auth.codeChallenge);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe(auth.state);
    expect(auth.codeVerifier).toBeTruthy();
  });

  test("Antigravity uses offline Google OAuth without a PKCE parameter", async () => {
    const auth = await generateAuthData("antigravity", "http://localhost:14045/callback");
    const url = new URL(auth.authUrl);

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:14045/callback");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("code_challenge")).toBe(null);
    expect(url.searchParams.get("state")).toBe(auth.state);
    expect(auth.codeVerifier).toBeUndefined();
  });
});
