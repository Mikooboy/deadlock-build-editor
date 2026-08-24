import React from "react";

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
                <div className="ability-converter">
                  <label className="ability-converter-label" htmlFor="ability-name-input">
                    Name
                  </label>
                  <input
                    id="ability-name-input"
                    type="text"
                    value={abilityName ?? ""}
                    onChange={(e) => onAbilityNameChange?.(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onAbilityConvert?.();
                    }}
                    placeholder="upgrade_extra_charge"
                    className="ability-input"
                  />
                  <button
                    type="button"
                    className="convert-button"
                    onClick={onAbilityConvert}
                    disabled={abilityIdLoading}
                    aria-label="Convert ability name to ID"
                  >
                    {abilityIdLoading ? "..." : "Convert"}
                  </button>
                  <span className="ability-converter-label">ID</span>
                  <input
                    className="ability-id-output"
                    type="text"
                    value={abilityIdResult ?? ""}
                    placeholder="3776945997"
                  />
                </div>
              </>
          </div>
        </div>
      </div>

      <div className="build-actions panel-card">
        <p className="build-actions-note">Have the game closed before replacing the KV3 file in the cfg folder!</p>
        <div className="build-actions-buttons">
          <button type="button" className="secondary-button" onClick={onOriginalDownload} disabled={!fileReady}>
            Download Original KV3
          </button>
          <button type="button" className="download-button" onClick={onDownloadEdited} disabled={!downloadReady}>
            Download Edited KV3
          </button>
        </div>
      </div>
    </div>
  );
}
