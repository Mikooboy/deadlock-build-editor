import React from "react";

export default function FilePicker({ onUpload, disabled }) {
  const fileRef = React.useRef(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleFile = (file) => {
    if (!file) return;
    if (onUpload) onUpload(file);
  };

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  };

  return (
    <div className="filepicker">
      <div className="upload-panel-warning">!!! WARNING !!!<br/>Please create a backup of your builds file before editing!<br/>The game will reset files with invalid formatting or IDs at launch!</div>
      <label
        className={`drop-zone ${isDragging ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".kv3"
          onChange={handleChange}
          disabled={disabled}
        />
        <div className="drop-zone-center">
          <span className="drop-zone-text">Drop KV3 file here</span>
          <span className="drop-zone-subtext">or click to browse</span>
        </div>
      </label>
      <code className="upload-panel-file">\Steam\userdata\&lt;userid&gt;\1422450\remote\cfg\cached_hero_builds.kv3</code>
    </div>
  );
}
