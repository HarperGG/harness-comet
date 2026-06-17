import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import type { Browser, BrowserContext, Page, Request } from "playwright";
import { chromium, firefox, webkit } from "playwright";
import type { HarnessAdapter, RunContext } from "@hapergg/harness-comet-sdk";
import type { JsonValue } from "@hapergg/harness-comet-schema";

interface PlaywrightState {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  server?: ChildProcess;
  requests: Request[];
  consoleErrors: string[];
  pageErrors: string[];
}

const stateByRun = new WeakMap<RunContext, PlaywrightState>();
const redactedHeaders = new Set(["authorization", "cookie", "set-cookie", "x-api-key"]);
const evaluateFns = new Map<
  string,
  (page: Page, arg: JsonValue) => Promise<JsonValue> | JsonValue
>();

export function registerEvaluateFunction(
  name: string,
  fn: (page: Page, arg: JsonValue) => Promise<JsonValue> | JsonValue
): void {
  evaluateFns.set(name, fn);
}

export async function getPlaywrightBrowserDiagnostics(
  browserName: "chromium" | "firefox" | "webkit" = "chromium"
): Promise<{
  browser: "chromium" | "firefox" | "webkit";
  executablePath: string;
  installed: boolean;
  installCommand: string;
  issues: string[];
}> {
  const browserType =
    browserName === "firefox" ? firefox : browserName === "webkit" ? webkit : chromium;
  const executablePath = browserType.executablePath();
  const issues: string[] = [];
  let installed = false;
  try {
    await fs.access(executablePath);
    installed = true;
  } catch {
    installed = false;
    issues.push(`missing browser executable: ${executablePath}`);
  }

  if (installed && browserName === "chromium") {
    const frameworkPath = chromiumFrameworkPath(executablePath);
    if (frameworkPath) {
      try {
        await fs.access(frameworkPath);
      } catch {
        installed = false;
        issues.push(`missing Chromium framework: ${frameworkPath}`);
      }
    }

    const headlessShellPath = chromiumHeadlessShellPath(executablePath);
    try {
      await fs.access(headlessShellPath);
    } catch {
      installed = false;
      issues.push(`missing Chromium headless shell: ${headlessShellPath}`);
    }
  }

  return {
    browser: browserName,
    executablePath,
    installed,
    installCommand:
      "rm -rf ~/Library/Caches/ms-playwright/chromium-1200 ~/Library/Caches/ms-playwright/chromium_headless_shell-1200 && pnpm setup:browsers",
    issues
  };
}

function chromiumFrameworkPath(executablePath: string): string | undefined {
  const match = executablePath.match(/(.*\.app)\/Contents\/MacOS\/Google Chrome for Testing$/);
  if (!match) return undefined;
  const appPath = match[1];
  const version = executablePath.match(/143\.0\.\d+\.\d+/)?.[0];
  if (!version) return `${appPath}/Contents/Frameworks`;
  return `${appPath}/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/${version}/Google Chrome for Testing Framework`;
}

function chromiumHeadlessShellPath(executablePath: string): string {
  if (executablePath.includes("/chromium-") && executablePath.includes("chrome-mac-arm64")) {
    return executablePath
      .replace("/chromium-", "/chromium_headless_shell-")
      .replace(
        "/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
        "/chrome-headless-shell-mac-arm64/chrome-headless-shell"
      );
  }
  if (executablePath.includes("/chromium-") && executablePath.includes("chrome-mac/")) {
    return executablePath
      .replace("/chromium-", "/chromium_headless_shell-")
      .replace(
        "/chrome-mac/Chromium.app/Contents/MacOS/Chromium",
        "/chrome-headless-shell-mac/chrome-headless-shell"
      );
  }
  return executablePath
    .replace("/chromium-", "/chromium_headless_shell-")
    .replace(/\/(chrome|chromium)[^/]*\/.*$/, "/chrome-headless-shell");
}

function object(input: JsonValue): Record<string, JsonValue> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return input;
}

function getState(context: RunContext): PlaywrightState {
  const state = stateByRun.get(context);
  if (!state?.page) throw new Error("Playwright page is not initialized");
  return state;
}

function page(context: RunContext): Page {
  return getState(context).page!;
}

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      redactedHeaders.has(key.toLowerCase()) ? "[REDACTED]" : value
    ])
  );
}

async function waitForUrl(url: string, timeoutMs: number): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return true;
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

