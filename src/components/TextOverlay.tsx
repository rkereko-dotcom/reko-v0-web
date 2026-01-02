"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";

// Text element interface
export interface TextElement {
  id: string;
  text: string;
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  fontSize: number; // percentage of canvas height
  fontFamily: string;
  fontWeight: number;
  color: string;
  textAlign: "left" | "center" | "right";
  letterSpacing: number; // em units
  lineHeight: number;
  maxWidth: number; // percentage of canvas width
  opacity: number;
  rotation: number; // degrees
}

// Preset text layouts based on design styles
export const TEXT_PRESETS: Record<string, TextElement[]> = {
  minimal: [
    {
      id: "headline",
      text: "HEADLINE",
      x: 50,
      y: 25,
      fontSize: 8,
      fontFamily: "Inter",
      fontWeight: 300,
      color: "#1A1A1A",
      textAlign: "center",
      letterSpacing: 0.2,
      lineHeight: 1.1,
      maxWidth: 80,
      opacity: 1,
      rotation: 0,
    },
    {
      id: "subheadline",
      text: "Subheadline text here",
      x: 50,
      y: 35,
      fontSize: 2.5,
      fontFamily: "Inter",
      fontWeight: 400,
      color: "#666666",
      textAlign: "center",
      letterSpacing: 0.05,
      lineHeight: 1.5,
      maxWidth: 60,
      opacity: 1,
      rotation: 0,
    },
  ],
  bold: [
    {
      id: "headline",
      text: "BOLD",
      x: 50,
      y: 50,
      fontSize: 20,
      fontFamily: "Inter",
      fontWeight: 900,
      color: "#FFFFFF",
      textAlign: "center",
      letterSpacing: -0.05,
      lineHeight: 0.9,
      maxWidth: 90,
      opacity: 1,
      rotation: 0,
    },
  ],
  classic: [
    {
      id: "headline",
      text: "Elegant Title",
      x: 50,
      y: 30,
      fontSize: 7,
      fontFamily: "Playfair Display",
      fontWeight: 400,
      color: "#1A1A1A",
      textAlign: "center",
      letterSpacing: 0.02,
      lineHeight: 1.2,
      maxWidth: 80,
      opacity: 1,
      rotation: 0,
    },
    {
      id: "subheadline",
      text: "A refined subtitle",
      x: 50,
      y: 40,
      fontSize: 2.5,
      fontFamily: "Inter",
      fontWeight: 400,
      color: "#666666",
      textAlign: "center",
      letterSpacing: 0.1,
      lineHeight: 1.5,
      maxWidth: 70,
      opacity: 1,
      rotation: 0,
    },
  ],
  modern: [
    {
      id: "headline",
      text: "Modern\nDesign",
      x: 10,
      y: 20,
      fontSize: 10,
      fontFamily: "Inter",
      fontWeight: 700,
      color: "#1A1A1A",
      textAlign: "left",
      letterSpacing: -0.02,
      lineHeight: 1.0,
      maxWidth: 80,
      opacity: 1,
      rotation: 0,
    },
  ],
  japanese: [
    {
      id: "headline",
      text: "静寂",
      x: 50,
      y: 30,
      fontSize: 12,
      fontFamily: "Noto Serif JP",
      fontWeight: 400,
      color: "#1A1A1A",
      textAlign: "center",
      letterSpacing: 0.3,
      lineHeight: 1.4,
      maxWidth: 80,
      opacity: 1,
      rotation: 0,
    },
  ],
};

interface TextOverlayProps {
  backgroundImage: string;
  elements: TextElement[];
  width?: number;
  height?: number;
  editable?: boolean;
  onElementsChange?: (elements: TextElement[]) => void;
  className?: string;
}

