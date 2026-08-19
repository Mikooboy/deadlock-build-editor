import express from "express";
import multer from "multer";
import cors from "cors";
import path from "node:path";
import fs from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";

const app = express();

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const UPLOAD_ROOT = path.resolve(UPLOAD_DIR);
const FILE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173").split(",").map((origin) => origin.trim()).filter(Boolean);
const MAX_REQUESTS_PER_MINUTE = 60;
const requestBuckets = new Map<string, { count: number; resetAt: number }>();
const uploadsBySession = new Map<string, Set<string>>();

mkdirSync(UPLOAD_DIR, { recursive: true });
const activeUploads = new Map<string, { sessionId: string; path: string }>();

function sanitizeSessionId(sessionId: string) {
    return sessionId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128) || "anonymous";
}

function getSessionId(req: express.Request) {
    const forwarded = typeof req.headers["x-session-id"] === "string" ? req.headers["x-session-id"] : undefined;
    const sessionId = forwarded?.trim();
    return sanitizeSessionId(sessionId && sessionId.length > 0 ? sessionId : "anonymous");
}

function isWithinUploadRoot(candidatePath: string) {
    const resolved = path.resolve(candidatePath);
    const relative = path.relative(UPLOAD_ROOT, resolved);
    return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function resolveManagedUpload(sessionId: string, fileId?: string, candidatePath?: string) {
    if (fileId && typeof fileId === "string") {
        const mapped = activeUploads.get(fileId);
        if (mapped && mapped.sessionId === sessionId) {
            const resolvedMapped = path.resolve(mapped.path);
            if (isWithinUploadRoot(resolvedMapped)) {
                return resolvedMapped;
            }
        }
    }

    if (typeof candidatePath === "string") {
        const resolvedCandidate = path.resolve(candidatePath);
        if (!isWithinUploadRoot(resolvedCandidate)) {
            return undefined;
        }

        const knownFileIds = uploadsBySession.get(sessionId) ?? new Set<string>();
        const isKnownUpload = [...knownFileIds].some((knownId) => {
            const entry = activeUploads.get(knownId);
            return entry && path.resolve(entry.path) === resolvedCandidate;
        });

        if (isKnownUpload) {
            return resolvedCandidate;
        }
    }

    return undefined;
}

function requestLimitMiddleware(req: any, res: any, next: () => void) {
    const identifier = req.ip ?? "unknown";
    const now = Date.now();
    const existing = requestBuckets.get(identifier);

    if (!existing || now >= existing.resetAt) {
        requestBuckets.set(identifier, { count: 1, resetAt: now + 60_000 });
        next();
        return;
    }

    if (existing.count >= MAX_REQUESTS_PER_MINUTE) {
        res.status(429).json({ error: "Too many requests. Please slow down." });
        return;
    }

    existing.count += 1;
    next();
}

async function cleanupUploads() {
    async function walkDirectory(dirPath: string) {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    await walkDirectory(fullPath);
                    continue;
                }

                if (!entry.isFile()) continue;

                try {
                    const stat = await fs.stat(fullPath);
                    const now = Date.now();
                    if (now - stat.mtimeMs > FILE_MAX_AGE_MS) {
                        await fs.unlink(fullPath);

                        for (const [id, fileInfo] of activeUploads.entries()) {
                            if (fileInfo.path === fullPath) {
                                activeUploads.delete(id);
                                for (const sessionFiles of uploadsBySession.values()) {
                                    sessionFiles.delete(id);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error("Failed to clean uploaded file:", error);
                }
            }
    }

    try {
            await walkDirectory(UPLOAD_DIR);
    } catch (error) {
            console.error("Failed to scan upload directory:", error);
    }
}

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, _file, cb) => {
            const sessionId = getSessionId(req as express.Request);
            const sessionDir = path.join(UPLOAD_DIR, sessionId);
            mkdirSync(sessionDir, { recursive: true });
            cb(null, sessionDir);
        },
        filename: (_req, file, cb) => {
            cb(null, `${randomUUID()}${path.extname(file.originalname)}`);
        },
    }),
    limits: {
        fileSize: 1 * 1024 * 1024, // 1 MB
    },
    fileFilter: (_req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() !== ".kv3") {
            cb(new Error("Only .kv3 files are allowed"));
            return;
        }

        cb(null, true);
    },
});