export function createPlaywrightAdapter(
  options: {
    browser?: "chromium" | "firefox" | "webkit";
    headless?: boolean;
    baseUrl?: string;
    viewport?: { width: number; height: number };
    locale?: string;
    timezoneId?: string;
    webServer?: { command: string; url: string; timeoutMs?: number; reuseExistingServer?: boolean };
  } = {}
): HarnessAdapter {
  return {
    name: "playwright",
    async setup(context) {
      const state: PlaywrightState = { requests: [], consoleErrors: [], pageErrors: [] };
      const webServer = options.webServer;
      if (webServer) {
        const reachable = await waitForUrl(webServer.url, 1_000);
        if (!reachable || !webServer.reuseExistingServer) {
          state.server = spawn(webServer.command, {
            shell: true,
            cwd: context.projectRoot,
            stdio: "ignore"
          });
          const ready = await waitForUrl(webServer.url, webServer.timeoutMs ?? 120_000);
          if (!ready) throw new Error(`Web server did not become ready: ${webServer.url}`);
        }
      }
      const browserType =
        options.browser === "firefox" ? firefox : options.browser === "webkit" ? webkit : chromium;
      state.browser = await browserType.launch({ headless: options.headless ?? true });
      state.context = await state.browser.newContext({
        viewport: options.viewport ?? { width: 1280, height: 720 },
        locale: options.locale ?? "en-US",
        timezoneId: options.timezoneId ?? "UTC"
      });
      state.page = await state.context.newPage();
      state.page.on("request", (request) => state.requests.push(request));
      state.page.on("console", (message) => {
        if (message.type() === "error") state.consoleErrors.push(message.text());
      });
      state.page.on("pageerror", (error) => state.pageErrors.push(error.message));
      stateByRun.set(context, state);
    },
    async teardown(context) {
      const state = stateByRun.get(context);
      await state?.context?.close().catch(() => undefined);
      await state?.browser?.close().catch(() => undefined);
      state?.server?.kill();
      stateByRun.delete(context);
    },
    actions: {
      "page.goto": {
        async execute(input, context) {
          const url = String(object(input).url ?? object(input).path ?? "/");
          await page(context).goto(url.startsWith("http") ? url : `${options.baseUrl ?? ""}${url}`);
          return {};
        }
      },
      "page.reload": {
        async execute(_input, context) {
          await page(context).reload();
          return {};
        }
      },
      "page.click": {
        async execute(input, context) {
          await page(context)
            .locator(String(object(input).selector))
            .click();
          return {};
        }
      },
      "page.fill": {
        async execute(input, context) {
          const data = object(input);
          await page(context)
            .locator(String(data.selector))
            .fill(String(data.value ?? ""));
          return {};
        }
      },
      "page.press": {
        async execute(input, context) {
          const data = object(input);
          await page(context).locator(String(data.selector)).press(String(data.key));
          return {};
        }
      },
      "page.selectOption": {
        async execute(input, context) {
          const data = object(input);
          await page(context).locator(String(data.selector)).selectOption(String(data.value));
          return {};
        }
      },
      "page.check": {
        async execute(input, context) {
          await page(context)
            .locator(String(object(input).selector))
            .check();
          return {};
        }
      },
      "page.uncheck": {
        async execute(input, context) {
          await page(context)
            .locator(String(object(input).selector))
            .uncheck();
          return {};
        }
      },
      "page.waitFor": {
        async execute(input, context) {
          const data = object(input);
          if (data.selector) await page(context).locator(String(data.selector)).waitFor();
          else await page(context).waitForTimeout(Number(data.timeoutMs ?? 1000));
          return {};
        }
      },
      "page.evaluate": {
        async execute(input, context) {
          const data = object(input);
          const fn = evaluateFns.get(String(data.name));
          if (!fn) throw new Error(`Evaluate function is not registered: ${String(data.name)}`);
          return { value: await fn(page(context), data.arg ?? null) };
        }
      }
    },
    inspectors: {
      "page.url": {
        async inspect(_input, context) {
          return page(context).url();
        }
      },
      "page.title": {
        async inspect(_input, context) {
          return await page(context).title();
        }
      },
      "page.text": {
        async inspect(input, context) {
          return await page(context)
            .locator(String(object(input).selector))
            .innerText();
        }
      },
      "page.inputValue": {
        async inspect(input, context) {
          return await page(context)
            .locator(String(object(input).selector))
            .inputValue();
        }
      },
      "page.attribute": {
        async inspect(input, context) {
          const data = object(input);
          return await page(context).locator(String(data.selector)).getAttribute(String(data.name));
        }
      },
      "page.visible": {
        async inspect(input, context) {
          return await page(context)
            .locator(String(object(input).selector))
            .isVisible();
        }
      },
      "page.count": {
        async inspect(input, context) {
          return await page(context)
            .locator(String(object(input).selector))
            .count();
        }
      },
      "page.request": {
        async inspect(input, context) {
          const data = object(input);
          const state = getState(context);
          const matches = state.requests.filter((request) => {
            const urlOk = data.urlPattern ? request.url().includes(String(data.urlPattern)) : true;
            const methodOk = data.method
              ? request.method() === String(data.method).toUpperCase()
              : true;
            return urlOk && methodOk;
          });
          const request = matches[Number(data.index ?? matches.length - 1)];
          if (!request) return null;
          const headers = redactHeaders(request.headers());
          const result: Record<string, JsonValue> = {
            url: request.url(),
            method: request.method(),
            headers,
            postData: request.postData()
          };
          try {
            result.json = request.postDataJSON() as JsonValue;
          } catch {
            result.json = null;
          }
          return data.field ? (result[String(data.field)] ?? null) : result;
        }
      },
      "page.consoleErrors": {
        async inspect(_input, context) {
          return getState(context).consoleErrors;
        }
      },
      "page.pageErrors": {
        async inspect(_input, context) {
          return getState(context).pageErrors;
        }
      }
    }
  };
}

export default createPlaywrightAdapter();
