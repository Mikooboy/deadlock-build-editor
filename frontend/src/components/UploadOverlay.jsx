import React from "react";
import FilePicker from "./FilePicker";

export default function UploadOverlay({ onUpload, loading, error }) {
  return (
    <div className="editor-empty-overlay" aria-live="polite">
      <div className="upload-panel">
        <div className="upload-panel-header">
          <p className="upload-panel-title">Get started</p>
        </div>
        <div className="upload-panel-info">
          <div>This tool allows you to edit your Deadlock builds as JSON.</div>
          <div>
            Item/Ability names can be found in{" "}
            <a
              target="_blank"
              rel="noreferrer"
              href="https://github.com/SteamTracking/GameTracking-Deadlock/raw/refs/heads/master/game/citadel/pak01_dir/scripts/abilities.vdata"
            >
              abilities.vdata
            </a>
            .
          </div>
          <div>You have to convert the item/ability name to it's ID in order to use it in the JSON.</div>
          <div>Some items/abilities will cause the game to crash if you open a build containing them.</div>
          <div>
            For all JSON fields that can be used you should check the{" "}
            <a
              target="_blank"
              rel="noreferrer"
              href="https://github.com/SteamTracking/GameTracking-Deadlock/blob/master/Protobufs/citadel_gcmessages_common.proto#L783"
            >
              CMsgHeroBuild
            </a>{" "}
            protobuf message!
          </div>
        </div>
        <div className="upload-panel-actions">
          <FilePicker onUpload={onUpload} disabled={loading} />
          {loading && <div className="status">Processing...</div>}
          {error && <div className="error">Error: {error}</div>}
        </div>
      </div>
    </div>
  );
}