export function TextOverlay({
  backgroundImage,
  elements,
  width = 540,
  height = 960,
  editable = false,
  onElementsChange,
  className = "",
}: TextOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Render canvas
  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background image
    const img = new Image();
    img.crossOrigin = "anonymous";

    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        // Cover fill
        const imgRatio = img.width / img.height;
        const canvasRatio = width / height;
        let drawWidth = width;
        let drawHeight = height;
        let drawX = 0;
        let drawY = 0;

        if (imgRatio > canvasRatio) {
          drawWidth = height * imgRatio;
          drawX = (width - drawWidth) / 2;
        } else {
          drawHeight = width / imgRatio;
          drawY = (height - drawHeight) / 2;
        }

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        resolve();
      };
      img.onerror = reject;
      img.src = backgroundImage;
    });

    // Draw text elements
    for (const element of elements) {
      ctx.save();

      // Calculate position
      const x = (element.x / 100) * width;
      const y = (element.y / 100) * height;
      const fontSize = (element.fontSize / 100) * height;
      const maxWidth = (element.maxWidth / 100) * width;

      // Apply transformations
      ctx.translate(x, y);
      ctx.rotate((element.rotation * Math.PI) / 180);

      // Set text styles
      ctx.font = `${element.fontWeight} ${fontSize}px "${element.fontFamily}", sans-serif`;
      ctx.fillStyle = element.color;
      ctx.globalAlpha = element.opacity;
      ctx.textAlign = element.textAlign;
      ctx.textBaseline = "top";

      // Handle letter spacing (approximate)
      const letterSpacing = element.letterSpacing * fontSize;

      // Split text into lines
      const lines = element.text.split("\n");
      let currentY = 0;

      for (const line of lines) {
        if (letterSpacing !== 0) {
          // Draw with letter spacing
          let currentX = 0;
          if (element.textAlign === "center") {
            currentX = -ctx.measureText(line).width / 2;
          } else if (element.textAlign === "right") {
            currentX = -ctx.measureText(line).width;
          }

          for (const char of line) {
            ctx.fillText(char, currentX, currentY);
            currentX += ctx.measureText(char).width + letterSpacing;
          }
        } else {
          // Word wrap
          const words = line.split(" ");
          let currentLine = "";
          let lineY = currentY;

          for (const word of words) {
            const testLine = currentLine + word + " ";
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && currentLine !== "") {
              let drawX = 0;
              if (element.textAlign === "center") drawX = 0;
              else if (element.textAlign === "right") drawX = maxWidth / 2;
              else drawX = -maxWidth / 2;

              ctx.fillText(currentLine.trim(), drawX, lineY);
              currentLine = word + " ";
              lineY += fontSize * element.lineHeight;
            } else {
              currentLine = testLine;
            }
          }

          let drawX = 0;
          if (element.textAlign === "center") drawX = 0;
          else if (element.textAlign === "right") drawX = maxWidth / 2;
          else drawX = -maxWidth / 2;

          ctx.fillText(currentLine.trim(), drawX, lineY);
          currentY = lineY + fontSize * element.lineHeight;
        }

        currentY += fontSize * element.lineHeight;
      }

      // Draw selection indicator if editable
      if (editable && selectedElement === element.id) {
        ctx.strokeStyle = "#3B82F6";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        const textWidth = ctx.measureText(element.text).width;
        ctx.strokeRect(-textWidth / 2 - 10, -10, textWidth + 20, fontSize + 20);
      }

      ctx.restore();
    }
  }, [backgroundImage, elements, width, height, editable, selectedElement]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Handle mouse events for editing
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!editable) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = ((e.clientX - rect.left) * scaleX / width) * 100;
    const y = ((e.clientY - rect.top) * scaleY / height) * 100;

    // Find clicked element
    for (const element of elements) {
      const dx = Math.abs(x - element.x);
      const dy = Math.abs(y - element.y);

      if (dx < 15 && dy < 10) {
        setSelectedElement(element.id);
        setIsDragging(true);
        setDragStart({ x: x - element.x, y: y - element.y });
        return;
      }
    }

    setSelectedElement(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedElement || !onElementsChange) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = ((e.clientX - rect.left) * scaleX / width) * 100;
    const y = ((e.clientY - rect.top) * scaleY / height) * 100;

    const newElements = elements.map((el) =>
      el.id === selectedElement
        ? { ...el, x: x - dragStart.x, y: y - dragStart.y }
        : el
    );

    onElementsChange(newElements);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Export as PNG
  const exportAsPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = "design-export.png";
    link.href = dataUrl;
    link.click();
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-auto"
        style={{ maxWidth: width, maxHeight: height }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      {editable && (
        <button
          onClick={exportAsPng}
          className="absolute bottom-2 right-2 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
        >
          Export PNG
        </button>
      )}
    </div>
  );
}

// Helper to create text elements from poster analysis
export function createTextElementsFromAnalysis(
  elements: {
    title: string;
    subtitle: string | null;
    bodyText: string[];
  },
  style: string
): TextElement[] {
  const preset = TEXT_PRESETS[style.toLowerCase()] || TEXT_PRESETS.minimal;
  const result: TextElement[] = [];

  // Find headline preset
  const headlinePreset = preset.find((p) => p.id === "headline");
  if (headlinePreset && elements.title) {
    result.push({
      ...headlinePreset,
      id: "headline",
      text: elements.title,
    });
  }

  // Find subheadline preset
  const subheadlinePreset = preset.find((p) => p.id === "subheadline");
  if (subheadlinePreset && elements.subtitle) {
    result.push({
      ...subheadlinePreset,
      id: "subheadline",
      text: elements.subtitle,
    });
  }

  // Add body text if present
  if (elements.bodyText && elements.bodyText.length > 0) {
    result.push({
      id: "body",
      text: elements.bodyText.join("\n"),
      x: 50,
      y: 70,
      fontSize: 2,
      fontFamily: "Inter",
      fontWeight: 400,
      color: "#666666",
      textAlign: "center",
      letterSpacing: 0,
      lineHeight: 1.6,
      maxWidth: 70,
      opacity: 1,
      rotation: 0,
    });
  }

  return result;
}

export default TextOverlay;