app.use(express.json({ limit: "1mb" }));
app.use(requestLimitMiddleware);
app.use(cors({
    origin(origin, callback) {
        if (!origin) {
            callback(null, true);
            return;
        }

        if (ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error("Origin not allowed"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Session-Id"],
    credentials: false,
}));

app.get("/api/test", (_req, res) => {
    res.json({
        message: "Hello from Node"
    });
});

app.post("/api/builds", upload.single("file"), async (req, res) => {
    if (!req.file) {
        res.status(400).json({
            error: "No file uploaded",
        });
        return;
    }

    const sessionId = getSessionId(req);
    const tempInput = req.file.path;
    const fileId = randomUUID();
    activeUploads.set(fileId, { sessionId, path: tempInput });
    const sessionFiles = uploadsBySession.get(sessionId) ?? new Set<string>();
    sessionFiles.add(fileId);
    uploadsBySession.set(sessionId, sessionFiles);

    try {
        const stdout = await new Promise<string>((resolve, reject) => {
            execFile(
                "../deadlock-kv3-to-json/venv/bin/python",
                [
                    "../deadlock-kv3-to-json/api.py",
                    tempInput,
                ],
                {
                    maxBuffer: 10 * 1024 * 1024,
                },
                (error, stdout, stderr) => {
                    if (error) {
                        console.error(stderr);
                        reject(new Error("Python failed to process the file"));
                        return;
                    }

                    resolve(stdout);
                },
            );
        });

        const parsed = JSON.parse(stdout);
        const builds = Array.isArray(parsed) ? parsed : parsed?.builds ?? parsed;

        res.setHeader("Content-Type", "application/json");
        res.send({
            fileId,
            path: tempInput,
            builds,
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to process build file",
        });
    }
});

app.get("/api/builds/download", async (req, res) => {
    const sessionId = getSessionId(req);
    const fileId = typeof req.query.fileId === "string" ? req.query.fileId : undefined;
    const filePath = typeof req.query.path === "string" ? req.query.path : undefined;
    const resolvedPath = resolveManagedUpload(sessionId, fileId, filePath);

    if (!resolvedPath) {
        res.status(400).json({
            error: "Missing or invalid file reference",
        });
        return;
    }

    try {
        const stat = await fs.stat(resolvedPath);
        if (!stat.isFile()) {
            throw new Error("Requested download is not a file");
        }

        res.download(resolvedPath);
    } catch (error) {
        console.error(error);
        res.status(404).json({
            error: "File not found",
        });
    }
});

app.post("/api/ability-id", async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

    if (!name) {
        res.status(400).json({
            error: "Ability name is required",
        });
        return;
    }

    try {
        const stdout = await new Promise<string>((resolve, reject) => {
            execFile(
                "../deadlock-kv3-to-json/venv/bin/python",
                [
                    "-c",
                    `from murmurhash2 import murmurhash2; import sys; print(murmurhash2(sys.argv[1].encode("utf-8"), 0x31415926))`,
                    name,
                ],
                {
                    maxBuffer: 256 * 1024,
                },
                (error, stdout, stderr) => {
                    if (error) {
                        console.error(stderr);
                        reject(error);
                        return;
                    }
                    resolve(stdout);
                },
            );
        });

        const id = Number.parseInt(stdout.trim(), 10);
        if (!Number.isFinite(id)) {
            throw new Error("Unable to compute ability ID");
        }

        res.json({ id });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Failed to compute ability ID",
        });
    }
});

app.post("/api/builds/edit", async (req, res) => {
    const sessionId = getSessionId(req);
    const { fileId, path: kv3Path, build } = req.body ?? {};
    const resolvedPath = resolveManagedUpload(sessionId, fileId, kv3Path);

    if (!resolvedPath || typeof resolvedPath !== "string") {
        res.status(400).json({
            error: "Missing or invalid kv3 file reference",
        });
        return;
    }

    if (!build || typeof build !== "object") {
        res.status(400).json({
            error: "Missing edited build payload",
        });
        return;
    }

    try {
        const stdout = await new Promise<string>((resolve, reject) => {
            execFile(
                "../deadlock-kv3-to-json/venv/bin/python",
                [
                    "../deadlock-kv3-to-json/api.py",
                    resolvedPath,
                    "--edit",
                    JSON.stringify(build),
                ],
                {
                    maxBuffer: 10 * 1024 * 1024,
                },
                (error, stdout, stderr) => {
                    if (error) {
                        console.error(stderr);
                        reject(error);
                        return;
                    }

                    resolve(stdout);
                },
            );
        });

        const parsed = JSON.parse(stdout);
        res.json(parsed);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to save edited build",
        });
    }
});

app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            res.status(413).json({
                error: "File is too large. Maximum size is 1 MB.",
            });
            return;
        }
    }

    if (error?.message === "Only .kv3 files are allowed") {
        res.status(400).json({
            error: error.message,
        });
        return;
    }

    console.error(error);

    res.status(500).json({
        error: "Internal server error",
    });
});

setInterval(() => {
    void cleanupUploads();
}, CLEANUP_INTERVAL_MS);

void cleanupUploads();

app.listen(3000, () => {
    console.log("Server running on port 3000");
});