"use client";
import React, { useRef, useState } from "react";

const SRL_ROLES = [
  { value: "ASPECT", label: "ASPECT", desc: "Phần của bộ phim được đề cập (ví dụ: diễn xuất, cốt truyện, nhạc phim)" },
  { value: "OPINION", label: "OPINION", desc: "Ý kiến, cảm xúc (ví dụ: nhàm chán, hấp dẫn, tệ)" },
  { value: "HOLDER", label: "HOLDER", desc: "Người đưa ra ý kiến (thường là người đánh giá, có thể ẩn)" },
  { value: "TARGET", label: "TARGET", desc: "Đối tượng được nói đến (thường là bộ phim hoặc một khía cạnh nào đó)" },
  { value: "NEGATION", label: "NEGATION", desc: "Từ phủ định làm thay đổi ý nghĩa (ví dụ: không, chưa từng)" },
  { value: "TIME", label: "TIME", desc: "Thông tin thời gian nếu có (ví dụ: 'tối qua', 'năm 2020')" },
  { value: "MODALITY", label: "MODALITY", desc: "Mức độ, sắc thái (ví dụ: 'có thể tốt hơn', 'rất thích')" },
  { value: "EMOTION", label: "EMOTION", desc: "(Tùy chọn) Từ chỉ cảm xúc rõ ràng (ví dụ: 'yêu thích', 'ghét')" },
];

const SAMPLE_TEXTS = [
  "Tôi rất thích diễn xuất của diễn viên chính trong bộ phim này, nhưng cốt truyện thì khá nhàm chán.",
  "Bộ phim này không thực sự hấp dẫn như tôi mong đợi.",
  "Âm nhạc trong phim làm tôi cảm thấy rất xúc động." 
];

type Label = {
  wordIndices: number[]; // indices of words in the sentence
  text: string;
  role: string;
  start?: number;
  end?: number;
};

function getWordCharRange(words: string[], wordIndices: number[]): { start: number; end: number } {
  // Find the character start/end for a set of word indices
  let idx = 0;
  let start = -1;
  let end = -1;
  for (let i = 0; i < words.length; i++) {
    if (wordIndices.includes(i)) {
      if (start === -1) start = idx;
      end = idx + words[i].length;
    }
    idx += words[i].length + 1; // +1 for space
  }
  return { start, end };
}

