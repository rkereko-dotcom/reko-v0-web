"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";

// Steve Jobs Style Category Scores
interface CategoryScores {
  typography: {
    score: number;
    hierarchy_clear: boolean;
    fonts_detected: string[];
    feedback: string;
  };
  space: {
    score: number;
    white_space_percentage: string;
    feels_intentional: boolean;
    feedback: string;
  };
  simplicity: {
    score: number;
    elements_that_should_go: string[];
    essence_preserved: boolean;
    feedback: string;
  };
  emotion: {
    score: number;
    feeling_evoked: string;
    feeling_intended: string;
    has_soul: boolean;
    feedback: string;
  };
  craft: {
    score: number;
    details_considered: boolean;
    jony_would_approve: boolean;
    feedback: string;
  };
}

interface PosterElements {
  headline: string;
  subheadline: string | null;
  body_text: string[];
  visual_elements: string[];
  brand: string | null;
  purpose: string;
}

interface DesignVariation {
  name: string;
  philosophy: string;
  what_changes: string;
  steve_note: string;
  prompt: string;
}

interface StyleDetection {
  primary_style: string;
  style_confidence: number;
  what_its_trying_to_be: string;
  what_it_actually_is: string;
  apple_compatibility: number;
}

interface EmotionalAnalysis {
  intended_emotion: string;
  actual_emotion: string;
  target_audience: string;
  makes_you_feel_something: boolean;
  soul_elements: string[];
}

interface ColorAnalysis {
  current_palette: string[];
  palette_works: boolean;
  suggested_palette: string[];
  reasoning: string;
}

interface AnalysisResult {
  score: number;
  their_vision?: string;
  how_close?: string;
  first_impression: string;
  the_gap?: string;
  category_scores?: CategoryScores;
  style_detection?: StyleDetection;
  emotional_analysis?: EmotionalAnalysis;
  what_must_go?: string[];
  what_must_stay?: string[];
  what_must_change?: string[];
  color_analysis?: ColorAnalysis;
  feedback: {
    the_good: string[];
    the_bad: string[];
    the_fix: string;
    overall: string;
  };
  elements: PosterElements;
  variations: DesignVariation[];
  would_steve_ship_this: boolean;
  what_would_make_steve_ship_this: string;
}

interface GeneratedImage {
  index: number;
  imageData: string;
  prompt: string;
}

type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5" | "3:4";

const ASPECT_RATIOS: { value: AspectRatio; label: string; icon: string }[] = [
  { value: "9:16", label: "Portrait", icon: "▯" },
  { value: "16:9", label: "Landscape", icon: "▭" },
  { value: "1:1", label: "Square", icon: "□" },
  { value: "4:5", label: "Instagram", icon: "▯" },
  { value: "3:4", label: "Standard", icon: "▯" },
];

