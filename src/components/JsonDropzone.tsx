import { useRef, useState, type DragEvent } from "react";
import { Icon } from "./Icon";

interface JsonDropzoneProps {
  onFile: (file: File | undefined) => void;
}

function containsFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

export function JsonDropzone({ onFile }: JsonDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!containsFiles(event)) return;
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!containsFiles(event)) return;
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    onFile(event.dataTransfer.files[0]);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        aria-label="Upload JSON file"
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <button
        className={`json-dropzone${isDragging ? " json-dropzone--active" : ""}`}
        type="button"
        aria-describedby="json-dropzone-help"
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="json-dropzone__icon"><Icon name="upload" /></span>
        <strong>Drop a JSON file here</strong>
        <small id="json-dropzone-help">or tap to browse local files</small>
      </button>
    </>
  );
}
