"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";

// Category scores interface
interface CategoryScores {
  gestalt: {
    score: number;
    principles_used: string[];
    principles_violated: string[];
    feedback: string;
  };
  color: {
    score: number;
    harmony_type: string;
    palette: string[];
    temperature: string;
    feedback: string;
  };
  typography: {
    score: number;
    hierarchy_clear: boolean;
    fonts_detected: string[];
    readability: string;
    feedback: string;
  };
  layout: {
    score: number;
    balance: string;
    whitespace: string;
    alignment: string;
    feedback: string;
  };
  composition: {
    score: number;
    focal_point: boolean;
    visual_flow: string;
    feedback: string;
  };
}

interface PosterElements {
  title: string;
  subtitle: string | null;
  bodyText: string[];
  colors: {
    primary: string;
    secondary: string;
    background: string;
    accent: string;
  };
  images: string[];
  logo: string | null;
  style: string;
  purpose: string;
}

interface DesignVariation {
  name: string;
  principle: string;
  description: string;
  improvements: string[];
  prompt: string;
}

interface PrincipleDetail {
  id: string;
  name: string;
  name_mn: string;
  status: "applied" | "violated" | "neutral";
  explanation: string;
  suggestion?: string;
}

interface AnalysisResult {
  score: number;
  category_scores?: CategoryScores;
  feedback: {
    strengths: string[];
    improvements: string[];
    overall: string;
  };
  principles_analysis?: PrincipleDetail[];
  elements: PosterElements;
  variations: DesignVariation[];
  learning_points?: string[];
}

