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
        aria-label="上传 JSON 文件"
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
        <strong>拖动 JSON 文件到这里</strong>
        <small id="json-dropzone-help">或点击选择本地文件</small>
      </button>
    </>
  );
}
