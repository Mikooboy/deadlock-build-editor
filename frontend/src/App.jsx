import React, { useState } from "react";
import FilePicker from "./components/FilePicker";
import BuildsList from "./components/BuildsList";

const SESSION_STORAGE_KEY = "deadlock-build-editor-session-id";

function getSessionId() {
  if (typeof window === "undefined") return "server";

  let current = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!current) {
    current = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(SESSION_STORAGE_KEY, current);
  }

  return current;
}

function withSessionHeaders(headers = {}) {
  return {
    ...headers,
    "X-Session-Id": getSessionId(),
  };
}

function sanitizeBuildForEditor(build) {
  if (!build || typeof build !== "object") return build;

  const copy = { ...build };
  delete copy._sourceList;
  delete copy._index;
  return copy;
}

export default function App() {
  const [builds, setBuilds] = useState([]);
  const [fileId, setFileId] = useState(null);
  const [kv3Path, setKv3Path] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [selectedJson, setSelectedJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState({ type: "", message: "" });
  const [error, setError] = useState(null);
  const [downloadReady, setDownloadReady] = useState(false);
  const [abilityName, setAbilityName] = useState("");
  const [abilityIdResult, setAbilityIdResult] = useState("");
  const [abilityIdLoading, setAbilityIdLoading] = useState(false);
  const [buildSearch, setBuildSearch] = useState("");

  const updateSelectedBuildJson = (nextBuild) => {
    setBuilds((current) => {
      if (selectedIndex == null) return current;
      const clone = [...current];
      const original = clone[selectedIndex] ?? {};
      clone[selectedIndex] = {
        ...nextBuild,
        _sourceList: nextBuild?._sourceList ?? original._sourceList ?? original.sourceList,
        _index: nextBuild?._index ?? original._index ?? original.index,
      };
      return clone;
    });
    setSelectedJson(JSON.stringify(sanitizeBuildForEditor(nextBuild), null, 2));
  };

  const handleUpload = async (file) => {
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/builds", {
        method: "POST",
        headers: withSessionHeaders(),
        body: fd,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || "Upload failed");
        setBuilds([]);
        setSelectedIndex(null);
        setSelectedJson("");
        setFileId(null);
        setKv3Path(null);
        setDownloadReady(false);
        return;
      }

      const buildsResult = Array.isArray(data) ? data : data?.builds ?? data;
      setBuilds(buildsResult || []);
      setFileId(data?.fileId ?? null);
      setKv3Path(data?.path ?? null);
      setDownloadReady(false);
      if ((buildsResult || []).length > 0) {
        setSelectedIndex(0);
        setSelectedJson(JSON.stringify(sanitizeBuildForEditor(buildsResult[0]), null, 2));
      } else {
        setSelectedIndex(null);
        setSelectedJson("");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (selectedIndex == null || (!fileId && !kv3Path)) {
      setSaveFeedback({ type: "error", message: "Choose a build and upload a file first." });
      setError(null);
      return;
    }

    try {
      const currentOriginal = builds[selectedIndex] ?? {};
      const parsed = JSON.parse(selectedJson);
      const buildWithMetadata = {
        ...parsed,
        _sourceList: currentOriginal._sourceList ?? currentOriginal.sourceList,
        _index: currentOriginal._index ?? currentOriginal.index,
      };
      setSaving(true);
      setError(null);
      setSaveFeedback({ type: "", message: "" });

      const res = await fetch("/api/builds/edit", {
        method: "POST",
        headers: withSessionHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          fileId,
          path: kv3Path,
          build: buildWithMetadata,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setSaveFeedback({ type: "error", message: data?.error || "Save failed" });
        setError(null);
        return;
      }

      const updated = data?.build ?? buildWithMetadata;
      const sanitized = sanitizeBuildForEditor(updated);
      updateSelectedBuildJson(sanitized);
      setDownloadReady(true);
      setSaveFeedback({ type: "", message: "" });
      setError(null);
    } catch (e) {
      setSaveFeedback({ type: "error", message: `Invalid JSON: ${String(e)}` });
      setError(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!fileId && !kv3Path) {
      setError("No file available to download.");
      return;
    }

    try {
      const params = new URLSearchParams();
      if (fileId) params.set("fileId", fileId);
      if (kv3Path) params.set("path", kv3Path);
      const url = `/api/builds/download?${params.toString()}`;

      const res = await fetch(url, {
        headers: withSessionHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to download file");
      }

      const blob = await res.blob();
      const a = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      a.download = "cached_hero_builds.kv3";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleAbilityConvert = async () => {
    const trimmed = abilityName.trim();
    if (!trimmed) {
      setAbilityIdResult("");
      return;
    }

    try {
      setAbilityIdLoading(true);
      setError(null);

      const res = await fetch("/api/ability-id", {
        method: "POST",
        headers: withSessionHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ name: trimmed }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to calculate ability ID");
      }

      setAbilityIdResult(String(data?.id ?? ""));
    } catch (e) {
      setError(String(e));
    } finally {
      setAbilityIdLoading(false);
    }
  };

  const handleOriginalDownload = async () => {
    if (!fileId && !kv3Path) {
      setError("No original file available to download.");
      return;
    }

    try {
      const params = new URLSearchParams();
      if (fileId) params.set("fileId", fileId);
      if (kv3Path) params.set("path", kv3Path);
      const url = `/api/builds/download?${params.toString()}`;

      const res = await fetch(url, {
        headers: withSessionHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to download original file");
      }

      const blob = await res.blob();
      const a = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      a.download = "cached_hero_builds.kv3";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      setError(String(e));
    }
  };

  const filteredBuilds = builds.filter((build) => {
    const name = build?.hero_build?.name || build?.heroBuild?.name || build?.name || `Build ${build?._index ?? ""}`;
    if (!buildSearch.trim()) return true;
    return name.toLowerCase().includes(buildSearch.toLowerCase());
  });

  return (
    <div className="app">
      <BuildsList
        builds={filteredBuilds}
        selectedIndex={selectedIndex}
        onSelect={(index) => {
          const actualIndex = builds.findIndex((build) => build === filteredBuilds[index]);
          setSelectedIndex(actualIndex >= 0 ? actualIndex : index);
          const targetBuild = builds[actualIndex >= 0 ? actualIndex : index];
          setSelectedJson(JSON.stringify(sanitizeBuildForEditor(targetBuild), null, 2));
        }}
        selectedJson={selectedJson}
        onJsonChange={setSelectedJson}
        onSave={handleSave}
        saving={saving}
        saveFeedback={saveFeedback}
        searchValue={buildSearch}
        onSearchChange={setBuildSearch}
        onUpload={handleUpload}
        loading={loading}
        error={error}
        onOriginalDownload={handleOriginalDownload}
        onDownloadEdited={handleDownload}
        downloadReady={downloadReady}
        fileReady={Boolean(fileId || kv3Path)}
        abilityName={abilityName}
        onAbilityNameChange={setAbilityName}
        onAbilityConvert={handleAbilityConvert}
        abilityIdLoading={abilityIdLoading}
        abilityIdResult={abilityIdResult}
      />
    </div>
  );
}
