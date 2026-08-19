import React from "react";
import FilePicker from "./FilePicker";

export default function BuildsList({
  builds,
  selectedIndex,
  onSelect,
  selectedJson,
  onJsonChange,
  onSave,
  saving,
  saveFeedback,
  searchValue,
  onSearchChange,
  onUpload,
  loading,
  error,
  onOriginalDownload,
  onDownloadEdited,
  downloadReady,
  fileReady,
  abilityName,
  onAbilityNameChange,
  onAbilityConvert,
  abilityIdLoading,
  abilityIdResult,
}) {
  const hasBuilds = Array.isArray(builds) && builds.length > 0;

  const isLocked = !fileReady;

  return (
    <div className="builds">
      <div className="build-layout-shell">
        <div className="build-split-panel">
          <div className={`build-list-panel ${!hasBuilds ? "empty-state" : ""}`}>
            <div className="build-header-row">
              <h2>Builds</h2>
              <input
                type="text"
                value={searchValue ?? ""}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Search build names"
                className="build-search"
                disabled={!hasBuilds}
                id="build-search-id"
              />
            </div>

            <div className="build-list-scroll">
                <ul className="build-list">
                  {builds.map((b, i) => {
                    const name = b?.hero_build?.name || b?.heroBuild?.name || b?.name || b?._name || `Build ${i + 1}`;
                    const key = b?._sourceList && b?._index != null ? `${b._sourceList}-${b._index}` : b?.id ?? i;
                    const isSelected = selectedIndex === i;
                    return (
                      <li key={key}>
                        <button type="button" className={isSelected ? "build-button selected" : "build-button"} onClick={() => onSelect?.(i)}>
                          {name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
            </div>
          </div>

          <div className={`editor-panel ${selectedIndex == null ? "empty-state" : ""}`}>
              <>
                <div className="editor-header-row">
                  <h2>JSON Editor</h2>
                      <div className="save-button-wrap">
                        {saveFeedback?.message && (
                          <span className={`save-feedback ${saveFeedback.type}`} title={saveFeedback.message}>
                            {saveFeedback.message}
                          </span>
                        )}
                        <button type="button" className="save-button" onClick={onSave} disabled={saving}>
                          {saving ? "Saving..." : "Save build"}
                        </button>
                      </div>
                    </div>
                    <div className="json-editor-wrap">
                      <div className="json-line-numbers" aria-hidden="true">
                        {Array.from({ length: Math.max(1, (selectedJson ?? "").split("\n").length) }, (_, i) => (
                          <span key={`line-${i + 1}`}>{i + 1}</span>
                        ))}
                      </div>
                      <textarea
                        value={selectedJson ?? ""}
                        onChange={(e) => onJsonChange?.(e.target.value)}
                        onScroll={(e) => {
                          const numbers = e.currentTarget.parentElement?.querySelector(".json-line-numbers");
                          if (!numbers) return;
                          numbers.scrollTop = e.currentTarget.scrollTop;
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "Tab") return;
                          e.preventDefault();
                          const textarea = e.currentTarget;
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const value = textarea.value;
                          const indent = "  ";
                          const nextValue = `${value.slice(0, start)}${indent}${value.slice(end)}`;
                          onJsonChange?.(nextValue);
                          requestAnimationFrame(() => {
                            textarea.selectionStart = start + indent.length;
                            textarea.selectionEnd = start + indent.length;
                          });
                        }}
                        className="json-editor"
                        id="json-editor-id"
                      />
                    </div>
                <div className="ability-converter-container">
                  <div className="ability-converter">
                    <div className="ability-converter-info">
                      Items/Abilities can be found in the <a target="_blank" href="https://github.com/SteamTracking/GameTracking-Deadlock/raw/refs/heads/master/game/citadel/pak01_dir/scripts/abilities.vdata">abilities.vdata</a>.
                      Use the converter on the right to get the ID and use that in the JSON fields.
                      Not all of the items/abilities work so you need to do some testing.
                    </div>
                  </div>
                  <div className="ability-converter2">
                    <div className="ability-row">
                      <input
                        type="text"
                        value={abilityName ?? ""}
                        onChange={(e) => onAbilityNameChange?.(e.target.value)}
                        placeholder="upgrade_extra_charge"
                        className="ability-input"
                      />
                      <button
                        type="button"
                        className="convert-button"
                        onClick={onAbilityConvert}
                        disabled={abilityIdLoading}
                      >
                        {abilityIdLoading ? "..." : "Convert"}
                      </button>
                    </div>
                    <div className="ability-result">
                      <strong>ID:</strong> {abilityIdResult ? abilityIdResult : "3776945997"}
                    </div>
                  </div>
                </div>
              </>
          </div>
        </div>
      </div>

      <div className="build-actions">
        <div>Have the game closed before replacing the KV3 file in the folder!</div>
        <button type="button" className="secondary-button" onClick={onOriginalDownload} disabled={!fileReady}>
          Download Original KV3
        </button>
        <button type="button" className="download-button" onClick={onDownloadEdited} disabled={!downloadReady}>
          Download Edited KV3
        </button>
      </div>
      {isLocked && (
        <div className="editor-empty-overlay" aria-live="polite">
          <div className="upload-panel">
            <div className="upload-panel-header">
              <p className="upload-panel-title">Deadlock Build Editor</p>
            </div>
            <div className="upload-panel-info">
              <div>
                This tool allows you to edit your Deadlock builds as JSON. 
              </div>
              <div>
                Item/Ability names can be found in <a target="_blank" href="https://github.com/SteamTracking/GameTracking-Deadlock/raw/refs/heads/master/game/citadel/pak01_dir/scripts/abilities.vdata">abilities.vdata</a>. 
              </div>
              <div>
                You have to convert the item/ability name to it's ID in order to use it in the JSON.
              </div>
              <div>
                Some items/abilities will cause the game to crash if you open a build containing them.
              </div>
              <div>
                For all JSON fields that can be used you should check the <a target="_blank" href="https://github.com/SteamTracking/GameTracking-Deadlock/blob/master/Protobufs/citadel_gcmessages_common.proto#L783">CMsgHeroBuild</a> protobuf message!
              </div>
            </div>
            <div className="upload-panel-actions">
              <FilePicker onUpload={onUpload} disabled={loading} />
              {loading && <div className="status">Processing...</div>}
              {error && <div className="error">Error: {error}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
