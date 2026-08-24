import React from "react";

const ABILITIES_VDATA =
  "https://github.com/SteamTracking/GameTracking-Deadlock/raw/refs/heads/master/game/citadel/pak01_dir/scripts/abilities.vdata";
const PROTOBUF_DOCS =
  "https://github.com/SteamTracking/GameTracking-Deadlock/blob/master/Protobufs/citadel_gcmessages_common.proto#L783";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p className="site-footer-note">
          Not affiliated with Valve. Always back up your KV3 file before editing.
        </p>
        <nav className="site-footer-links" aria-label="Resources">
          <a href={ABILITIES_VDATA} target="_blank" rel="noreferrer">
            abilities.vdata
          </a>
          <span className="site-footer-divider" aria-hidden="true">
            ·
          </span>
          <a href={PROTOBUF_DOCS} target="_blank" rel="noreferrer">
            CMsgHeroBuild protobuf
          </a>
        </nav>
      </div>
    </footer>
  );
}
