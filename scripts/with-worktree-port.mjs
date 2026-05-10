#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const [, , service = "mirror", ...rawArgs] = process.argv;
const printOnly = rawArgs.includes("--print");
const separatorIndex = rawArgs.indexOf("--");
const command =
  separatorIndex >= 0
    ? rawArgs.slice(separatorIndex + 1).filter((arg) => arg !== "--")
    : [];

function git(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  if (result.status !== 0) {
    return "";
  }

  return result.stdout.trim();
}

function repoRoot() {
  const root = git(["rev-parse", "--show-toplevel"]);
  if (!root) {
    throw new Error("Could not resolve git repository root.");
  }

  return fs.realpathSync(root);
}

function mainRoot() {
  const output = git(["worktree", "list", "--porcelain"]);
  let current = "";

  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      current = line.slice("worktree ".length);
    }
    if (line === "branch refs/heads/main") {
      return fs.realpathSync(current);
    }
  }

  return fs.existsSync("/Users/disquiet/Desktop/mirror")
    ? fs.realpathSync("/Users/disquiet/Desktop/mirror")
    : "";
}

function serviceEnvName(name) {
  return `${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_PORT`;
}

function explicitPort(name) {
  const servicePort = process.env[serviceEnvName(name)];
  return servicePort ?? (name === "mirror" ? process.env.PORT : undefined);
}

function hashOffset(value, size) {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 8);
  return Number.parseInt(hex, 16) % size;
}

function registryPath() {
  return path.join(os.tmpdir(), "feel-good-worktree-ports.json");
}

function lockPath() {
  return path.join(os.tmpdir(), "feel-good-worktree-ports.lock");
}

function readRegistry() {
  try {
    return JSON.parse(fs.readFileSync(registryPath(), "utf8"));
  } catch {
    return {};
  }
}

function writeRegistry(registry) {
  fs.writeFileSync(registryPath(), JSON.stringify(registry, null, 2));
}

async function withLock(callback) {
  const lock = lockPath();
  const startedAt = Date.now();

  while (true) {
    try {
      fs.mkdirSync(lock);
      break;
    } catch {
      if (Date.now() - startedAt > 5000) {
        fs.rmSync(lock, { force: true, recursive: true });
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  try {
    return await callback();
  } finally {
    fs.rmSync(lock, { force: true, recursive: true });
  }
}

function canListen(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => {
      resolve(["EADDRNOTAVAIL", "EAFNOSUPPORT"].includes(error.code));
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen({ port, host, exclusive: true });
  });
}

async function isPortFree(port) {
  if (!(await canListen(port, "::"))) {
    return false;
  }

  return canListen(port, "127.0.0.1");
}

function isAssignedToOtherRoot(registry, name, root, port) {
  return Object.entries(registry[name]).some(
    ([otherRoot, entry]) => otherRoot !== root && entry.port === port,
  );
}

function shouldSyncLocalAuthUrl(name, args) {
  return (
    name === "mirror" &&
    args[0] === "next" &&
    ["dev", "start"].includes(args[1]) &&
    process.env.FEEL_GOOD_SKIP_AUTH_URL_SYNC !== "1"
  );
}

function syncLocalAuthUrl(root, port) {
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "scripts/ensure-local-auth-url.mjs"),
      "--port",
      String(port),
    ],
    {
      cwd: root,
      stdio: "inherit",
    },
  );

  if (result.status !== 0) {
    throw new Error(`Failed to sync Convex auth URL for port ${port}.`);
  }
}

function syncLocalAuthUrlOrExit(root, port, child) {
  try {
    syncLocalAuthUrl(root, port);
  } catch (error) {
    console.error(error.message);
    child?.kill("SIGTERM");
    process.exit(1);
  }
}

function watchForActualMirrorPort(root, stream, output, syncedPorts, child) {
  let buffer = "";

  stream.on("data", (chunk) => {
    output.write(chunk);
    buffer = `${buffer}${chunk.toString("utf8")}`;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const match = line.match(/https?:\/\/localhost:(\d+)/);
      if (!match) continue;

      const actualPort = Number.parseInt(match[1], 10);
      if (!Number.isInteger(actualPort) || syncedPorts.has(actualPort)) {
        continue;
      }

      syncedPorts.add(actualPort);
      process.stderr.write(
        `[with-worktree-port] Mirror started on port ${actualPort}; syncing Convex auth URL.\n`,
      );
      syncLocalAuthUrlOrExit(root, actualPort, child);
    }
  });
}

async function allocatePort(name, root) {
  const configured = explicitPort(name);
  if (configured) {
    return Number.parseInt(configured, 10);
  }

  const canonicalRoot = mainRoot();
  const preferred =
    canonicalRoot && root === canonicalRoot
      ? 3001
      : 3100 + hashOffset(`${name}:${root}`, 700);
  const fallbackOffset = hashOffset(`${name}:${root}`, 700);

  return withLock(async () => {
    const registry = readRegistry();
    registry[name] ??= {};

    const existing = registry[name][root];
    if (existing?.port) {
      if (
        !isAssignedToOtherRoot(registry, name, root, existing.port) &&
        (await isPortFree(existing.port))
      ) {
        registry[name][root] = { port: existing.port, updatedAt: Date.now() };
        writeRegistry(registry);
        return existing.port;
      }

      process.stderr.write(
        `[with-worktree-port] ${name} port ${existing.port} is already in use; looking for another free port.\n`,
      );
    }

    for (let i = 0; i < 701; i += 1) {
      const port =
        preferred === 3001 && i === 0
          ? 3001
          : 3100 +
            ((preferred === 3001
              ? fallbackOffset + i - 1
              : preferred - 3100 + i) %
              700);
      const assignedToOtherRoot = isAssignedToOtherRoot(
        registry,
        name,
        root,
        port,
      );

      if (!assignedToOtherRoot && (await isPortFree(port))) {
        registry[name][root] = { port, updatedAt: Date.now() };
        writeRegistry(registry);
        return port;
      }
    }

    throw new Error(`Could not allocate a free ${name} port.`);
  });
}

const root = repoRoot();
const port = await allocatePort(service, root);

if (printOnly) {
  process.stdout.write(String(port));
  process.exit(0);
}

if (command.length === 0) {
  throw new Error("Usage: with-worktree-port.mjs <service> -- <command>");
}

const syncsLocalAuthUrl = shouldSyncLocalAuthUrl(service, command);

if (syncsLocalAuthUrl) {
  syncLocalAuthUrlOrExit(root, port);
}

const env = {
  ...process.env,
  [serviceEnvName(service)]: String(port),
  PORT: String(port),
  PLAYWRIGHT_BASE_URL: `http://localhost:${port}`,
};

if (service === "mirror") {
  env.NEXT_PUBLIC_SITE_URL = `http://localhost:${port}`;
  env.NEXT_PUBLIC_AUTH_URL = `http://localhost:${port}`;
}

const child = spawn(
  command[0],
  command.slice(1).map((arg) => arg.replaceAll("{port}", String(port))),
  {
    cwd: process.cwd(),
    env,
    stdio: syncsLocalAuthUrl ? ["inherit", "pipe", "pipe"] : "inherit",
  },
);

if (syncsLocalAuthUrl) {
  const syncedMirrorPorts = new Set([port]);
  watchForActualMirrorPort(
    root,
    child.stdout,
    process.stdout,
    syncedMirrorPorts,
    child,
  );
  watchForActualMirrorPort(
    root,
    child.stderr,
    process.stderr,
    syncedMirrorPorts,
    child,
  );
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