interface GeneratedImage {
  index: number;
  imageData: string;
  prompt: string;
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (file && file.type.startsWith("image/")) {
      setFileName(file.name);
      setAnalysisResult(null);
      setGeneratedImages([]);
      setError(null);
      setActiveTab("overview");
      setSelectedVariation(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Алдаа гарлаа");
      }

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
      const prompts = analysisResult.variations.map((v) => v.prompt);

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompts }),
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
      case "gestalt":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        );
      case "color":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        );
      case "typography":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        );
      case "layout":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
        );
      case "composition":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getCategoryName = (category: string) => {
    const names: Record<string, string> = {
      gestalt: "Gestalt",
      color: "Өнгө",
      typography: "Typography",
      layout: "Layout",
      composition: "Composition",
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
                        Нийт оноо
                      </h3>
                      <p className="text-white text-lg mb-3">
                        {analysisResult.score >= 80
                          ? "Маш сайн дизайн!"
                          : analysisResult.score >= 60
                          ? "Сайн дизайн, бага зэрэг сайжруулалт хэрэгтэй"
                          : "Сайжруулах зүйлс их байна"}
                      </p>
                      {/* Color Palette */}
                      {analysisResult.category_scores?.color?.palette && (
                        <div className="flex gap-1">
                          {analysisResult.category_scores.color.palette.map((color, i) => (
                            <div
                              key={i}
                              className="w-8 h-8 rounded-lg border border-zinc-700"
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
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
                      { id: "overview", label: "Ерөнхий" },
                      { id: "details", label: "Дэлгэрэнгүй" },
                      { id: "principles", label: "Зарчмууд" },
                      { id: "layers", label: `Layers ${layerResult ? `(${layerResult.layers.length})` : ""}` },
                      { id: "variations", label: `Хувилбар (${generatedImages.length})` },
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

                      {/* Strengths & Improvements */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                          <h4 className="text-emerald-400 font-medium mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Давуу талууд
                          </h4>
                          <ul className="space-y-2">
                            {analysisResult.feedback.strengths.map((s, i) => (
                              <li key={i} className="text-zinc-300 text-sm flex items-start gap-2">
                                <span className="text-emerald-400 mt-1">•</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                          <h4 className="text-yellow-400 font-medium mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Сайжруулах
                          </h4>
                          <ul className="space-y-2">
                            {analysisResult.feedback.improvements.map((s, i) => (
                              <li key={i} className="text-zinc-300 text-sm flex items-start gap-2">
                                <span className="text-yellow-400 mt-1">•</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Learning Points */}
                      {analysisResult.learning_points && analysisResult.learning_points.length > 0 && (
                        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                          <h4 className="text-purple-400 font-medium mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            Суралцах зүйлс
                          </h4>
                          <ul className="space-y-2">
                            {analysisResult.learning_points.map((point, i) => (
                              <li key={i} className="text-zinc-300 text-sm flex items-start gap-2">
                                <span className="text-purple-400 mt-1">{i + 1}.</span>
                                {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

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
                            Сайжруулсан хувилбар үүсгэж байна...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Сайжруулсан хувилбар үүсгэх
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Details Tab - Category Scores */}
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
                        <h4 className="text-white font-medium mb-3">Илрүүлсэн элементүүд</h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-zinc-500">Стиль:</span>
                            <span className="text-zinc-300 ml-2">{analysisResult.elements.style}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Зорилго:</span>
                            <span className="text-zinc-300 ml-2">{analysisResult.elements.purpose}</span>
                          </div>
                          {analysisResult.category_scores.color && (
                            <>
                              <div>
                                <span className="text-zinc-500">Өнгөний harmony:</span>
                                <span className="text-zinc-300 ml-2">{analysisResult.category_scores.color.harmony_type}</span>
                              </div>
                              <div>
                                <span className="text-zinc-500">Температур:</span>
                                <span className="text-zinc-300 ml-2">{analysisResult.category_scores.color.temperature}</span>
                              </div>
                            </>
                          )}
                          {analysisResult.category_scores.layout && (
                            <>
                              <div>
                                <span className="text-zinc-500">Тэнцвэр:</span>
                                <span className="text-zinc-300 ml-2">{analysisResult.category_scores.layout.balance}</span>
                              </div>
                              <div>
                                <span className="text-zinc-500">Alignment:</span>
                                <span className="text-zinc-300 ml-2">{analysisResult.category_scores.layout.alignment}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Principles Tab */}
                  {activeTab === "principles" && (
                    <div className="space-y-3">
                      {analysisResult.principles_analysis && analysisResult.principles_analysis.length > 0 ? (
                        analysisResult.principles_analysis.map((principle, i) => (
                          <div
                            key={i}
                            className={`p-4 rounded-xl border ${
                              principle.status === "applied"
                                ? "bg-emerald-500/10 border-emerald-500/30"
                                : principle.status === "violated"
                                ? "bg-red-500/10 border-red-500/30"
                                : "bg-zinc-900/50 border-zinc-800"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="text-white font-medium">{principle.name}</span>
                                <span className="text-zinc-500 text-sm ml-2">({principle.name_mn})</span>
                              </div>
                              <span
                                className={`text-xs px-2 py-1 rounded-full ${
                                  principle.status === "applied"
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : principle.status === "violated"
                                    ? "bg-red-500/20 text-red-400"
                                    : "bg-zinc-700 text-zinc-400"
                                }`}
                              >
                                {principle.status === "applied" ? "Хэрэглэсэн" : principle.status === "violated" ? "Зөрчсөн" : "Төвийг сахисан"}
                              </span>
                            </div>
                            <p className="text-zinc-300 text-sm">{principle.explanation}</p>
                            {principle.suggestion && (
                              <p className="text-yellow-400 text-sm mt-2 flex items-start gap-2">
                                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                {principle.suggestion}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-center">
                          <p className="text-zinc-400">Зарчмуудын шинжилгээ байхгүй байна</p>
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
                                    {analysisResult.variations[selectedVariation].principle}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleDownload(generatedImages[selectedVariation].imageData, selectedVariation)}
                                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                  Татах
                                </button>
                              </div>

                              <p className="text-zinc-300 text-sm">
                                {analysisResult.variations[selectedVariation].description}
                              </p>

                              <div>
                                <h4 className="text-zinc-400 text-xs font-medium mb-2">Сайжруулалтууд:</h4>
                                <ul className="space-y-1">
                                  {analysisResult.variations[selectedVariation].improvements.map((imp, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm text-zinc-300">
                                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      {imp}
                                    </li>
                                  ))}
                                </ul>
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