export default function Home() {
  const [texts, setTexts] = useState<string[]>(SAMPLE_TEXTS);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [labels, setLabels] = useState<Label[][]>(Array(SAMPLE_TEXTS.length).fill([]));
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>(SRL_ROLES[0].value);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Split sentence into words (keep punctuation attached)
  const words = texts[currentIdx]?.match(/[^\s]+/g) || [];
  const sentence = texts[currentIdx] || "";

  // Handle word click (select/deselect for labeling)
  const handleWordClick = (idx: number) => {
    setSelectedWords((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx].sort((a, b) => a - b)
    );
  };

  // Combine selected words into one label
  const handleSaveLabel = () => {
    if (selectedWords.length === 0) return;
    const sorted = [...selectedWords].sort((a, b) => a - b);
    const text = sorted.map((i) => words[i]).join(" ");
    // Prevent duplicate/overlapping labels
    const currentLabels = labels[currentIdx] || [];
    if (currentLabels.some((l) => l.wordIndices.some((i) => sorted.includes(i)))) return;
    // Calculate char start/end
    const { start, end } = getWordCharRange(words, sorted);
    const newLabel: Label = { wordIndices: sorted, text, role: selectedRole, start, end };
    const newLabels = labels.map((arr, i) =>
      i === currentIdx ? [...arr, newLabel] : arr
    );
    setLabels(newLabels);
    setSelectedWords([]);
  };

  // Remove a label
  const handleRemoveLabel = (labelIdx: number) => {
    const newLabels = labels.map((arr, i) =>
      i === currentIdx ? arr.filter((_, idx) => idx !== labelIdx) : arr
    );
    setLabels(newLabels);
  };

  // Reset all labels for current text
  const handleResetLabels = () => {
    const newLabels = labels.map((arr, i) => (i === currentIdx ? [] : arr));
    setLabels(newLabels);
    setSelectedWords([]);
  };

  // Combine selected words into one (for labeling)
  const handleCombine = () => {
    // Just keep selection as is; combine is handled by label creation
  };

  // Separate: deselect all
  const handleSeparate = () => {
    setSelectedWords([]);
  };

  // Navigation
  const handlePrev = () => {
    setCurrentIdx((idx) => Math.max(0, idx - 1));
    setSelectedWords([]);
  };
  const handleNext = () => {
    setCurrentIdx((idx) => Math.min(texts.length - 1, idx + 1));
    setSelectedWords([]);
  };

  // CSV Upload (now only takes 'text' column)
  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      // Parse CSV
      const lines = content.split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) return;
      let textColIdx = 0;
      let startIdx = 0;
      const header = lines[0].split(",");
      if (header.some(h => h.trim().toLowerCase() === "text")) {
        textColIdx = header.findIndex(h => h.trim().toLowerCase() === "text");
        startIdx = 1;
      }
      const texts: string[] = [];
      for (let i = startIdx; i < lines.length; i++) {
        const row = lines[i].split(",");
        if (row.length > textColIdx) {
          texts.push(row[textColIdx].replace(/^"|"$/g, ""));
        }
      }
      setTexts(texts);
      setLabels(Array(texts.length).fill([]));
      setCurrentIdx(0);
    };
    reader.readAsText(file);
  };

  // Export to JSON (not CSV)
  const handleExport = () => {
    // Export labels for all texts as JSON
    const exportData = texts.map((text, idx) => {
      const labelObjs = (labels[idx] || []).map((label) => {
        // If start/end not present, calculate from wordIndices
        let start = label.start;
        let end = label.end;
        if (start === undefined || end === undefined) {
          const w = text.match(/[^\s]+/g) || [];
          const range = getWordCharRange(w, label.wordIndices);
          start = range.start;
          end = range.end;
        }
        return {
          role: label.role,
          text: label.text,
          start,
          end,
        };
      });
      return { text, labels: labelObjs };
    });
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "labels.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Highlight labeled spans by character range
  function renderSentenceWithLabels() {
    const currentLabels = (labels[currentIdx] || []).filter(l => l.start !== undefined && l.end !== undefined);
    // Sort labels by start
    const sortedLabels = [...currentLabels].sort((a, b) => (a.start! - b.start!));
    let result: React.ReactNode[] = [];
    let idx = 0;
    for (let i = 0; i < sortedLabels.length; i++) {
      const l = sortedLabels[i];
      if (l.start! > idx) {
        result.push(<span key={"plain-" + idx}>{sentence.slice(idx, l.start)}</span>);
      }
      const colorMap: Record<string, string> = {
        ASPECT: "bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100 font-semibold",
        OPINION: "bg-yellow-200 text-yellow-900 dark:bg-yellow-700 dark:text-yellow-100 font-semibold",
        HOLDER: "bg-green-200 text-green-900 dark:bg-green-700 dark:text-green-100 font-semibold",
        TARGET: "bg-purple-200 text-purple-900 dark:bg-purple-700 dark:text-purple-100 font-semibold",
        NEGATION: "bg-red-200 text-red-900 dark:bg-red-700 dark:text-red-100 font-semibold",
        TIME: "bg-pink-200 text-pink-900 dark:bg-pink-700 dark:text-pink-100 font-semibold",
        MODALITY: "bg-orange-200 text-orange-900 dark:bg-orange-700 dark:text-orange-100 font-semibold",
        EMOTION: "bg-teal-200 text-teal-900 dark:bg-teal-700 dark:text-teal-100 font-semibold",
      };
      const color = colorMap[l.role as keyof typeof colorMap] || "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100 font-semibold";
      result.push(
        <span key={"label-" + i} className={`rounded px-1 mx-0.5 ${color}`}>{sentence.slice(l.start!, l.end!)}</span>
      );
      idx = l.end!;
    }
    if (idx < sentence.length) {
      result.push(<span key={"plain-end"}>{sentence.slice(idx)}</span>);
    }
    return result;
  }

  return (
    <div className="container mx-auto py-8 px-2 dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold text-center mb-6 dark:text-gray-100">Semantic Role Labeling Tool</h1>
      {/* CSV Upload & Export */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="md:w-1/2 bg-white dark:bg-gray-800 rounded shadow p-4">
          <h2 className="font-semibold mb-2 dark:text-gray-100">Upload CSV File</h2>
          <form id="upload-form" className="flex flex-col gap-2" onSubmit={handleUpload}>
            <input ref={fileInputRef} type="file" accept=".csv" className="border rounded px-2 py-1 dark:bg-gray-900 dark:text-gray-100" />
            <button type="submit" className="bg-blue-600 text-white rounded px-4 py-1.5 hover:bg-blue-700">Upload</button>
          </form>
        </div>
        <div className="md:w-1/2 bg-white dark:bg-gray-800 rounded shadow p-4 flex flex-col justify-between">
          <h2 className="font-semibold mb-2 dark:text-gray-100">Export Labels</h2>
          <button onClick={handleExport} className="bg-green-600 text-white rounded px-4 py-1.5 hover:bg-green-700">Export to JSON</button>
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-6">
        {/* Main Labeling Area */}
        <div className="md:w-2/3 bg-white dark:bg-gray-800 rounded shadow p-4">
          <h2 className="font-semibold mb-3 dark:text-gray-100">Text to Label</h2>
          {/* Navigation */}
          <div className="flex justify-between items-center mb-3">
            <button onClick={handlePrev} className="bg-gray-200 dark:bg-gray-700 dark:text-gray-100 px-3 py-1 rounded disabled:opacity-50" disabled={currentIdx === 0}>Previous</button>
            <span className="text-gray-500 dark:text-gray-300">Text {currentIdx + 1} of {texts.length}</span>
            <button onClick={handleNext} className="bg-gray-200 dark:bg-gray-700 dark:text-gray-100 px-3 py-1 rounded disabled:opacity-50" disabled={currentIdx === texts.length - 1}>Next</button>
          </div>
          {/* Sentence with highlights */}
          <div className="mb-3 border rounded p-3 bg-gray-50 dark:bg-gray-900 text-lg min-h-[48px]">
            {renderSentenceWithLabels()}
          </div>
          {/* Words Display */}
          <div className="mb-3">
            <div className="flex flex-wrap gap-1 p-3 border rounded min-h-[48px] bg-gray-50 dark:bg-gray-900">
              {words.map((word, idx) => {
                // Is this word labeled?
                const label = (labels[currentIdx] || []).find(l => l.wordIndices.includes(idx));
                const isSelected = selectedWords.includes(idx);
                return (
                  <span
                    key={idx}
                    className={`cursor-pointer px-2 py-1 rounded transition select-none
                      ${label ? "bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100 font-semibold" : isSelected ? "bg-yellow-200 text-yellow-900 dark:bg-yellow-700 dark:text-yellow-100 font-semibold" : "hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-gray-100"}`}
                    onClick={() => handleWordClick(idx)}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
          </div>
          {/* Controls */}
          <div className="mb-3 flex gap-2 flex-wrap">
            <button onClick={handleCombine} className="border px-3 py-1 rounded text-sm dark:border-gray-600 dark:text-gray-100">Combine</button>
            <button onClick={handleSeparate} className="border px-3 py-1 rounded text-sm dark:border-gray-600 dark:text-gray-100">Separate</button>
            <button onClick={handleResetLabels} className="border px-3 py-1 rounded text-sm text-red-600 dark:border-gray-600 dark:text-red-400">Reset</button>
          </div>
          {/* Role Selection & Save */}
          <div className="mb-3">
            <label htmlFor="role-select" className="font-semibold block mb-1 dark:text-gray-100">Select Role:</label>
            <select
              id="role-select"
              className="border rounded px-2 py-1 text-base dark:bg-gray-900 dark:text-gray-100"
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
            >
              {SRL_ROLES.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
            <button
              onClick={handleSaveLabel}
              className={`ml-3 bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 transition ${selectedWords.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={selectedWords.length === 0}
            >
              Save Label
            </button>
          </div>
          {/* Label Descriptions */}
          <div className="mb-3 p-4 bg-gray-50 dark:bg-gray-900 rounded border dark:border-gray-700">
            <strong className="dark:text-gray-100">Label Descriptions:</strong>
            <ul className="text-sm pl-4 list-disc space-y-1 mt-1 dark:text-gray-200">
              {SRL_ROLES.map(role => (
                <li key={role.value}>
                  <b>{role.label}</b>: {role.desc}
                </li>
              ))}
            </ul>
          </div>
        </div>
        {/* Current Labels Sidebar */}
        <div className="md:w-1/3 bg-white dark:bg-gray-800 rounded shadow p-4">
          <h2 className="font-semibold mb-3 dark:text-gray-100">Current Labels</h2>
          <div className="flex flex-col gap-2">
            {(labels[currentIdx] || []).length === 0 ? (
              <div className="text-gray-400 italic dark:text-gray-500">No labels yet.</div>
            ) : (
              (labels[currentIdx] || []).map((label, idx) => (
                <div key={idx} className="flex items-center gap-2 border rounded px-2 py-1 bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
                  <span className="font-mono text-base bg-gray-100 dark:bg-gray-800 rounded px-2 py-0.5 dark:text-gray-100">
                    {label.text}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 font-semibold">
                    {label.role}
                  </span>
                  <button
                    className="ml-2 text-xs text-red-500 hover:underline dark:text-red-400"
                    onClick={() => handleRemoveLabel(idx)}
                    title="Remove label"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