interface LayerResult {
  layers: string[];
  pptx_url?: string;
  zip_url?: string;
}

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [layerResult, setLayerResult] = useState<LayerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "details" | "principles" | "layers" | "variations">("overview");
  const [selectedVariation, setSelectedVariation] = useState<number | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<number | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [isGeneratingCustom, setIsGeneratingCustom] = useState(false);
  const [customGeneratedImage, setCustomGeneratedImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [editingPromptIndex, setEditingPromptIndex] = useState<number | null>(null);
  const [editedPrompts, setEditedPrompts] = useState<Record<number, string>>({});
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File, maxSize: number = 1920): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement("img");
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;

          // Resize if larger than maxSize
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height / width) * maxSize;
              width = maxSize;
            } else {
              width = (width / height) * maxSize;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with 0.8 quality
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.8);
          resolve(compressedDataUrl);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFile = useCallback(async (file: File) => {
    if (file && file.type.startsWith("image/")) {
      setFileName(file.name);
      setAnalysisResult(null);
      setGeneratedImages([]);
      setError(null);
      setActiveTab("overview");
      setSelectedVariation(null);

      try {
        // Compress image to reduce size for upload
        const compressedImage = await compressImage(file);
        setImage(compressedImage);
      } catch {
        // Fallback to original if compression fails
        const reader = new FileReader();
        reader.onload = (e) => {
          setImage(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;
    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);
    setGeneratedImages([]);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image }),
      });

      // Handle non-OK responses first
      if (!response.ok) {
        if (response.status === 413) {
          throw new Error("Зураг хэт том байна. Жижиг зураг оруулна уу.");
        }
        const text = await response.text();
        try {
          const data = JSON.parse(text);
          throw new Error(data.error || "Алдаа гарлаа");
        } catch {
          throw new Error(`Серверийн алдаа: ${response.status}`);
        }
      }

      const data = await response.json();
      setAnalysisResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateVariations = async () => {
    if (!analysisResult?.variations) return;
    setIsGenerating(true);
    setError(null);

    try {
      // Use edited prompts if available, otherwise use original
      const prompts = analysisResult.variations.map((v, i) =>
        editedPrompts[i] || v.prompt
      );

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompts, aspectRatio, parallel: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Зураг үүсгэхэд алдаа гарлаа");
      }

      setGeneratedImages(data.images);
      setActiveTab("variations");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    } finally {
      setIsGenerating(false);
    }
  };

  // Regenerate a single variation with edited prompt
  const handleRegenerateVariation = async (index: number) => {
    if (!analysisResult?.variations[index]) return;
    setRegeneratingIndex(index);
    setError(null);

    try {
      const prompt = editedPrompts[index] || analysisResult.variations[index].prompt;

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompts: [prompt], aspectRatio, parallel: false }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Зураг үүсгэхэд алдаа гарлаа");
      }

      if (data.images && data.images.length > 0) {
        // Update the specific image
        setGeneratedImages(prev => {
          const newImages = [...prev];
          const existingIndex = newImages.findIndex(img => img.index === index);
          const newImage = { ...data.images[0], index };
          if (existingIndex >= 0) {
            newImages[existingIndex] = newImage;
          } else {
            newImages.push(newImage);
            newImages.sort((a, b) => a.index - b.index);
          }
          return newImages;
        });
      }
      setEditingPromptIndex(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const handleDecomposeLayers = async () => {
    if (!image) return;
    setIsDecomposing(true);
    setError(null);

    try {
      const response = await fetch("/api/layers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image, num_layers: 4 }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.details
          ? `${data.error}: ${data.details}`
          : data.error || "Layer задлахад алдаа гарлаа";
        throw new Error(errorMsg);
      }

      setLayerResult(data);
      setActiveTab("layers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    } finally {
      setIsDecomposing(false);
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setFileName("");
    setAnalysisResult(null);
    setGeneratedImages([]);
    setLayerResult(null);
    setError(null);
    setActiveTab("overview");
    setSelectedVariation(null);
    setSelectedLayer(null);
    setEditedPrompts({});
    setEditingPromptIndex(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownload = (imageData: string, index: number) => {
    const link = document.createElement("a");
    link.href = imageData;
    link.download = `improved-poster-${index + 1}.png`;
    link.click();
  };

  const handleGenerateCustom = async () => {
    if (!customPrompt.trim()) return;
    setIsGeneratingCustom(true);
    setError(null);
    setCustomGeneratedImage(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompts: [customPrompt] }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Зураг үүсгэхэд алдаа гарлаа");
      }

      if (data.images && data.images.length > 0) {
        setCustomGeneratedImage(data.images[0].imageData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    } finally {
      setIsGeneratingCustom(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "from-emerald-500/20 to-emerald-600/20 border-emerald-500/30";
    if (score >= 60) return "from-yellow-500/20 to-yellow-600/20 border-yellow-500/30";
    return "from-red-500/20 to-red-600/20 border-red-500/30";
  };

  const getScoreRingColor = (score: number) => {
    if (score >= 80) return "stroke-emerald-500";
    if (score >= 60) return "stroke-yellow-500";
    return "stroke-red-500";
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "typography":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        );
      case "space":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
        );
      case "simplicity":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        );
      case "emotion":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        );
      case "craft":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getCategoryName = (category: string) => {
    const names: Record<string, string> = {
      typography: "Typography",
      space: "White Space",
      simplicity: "Simplicity",
      emotion: "Emotion",
      craft: "Craft",
    };
    return names[category] || category;
  };

  // Score Ring Component
  const ScoreRing = ({ score, size = 120 }: { score: number; size?: number }) => {
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (score / 100) * circumference;

    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            className="stroke-zinc-800"
            strokeWidth={strokeWidth}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            className={`${getScoreRingColor(score)} transition-all duration-1000 ease-out`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: offset,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}</span>
        </div>
      </div>
    );
  };

  // Category Score Card
  const CategoryScoreCard = ({
    category,
    score,
    feedback
  }: {
    category: string;
    score: number;
    feedback: string;
  }) => (
    <div className={`p-4 rounded-xl bg-gradient-to-br ${getScoreBgColor(score)} border`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={getScoreColor(score)}>{getCategoryIcon(category)}</span>
          <span className="text-white font-medium">{getCategoryName(category)}</span>
        </div>
        <span className={`text-xl font-bold ${getScoreColor(score)}`}>{score}</span>
      </div>
      <p className="text-zinc-400 text-sm">{feedback}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <span className="text-xl font-semibold text-white">Reko</span>
          </div>
          <nav className="flex items-center gap-6">
            <span className="text-zinc-400 text-sm">AI Design Analyzer</span>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Title Section */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-3">
              Design <span className="text-emerald-400">Analyzer</span>
            </h1>
            <p className="text-zinc-400 text-lg">
              Poster-оо оруулаад мэргэжлийн шинжилгээ аваарай
            </p>
          </div>

          {/* Custom Image Generator */}
          <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              AI Зураг Үүсгэгч
            </h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Зургийн тайлбар оруулна уу... (жнь: A modern poster with neon colors)"
                className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
                onKeyDown={(e) => e.key === "Enter" && handleGenerateCustom()}
              />
              <button
                onClick={handleGenerateCustom}
                disabled={isGeneratingCustom || !customPrompt.trim()}
                className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                  !isGeneratingCustom && customPrompt.trim()
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-400 hover:to-pink-400"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                }`}
              >
                {isGeneratingCustom ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Үүсгэж байна...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Үүсгэх
                  </>
                )}
              </button>
            </div>

            {/* Generated Custom Image */}
            {customGeneratedImage && (
              <div className="mt-4">
                <div className="relative aspect-square max-w-md mx-auto rounded-xl overflow-hidden border border-zinc-700">
                  <Image
                    src={customGeneratedImage}
                    alt="Generated image"
                    fill
                    className="object-contain"
                  />
                </div>
                <div className="flex justify-center mt-3">
                  <button
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = customGeneratedImage;
                      link.download = "generated-image.png";
                      link.click();
                    }}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Татах
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Upload & Original */}
            <div className="space-y-6">
              {/* Upload Area */}
              <div
                onClick={!image ? handleClick : undefined}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                  relative rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden
                  ${
                    isDragging
                      ? "border-emerald-400 bg-emerald-400/10"
                      : image
                      ? "border-zinc-700 bg-zinc-900/50"
                      : "border-zinc-700 bg-zinc-900/30 hover:border-emerald-400/50 hover:bg-zinc-900/50 cursor-pointer"
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  className="hidden"
                />

                {!image ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6">
                    <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-6">
                      <svg
                        className="w-8 h-8 text-emerald-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-xl font-medium text-white mb-2">
                      Poster оруулах
                    </h3>
                    <p className="text-zinc-400 text-center mb-4">
                      Poster-оо энд чирж оруулах эсвэл{" "}
                      <span className="text-emerald-400 font-medium">
                        энд дарж
                      </span>{" "}
                      сонгоно уу
                    </p>
                    <p className="text-zinc-500 text-sm">
                      PNG, JPG, WEBP (Хамгийн ихдээ 10MB)
                    </p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Image Preview */}
                    <div className="relative aspect-[3/4] w-full">
                      <Image
                        src={image}
                        alt="Uploaded poster"
                        fill
                        className="object-contain"
                      />
                    </div>

                    {/* Image Info Bar */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-emerald-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                          <span className="text-sm text-zinc-300 truncate max-w-[200px]">
                            {fileName}
                          </span>
                        </div>
                        <button
                          onClick={handleRemoveImage}
                          className="text-zinc-400 hover:text-red-400 transition-colors p-2"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Analyze Button */}
              {image && !analysisResult && (
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className={`
                    w-full px-8 py-4 rounded-xl font-medium text-lg transition-all duration-300 flex items-center justify-center gap-3
                    ${
                      !isAnalyzing
                        ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500 shadow-lg shadow-emerald-500/25"
                        : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    }
                  `}
                >
                  {isAnalyzing ? (
                    <>
                      <svg
                        className="w-5 h-5 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Шинжилж байна...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                      </svg>
                      Шинжилгээ хийх
                    </>
                  )}
                </button>
              )}

              {/* Main Score Card */}
              {analysisResult && (
                <div className={`p-6 rounded-2xl bg-gradient-to-br ${getScoreBgColor(analysisResult.score)} border`}>
                  <div className="flex items-center gap-6">
                    <ScoreRing score={analysisResult.score} />
                    <div className="flex-1">
                      <h3 className="text-zinc-400 text-sm font-medium mb-1">
                        Steve Jobs Score
                      </h3>
                      <p className="text-white text-lg mb-3">
                        {analysisResult.would_steve_ship_this
                          ? "Ship it! ✓"
                          : analysisResult.score >= 60
                          ? "Close, but not there yet."
                          : "This needs work."}
                      </p>
                      {/* Their Vision */}
                      {analysisResult.their_vision && (
                        <div className="mt-3 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                          <p className="text-emerald-400 text-xs font-medium mb-1">Таны санаа:</p>
                          <p className="text-zinc-300 text-sm">{analysisResult.their_vision}</p>
                        </div>
                      )}
                      {/* How Close */}
                      {analysisResult.how_close && (
                        <p className="text-zinc-400 text-sm mt-2">
                          {analysisResult.how_close}
                        </p>
                      )}
                      {/* First Impression */}
                      {analysisResult.first_impression && (
                        <p className="text-zinc-500 text-sm italic mt-2">
                          &ldquo;{analysisResult.first_impression}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Results */}
            <div className="space-y-6">
              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}

              {analysisResult && (
                <>
                  {/* Tabs */}
                  <div className="flex gap-1 p-1 bg-zinc-900 rounded-xl overflow-x-auto">
                    {[
                      { id: "overview", label: "Steve's Take" },
                      { id: "details", label: "Scores" },
                      { id: "principles", label: "4 Visions" },
                      { id: "layers", label: `Layers ${layerResult ? `(${layerResult.layers.length})` : ""}` },
                      { id: "variations", label: `Generate (${generatedImages.length})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        className={`flex-1 py-2.5 px-3 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
                          activeTab === tab.id
                            ? "bg-emerald-500 text-white"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Overview Tab */}
                  {activeTab === "overview" && (
                    <div className="space-y-4">
                      {/* Overall Feedback */}
                      <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                        <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Нийт дүгнэлт
                        </h3>
                        <p className="text-zinc-300 leading-relaxed text-sm">
                          {analysisResult.feedback.overall}
                        </p>
                      </div>

                      {/* Style Detection */}
                      {analysisResult.style_detection && (
                        <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-cyan-400 font-medium flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                              </svg>
                              Style Analysis
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-sm font-medium capitalize">
                                {analysisResult.style_detection.primary_style}
                              </span>
                              <span className="text-xs text-zinc-500">
                                Apple: {analysisResult.style_detection.apple_compatibility}%
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                            <div className="p-2 bg-zinc-800/50 rounded-lg">
                              <span className="text-zinc-500">Trying to be:</span>
                              <span className="text-zinc-300 ml-1">{analysisResult.style_detection.what_its_trying_to_be}</span>
                            </div>
                            <div className="p-2 bg-zinc-800/50 rounded-lg">
                              <span className="text-zinc-500">Actually is:</span>
                              <span className="text-zinc-300 ml-1">{analysisResult.style_detection.what_it_actually_is}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Emotional Analysis */}
                      {analysisResult.emotional_analysis && (
                        <div className="p-4 rounded-xl bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/30">
                          <h4 className="text-pink-400 font-medium mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                            Does it have soul?
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-zinc-500">Intended:</span>
                              <span className="text-white ml-2">{analysisResult.emotional_analysis.intended_emotion}</span>
                            </div>
                            <div>
                              <span className="text-zinc-500">Actual:</span>
                              <span className="text-zinc-300 ml-2">{analysisResult.emotional_analysis.actual_emotion}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-zinc-500">Makes you feel something:</span>
                              <span className={`ml-2 ${analysisResult.emotional_analysis.makes_you_feel_something ? 'text-emerald-400' : 'text-red-400'}`}>
                                {analysisResult.emotional_analysis.makes_you_feel_something ? 'Yes' : 'No'}
                              </span>
                            </div>
                            {analysisResult.emotional_analysis.soul_elements?.length > 0 && (
                              <div className="col-span-2">
                                <span className="text-zinc-500">Soul elements:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {analysisResult.emotional_analysis.soul_elements.map((el, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-pink-500/20 text-pink-300 rounded text-xs">{el}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* The Gap */}
                      {analysisResult.the_gap && (
                        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30">
                          <h4 className="text-amber-400 font-medium mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Зөрүү (The Gap)
                          </h4>
                          <p className="text-zinc-300 text-sm mb-3">{analysisResult.the_gap}</p>

                          {analysisResult.what_must_go && analysisResult.what_must_go.length > 0 && (
                            <div className="mb-2">
                              <span className="text-red-400 text-xs font-medium">Must Go:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {analysisResult.what_must_go.map((item, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded text-xs">{item}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {analysisResult.what_must_change && analysisResult.what_must_change.length > 0 && (
                            <div>
                              <span className="text-yellow-400 text-xs font-medium">Must Change:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {analysisResult.what_must_change.map((item, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded text-xs">{item}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Color Analysis */}
                      {analysisResult.color_analysis && (
                        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                          <h4 className="text-cyan-400 font-medium mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                            </svg>
                            Color Palette
                            <span className={`ml-2 text-xs ${analysisResult.color_analysis.palette_works ? 'text-emerald-400' : 'text-red-400'}`}>
                              {analysisResult.color_analysis.palette_works ? '✓ Works' : '✗ Needs work'}
                            </span>
                          </h4>
                          <div className="space-y-3">
                            <div className="flex items-center gap-4">
                              <div>
                                <span className="text-zinc-500 text-xs">Current:</span>
                                <div className="flex gap-1 mt-1">
                                  {analysisResult.color_analysis.current_palette?.map((color, i) => (
                                    <div key={i} className="w-6 h-6 rounded border border-zinc-600" style={{ backgroundColor: color }} title={color} />
                                  ))}
                                </div>
                              </div>
                              <div className="text-zinc-500">→</div>
                              <div>
                                <span className="text-zinc-500 text-xs">Suggested:</span>
                                <div className="flex gap-1 mt-1">
                                  {analysisResult.color_analysis.suggested_palette?.map((color, i) => (
                                    <div key={i} className="w-6 h-6 rounded border border-cyan-500/50" style={{ backgroundColor: color }} title={color} />
                                  ))}
                                </div>
                              </div>
                            </div>
                            <p className="text-zinc-400 text-xs">{analysisResult.color_analysis.reasoning}</p>
                          </div>
                        </div>
                      )}

                      {/* The Good & The Bad */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                          <h4 className="text-emerald-400 font-medium mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            The Good
                          </h4>
                          <ul className="space-y-2">
                            {analysisResult.feedback.the_good?.map((s, i) => (
                              <li key={i} className="text-zinc-300 text-sm flex items-start gap-2">
                                <span className="text-emerald-400 mt-1">•</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                          <h4 className="text-red-400 font-medium mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            The Bad
                          </h4>
                          <ul className="space-y-2">
                            {analysisResult.feedback.the_bad?.map((s, i) => (
                              <li key={i} className="text-zinc-300 text-sm flex items-start gap-2">
                                <span className="text-red-400 mt-1">•</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* The Fix */}
                      {analysisResult.feedback.the_fix && (
                        <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30">
                          <h4 className="text-emerald-400 font-medium mb-2">The One Fix</h4>
                          <p className="text-white text-sm">{analysisResult.feedback.the_fix}</p>
                        </div>
                      )}

                      {/* What Must Stay */}
                      {analysisResult.what_must_stay && analysisResult.what_must_stay.length > 0 && (
                        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                          <h4 className="text-purple-400 font-medium mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Must Stay (Don&apos;t Touch)
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {analysisResult.what_must_stay.map((item, i) => (
                              <span key={i} className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm">{item}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Aspect Ratio Selector */}
                      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                        <h4 className="text-zinc-400 text-sm font-medium mb-3">Зургийн хэмжээс</h4>
                        <div className="flex flex-wrap gap-2">
                          {ASPECT_RATIOS.map((ratio) => (
                            <button
                              key={ratio.value}
                              onClick={() => setAspectRatio(ratio.value)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                                aspectRatio === ratio.value
                                  ? "bg-purple-500 text-white"
                                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                              }`}
                            >
                              <span className="text-lg">{ratio.icon}</span>
                              {ratio.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Generate Button */}
                      <button
                        onClick={handleGenerateVariations}
                        disabled={isGenerating}
                        className={`
                          w-full px-8 py-4 rounded-xl font-medium text-lg transition-all duration-300 flex items-center justify-center gap-3
                          ${
                            !isGenerating
                              ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-400 hover:to-pink-400 shadow-lg shadow-purple-500/25"
                              : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                          }
                        `}
                      >
                        {isGenerating ? (
                          <>
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Зэрэг үүсгэж байна (4 зураг)...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Сайжруулсан хувилбар үүсгэх ({aspectRatio})
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Details Tab - Steve's Category Scores */}
                  {activeTab === "details" && analysisResult.category_scores && (
                    <div className="space-y-4">
                      {Object.entries(analysisResult.category_scores).map(([category, data]) => (
                        <CategoryScoreCard
                          key={category}
                          category={category}
                          score={data.score}
                          feedback={data.feedback}
                        />
                      ))}

                      {/* Detected Elements */}
                      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                        <h4 className="text-white font-medium mb-3">Poster Elements</h4>
                        <div className="space-y-3 text-sm">
                          {analysisResult.elements.headline && (
                            <div>
                              <span className="text-zinc-500">Headline:</span>
                              <span className="text-white ml-2 font-medium">&ldquo;{analysisResult.elements.headline}&rdquo;</span>
                            </div>
                          )}
                          {analysisResult.elements.subheadline && (
                            <div>
                              <span className="text-zinc-500">Subheadline:</span>
                              <span className="text-zinc-300 ml-2">&ldquo;{analysisResult.elements.subheadline}&rdquo;</span>
                            </div>
                          )}
                          <div>
                            <span className="text-zinc-500">Purpose:</span>
                            <span className="text-zinc-300 ml-2">{analysisResult.elements.purpose}</span>
                          </div>
                          {analysisResult.elements.visual_elements && analysisResult.elements.visual_elements.length > 0 && (
                            <div>
                              <span className="text-zinc-500">Visual elements:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {analysisResult.elements.visual_elements.map((el, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded text-xs">{el}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Would Steve Ship This */}
                      <div className={`p-4 rounded-xl border ${analysisResult.would_steve_ship_this ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                        <h4 className={`font-medium mb-2 ${analysisResult.would_steve_ship_this ? 'text-emerald-400' : 'text-red-400'}`}>
                          Would Steve Ship This?
                        </h4>
                        <p className="text-2xl mb-2">{analysisResult.would_steve_ship_this ? '✓ Yes' : '✗ No'}</p>
                        {analysisResult.what_would_make_steve_ship_this && !analysisResult.would_steve_ship_this && (
                          <p className="text-zinc-400 text-sm">{analysisResult.what_would_make_steve_ship_this}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Steve's Visions Tab */}
                  {activeTab === "principles" && (
                    <div className="space-y-4">
                      <h3 className="text-white font-semibold text-lg">Steve&apos;s 4 Visions</h3>
                      {analysisResult.variations && analysisResult.variations.length > 0 ? (
                        analysisResult.variations.map((variation, i) => (
                          <div
                            key={i}
                            className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-white font-medium">{variation.name}</h4>
                              <span className="text-xs px-2 py-1 bg-zinc-800 text-zinc-400 rounded">
                                {variation.philosophy}
                              </span>
                            </div>
                            {variation.what_changes && (
                              <p className="text-zinc-300 text-sm mb-2">{variation.what_changes}</p>
                            )}
                            {variation.steve_note && (
                              <p className="text-cyan-400 text-sm italic border-l-2 border-cyan-500/50 pl-3">
                                &ldquo;{variation.steve_note}&rdquo;
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-center">
                          <p className="text-zinc-400">No variations available</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Layers Tab */}
                  {activeTab === "layers" && (
                    <div className="space-y-4">
                      {!layerResult ? (
                        <div className="p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-center">
                          <svg className="w-16 h-16 text-cyan-500/50 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          <h4 className="text-white font-medium mb-2">Layer Decomposition</h4>
                          <p className="text-zinc-400 text-sm mb-4">
                            Qwen-Image-Layered ашиглан poster-ийг layer-үүдэд задлах
                          </p>
                          <button
                            onClick={handleDecomposeLayers}
                            disabled={isDecomposing}
                            className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 mx-auto ${
                              !isDecomposing
                                ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400"
                                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                            }`}
                          >
                            {isDecomposing ? (
                              <>
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Layer задалж байна...
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                Layer задлах
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Layer Grid */}
                          <div className="grid grid-cols-2 gap-3">
                            {layerResult.layers.map((layerUrl, idx) => (
                              <button
                                key={idx}
                                onClick={() => setSelectedLayer(idx)}
                                className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all bg-[#1a1a1a] ${
                                  selectedLayer === idx
                                    ? "border-cyan-400 ring-2 ring-cyan-400/50"
                                    : "border-zinc-700 hover:border-zinc-500"
                                }`}
                              >
                                <Image
                                  src={layerUrl}
                                  alt={`Layer ${idx + 1}`}
                                  fill
                                  className="object-contain"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                  <p className="text-white text-xs font-medium">Layer {idx + 1}</p>
                                </div>
                              </button>
                            ))}
                          </div>

                          {/* Download Options */}
                          <div className="flex gap-3">
                            {layerResult.zip_url && (
                              <a
                                href={layerResult.zip_url}
                                download
                                className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                ZIP татах
                              </a>
                            )}
                            {layerResult.pptx_url && (
                              <a
                                href={layerResult.pptx_url}
                                download
                                className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                PPTX татах
                              </a>
                            )}
                          </div>

                          {/* Layer Info */}
                          <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                            <h4 className="text-cyan-400 font-medium mb-2 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Layer-үүдийн тухай
                            </h4>
                            <p className="text-zinc-300 text-sm">
                              Qwen-Image-Layered model нь зургийг RGBA layer-үүдэд задалж, тус бүрийг бие даан засварлах боломжийг олгоно.
                              Photoshop эсвэл бусад редактор дээр layer бүрийг тусад нь засварлаж болно.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Variations Tab */}
                  {activeTab === "variations" && (
                    <div className="space-y-4">
                      {generatedImages.length === 0 ? (
                        <div className="p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-center">
                          <svg className="w-16 h-16 text-zinc-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-zinc-400 mb-4">
                            Сайжруулсан хувилбар үүсгэхийн тулд &quot;Ерөнхий&quot; таб дээр товчийг дарна уу
                          </p>
                          <button
                            onClick={() => setActiveTab("overview")}
                            className="text-emerald-400 hover:text-emerald-300 text-sm"
                          >
                            Ерөнхий таб руу очих →
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Variation Grid */}
                          <div className="grid grid-cols-2 gap-3">
                            {generatedImages.map((genImg, idx) => (
                              <button
                                key={idx}
                                onClick={() => setSelectedVariation(idx)}
                                className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all ${
                                  selectedVariation === idx
                                    ? "border-emerald-400 ring-2 ring-emerald-400/50"
                                    : "border-zinc-700 hover:border-zinc-500"
                                }`}
                              >
                                <Image
                                  src={genImg.imageData}
                                  alt={`Variation ${idx + 1}`}
                                  fill
                                  className="object-cover"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                  <p className="text-white text-xs font-medium">
                                    {analysisResult.variations[idx]?.name}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>

                          {/* Selected Variation Details */}
                          {selectedVariation !== null && analysisResult.variations[selectedVariation] && (
                            <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h3 className="text-white font-semibold">
                                    {analysisResult.variations[selectedVariation].name}
                                  </h3>
                                  <p className="text-emerald-400 text-sm">
                                    {analysisResult.variations[selectedVariation].philosophy}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  {generatedImages.find(img => img.index === selectedVariation) && (
                                    <button
                                      onClick={() => handleDownload(
                                        generatedImages.find(img => img.index === selectedVariation)!.imageData,
                                        selectedVariation
                                      )}
                                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                      </svg>
                                      Татах
                                    </button>
                                  )}
                                </div>
                              </div>

                              {analysisResult.variations[selectedVariation].what_changes && (
                                <p className="text-zinc-300 text-sm">
                                  {analysisResult.variations[selectedVariation].what_changes}
                                </p>
                              )}

                              {analysisResult.variations[selectedVariation].steve_note && (
                                <div className="border-l-2 border-cyan-500/50 pl-3">
                                  <p className="text-cyan-400 text-sm italic">
                                    &ldquo;{analysisResult.variations[selectedVariation].steve_note}&rdquo;
                                  </p>
                                </div>
                              )}

                              {/* Prompt Editing Section */}
                              <div className="border-t border-zinc-700 pt-4">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-zinc-400 text-xs font-medium">Prompt засах:</h4>
                                  {editingPromptIndex !== selectedVariation && (
                                    <button
                                      onClick={() => {
                                        setEditingPromptIndex(selectedVariation);
                                        if (!editedPrompts[selectedVariation]) {
                                          setEditedPrompts(prev => ({
                                            ...prev,
                                            [selectedVariation]: analysisResult.variations[selectedVariation].prompt
                                          }));
                                        }
                                      }}
                                      className="text-purple-400 hover:text-purple-300 text-xs flex items-center gap-1"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                      Засах
                                    </button>
                                  )}
                                </div>

                                {editingPromptIndex === selectedVariation ? (
                                  <div className="space-y-3">
                                    <textarea
                                      value={editedPrompts[selectedVariation] || analysisResult.variations[selectedVariation].prompt}
                                      onChange={(e) => setEditedPrompts(prev => ({
                                        ...prev,
                                        [selectedVariation]: e.target.value
                                      }))}
                                      className="w-full h-32 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-300 text-sm resize-none focus:outline-none focus:border-purple-500"
                                      placeholder="Prompt засах..."
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleRegenerateVariation(selectedVariation)}
                                        disabled={regeneratingIndex === selectedVariation}
                                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                                          regeneratingIndex === selectedVariation
                                            ? "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                                            : "bg-purple-500 hover:bg-purple-400 text-white"
                                        }`}
                                      >
                                        {regeneratingIndex === selectedVariation ? (
                                          <>
                                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Үүсгэж байна...
                                          </>
                                        ) : (
                                          <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Дахин үүсгэх
                                          </>
                                        )}
                                      </button>
                                      <button
                                        onClick={() => setEditingPromptIndex(null)}
                                        className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg text-sm font-medium transition-colors"
                                      >
                                        Болих
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-zinc-500 text-xs bg-zinc-800/50 rounded-lg p-2 max-h-20 overflow-y-auto">
                                    {editedPrompts[selectedVariation] || analysisResult.variations[selectedVariation].prompt}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Features - show when no analysis */}
              {!analysisResult && !error && (
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-white font-medium mb-1">Мэргэжлийн шинжилгээ</h4>
                        <p className="text-zinc-500 text-sm">
                          Gestalt, Color Theory, Typography, Layout зарчмуудын дагуу шинжилнэ
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-white font-medium mb-1">Категори бүрээр оноо</h4>
                        <p className="text-zinc-500 text-sm">
                          5 категорид тус бүрд нь дэлгэрэнгүй оноо, санал өгнө
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-white font-medium mb-1">Суралцах боломж</h4>
                        <p className="text-zinc-500 text-sm">
                          Ямар зарчим хэрэглэсэн, зөрчсөнийг тайлбарлана
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-zinc-500 text-sm">
            &copy; 2025 Reko. Design Principles Database ашигласан.
          </p>
        </div>
      </footer>
    </div>
  );
}
