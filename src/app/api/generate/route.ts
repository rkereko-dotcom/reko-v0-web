import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import fs from "fs";
import path from "path";

// Folder to save generated images
const SAVE_FOLDER = path.join(process.cwd(), "generated-images");

// Ensure save folder exists
if (!fs.existsSync(SAVE_FOLDER)) {
  fs.mkdirSync(SAVE_FOLDER, { recursive: true });
}

// Save image to disk and return the file path
function saveImageToDisk(imageData: string, variationName: string, index: number): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const safeName = variationName.replace(/[^a-zA-Z0-9-_ ]/g, "").slice(0, 30);
  const filename = `${timestamp}_${index}_${safeName}.png`;
  const filePath = path.join(SAVE_FOLDER, filename);

  // Extract base64 data and save
  const base64Match = imageData.match(/^data:(.+);base64,(.+)$/);
  if (base64Match) {
    const buffer = Buffer.from(base64Match[2], "base64");
    fs.writeFileSync(filePath, buffer);
    console.log(`💾 Saved: ${filename}`);
    return filePath;
  }
  return "";
}

// Increase timeout for image generation
export const maxDuration = 60;

const HF_TOKEN = process.env.HF_TOKEN;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5" | "3:4";

interface GenerateRequest {
  prompts: string[];
  provider?: "flux" | "nano" | "gemini3";  // Default: nano (uses Gemini 3 Flash)
  aspectRatio?: AspectRatio;   // Default: 9:16
  parallel?: boolean;          // Default: true
  originalImage?: string;      // Base64 original image for image-to-image improvement
  preserveMode?: "full" | "background-only";  // full = Gemini sees original, background-only = composite approach
}

interface GeneratedImage {
  index: number;
  imageData: string;
  prompt: string;
  provider: string;
}

// HuggingFace Inference API endpoint for FLUX.1-dev (high quality, open-weight)
const HF_INFERENCE_URL = "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-dev";

// Get dimensions from aspect ratio
function getDimensions(aspectRatio: AspectRatio): { width: number; height: number } {
  const dimensions: Record<AspectRatio, { width: number; height: number }> = {
    "9:16": { width: 768, height: 1344 },   // Portrait poster
    "16:9": { width: 1344, height: 768 },   // Landscape
    "1:1": { width: 1024, height: 1024 },   // Square
    "4:5": { width: 896, height: 1120 },    // Instagram portrait
    "3:4": { width: 768, height: 1024 },    // Standard portrait
  };
  return dimensions[aspectRatio] || dimensions["9:16"];
}

// Remove background using Replicate's BiRefNet model
async function removeBackground(imageBase64: string): Promise<Buffer> {
  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API token not configured");
  }

  console.log("🔄 Calling BiRefNet via Replicate API...");

  // BiRefNet model on Replicate - men1scus/birefnet
  // API accepts data URI directly
  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
      "Prefer": "wait", // Use sync mode for faster response
    },
    body: JSON.stringify({
      version: "f74986db0355b58403ed20963af156525e2891ea3c2d499bfbfb2a28cd87c5d7",
      input: {
        image: imageBase64, // BiRefNet accepts data URI
        resolution: "1024x1024",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Replicate API error: ${JSON.stringify(error)}`);
  }

  let result = await response.json();

  // Poll for completion if not using sync mode
  while (result.status === "starting" || result.status === "processing") {
    console.log(`BiRefNet status: ${result.status}...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const pollResponse = await fetch(result.urls.get, {
      headers: { "Authorization": `Bearer ${REPLICATE_API_TOKEN}` },
    });
    result = await pollResponse.json();
  }

  if (result.status === "failed") {
    throw new Error(`BiRefNet failed: ${result.error}`);
  }

  console.log("✅ BiRefNet completed!");

  // result.output is a URL to the PNG with transparent background
  const imageUrl = result.output;
  const imageResponse = await fetch(imageUrl);
  const arrayBuffer = await imageResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Generate ONLY background image (no person, no text - just background)
async function generateBackgroundOnly(prompt: string, width: number, height: number): Promise<string | null> {
  if (!GOOGLE_AI_API_KEY) {
    throw new Error("Google AI API key тохируулаагүй байна");
  }

  const backgroundPrompt = `Generate ONLY a background image. No people, no text, no objects in the foreground.

STYLE: ${prompt}

REQUIREMENTS:
- This is a BACKGROUND ONLY - it will have elements placed on top of it
- Make it visually interesting but not distracting
- Good for a poster/thumbnail background
- Aspect ratio: ${width}x${height}
- The background should complement the style described above

Generate a clean, professional background now.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GOOGLE_AI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: backgroundPrompt }] }],
        generationConfig: { responseModalities: ["image", "text"] },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Gemini Background API error:", JSON.stringify(errorData));
    throw new Error(`Gemini API: ${errorData?.error?.message || response.status}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];

  for (const part of parts) {
    if (part.inlineData) {
      const mimeType = part.inlineData.mimeType || "image/png";
      return `data:${mimeType};base64,${part.inlineData.data}`;
    }
  }
  return null;
}

// Composite foreground onto new background
async function compositeOntoBackground(
  foregroundPng: Buffer,
  backgroundBase64: string,
  originalWidth: number,
  originalHeight: number
): Promise<string> {
  // Extract background base64
  const bgMatch = backgroundBase64.match(/^data:(.+);base64,(.+)$/);
  if (!bgMatch) throw new Error("Invalid background format");
  const bgBuffer = Buffer.from(bgMatch[2], "base64");

  // Resize background to match original dimensions
  const resizedBackground = await sharp(bgBuffer)
    .resize(originalWidth, originalHeight, { fit: "cover" })
    .toBuffer();

  // Ensure foreground has same dimensions
  const resizedForeground = await sharp(foregroundPng)
    .resize(originalWidth, originalHeight, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // Composite foreground onto background
  const result = await sharp(resizedBackground)
    .composite([{ input: resizedForeground, blend: "over" }])
    .png()
    .toBuffer();

  return `data:image/png;base64,${result.toString("base64")}`;
}

// Gemini 2.5 Flash Image generation with image-to-image support
// When originalImage is provided, Gemini will SEE the original and IMPROVE it
async function generateWithGemini(prompt: string, originalImage?: string): Promise<string | null> {
  if (!GOOGLE_AI_API_KEY) {
    throw new Error("Google AI API key тохируулаагүй байна");
  }

  // Build the parts array - with or without original image
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  // If we have the original image, include it so Gemini can SEE and IMPROVE it
  if (originalImage) {
    // Extract base64 data from data URL
    const base64Match = originalImage.match(/^data:(.+);base64,(.+)$/);
    if (base64Match) {
      const mimeType = base64Match[1];
      const base64Data = base64Match[2];
      parts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });

      // Check if this is a REDESIGN prompt (for bad posters) or ARTISTIC STYLE prompt (for good posters)
      const isRedesign = prompt.includes("🔧 REDESIGN") || prompt.includes("REDESIGN");

      if (isRedesign) {
        // REDESIGN MODE - For bad posters that need fundamental changes
        parts.push({
          text: `You are an elite poster designer COMPLETELY REDESIGNING this image.

REDESIGN INSTRUCTIONS:
${prompt}

═══════════════════════════════════════════════════
🔧 REDESIGN MODE - FUNDAMENTAL TRANSFORMATION
═══════════════════════════════════════════════════

This poster needs a COMPLETE REDESIGN. Apply these principles:

1. SIMPLIFY RUTHLESSLY
   - Remove ALL decorative noise (random blobs, gradients, unnecessary elements)
   - Keep ONLY what communicates the message
   - If an element doesn't serve a purpose, DELETE IT

2. ONE MESSAGE RULE
   - Find the CORE message and make it dominant
   - Everything else is secondary or removed
   - The viewer should understand in 2-3 seconds

3. GRID SYSTEM
   - Rebuild the layout with structure
   - Align elements intentionally
   - Create visual order from chaos

4. BREATHING ROOM
   - Add 50-70% empty/white space
   - Let elements breathe
   - Crowded = amateur, Space = professional

5. COLOR DISCIPLINE
   - Maximum 2-3 colors
   - One main color + one accent color
   - Remove color chaos

6. CLEAR HIERARCHY
   - Big = important, Small = secondary
   - Guide the viewer's eye
   - Clear reading order

7. MEANINGFUL VISUALS ONLY
   - Every visual element must communicate something
   - No decoration for decoration's sake
   - If there's a person, preserve their face exactly

═══════════════════════════════════════════════════
PRESERVE (if present):
- Person's face - MUST be identical
- Core message/text content (can be restyled)
- Brand elements

COMPLETELY CHANGE:
- Layout and composition
- Background
- Typography style
- Color scheme
- Visual hierarchy
- Remove all noise and clutter
═══════════════════════════════════════════════════

Generate the REDESIGNED version now. This should look like a PROFESSIONAL redesign, not a filter.`,
        });
      } else {
        // ARTISTIC STYLE MODE - For good posters that just need style variations
        parts.push({
          text: `You are an elite poster designer transforming this image.

TRANSFORMATION STYLE:
${prompt}

═══════════════════════════════════════════════════
🔒 SACRED - DO NOT CHANGE:
═══════════════════════════════════════════════════

1. FACE IS SACRED
   - The person's face must be PIXEL-PERFECT IDENTICAL
   - Same facial features, same expression, same eyes looking same direction
   - Same skin tone, same glasses if any
   - If you change the face even 1% - YOU HAVE FAILED
   - This is non-negotiable. The person must be RECOGNIZABLE.

2. CORE CONCEPT IS SACRED
   - The main message/story of the poster stays the same
   - If it's about "$0 to $29" - that story remains
   - If it's about transformation - keep that narrative
   - The MEANING doesn't change, only the PRESENTATION

3. TEXT CONTENT IS SACRED
   - All text must say the SAME THING (same meaning)
   - "$0" stays "$0", "$29" stays "$29"
   - You can make text MORE BEAUTIFUL, BIGGER, BETTER STYLED
   - But the WORDS and NUMBERS stay the same

4. ICONS & VISUAL ELEMENTS - KEEP AND IMPROVE
   - If there are social media icons - KEEP THEM, make them prettier
   - If there are arrows, symbols - KEEP THEM, style them better
   - Don't remove elements, ELEVATE them

═══════════════════════════════════════════════════
✅ YOU CAN AND SHOULD CHANGE:
═══════════════════════════════════════════════════

1. CLOTHING - CHANGE IT DRAMATICALLY!
   - You MUST change the clothing to match the artistic style
   - Don't keep the original clothes - CREATE NEW OUTFIT!
   - Examples of clothing changes:
     * Watercolor style → Soft pastel sweater, flowy fabrics, artistic look
     * Pencil sketch → Simple white t-shirt, casual hoodie, minimal
     * Professional → Sharp gray suit, business casual, premium look
     * Bold/Vibrant → Bright colored jacket, bold patterns, eye-catching
   - The clothing should look like it BELONGS in the artistic style
   - Original blue suit can become: sweater, hoodie, t-shirt, different colored suit, casual shirt, etc.

2. BACKGROUND - COMPLETELY NEW
   - Create a new background that matches the artistic style
   - Can be completely different from original
   - Should enhance the poster's message

3. COLORS & LIGHTING
   - Apply the artistic style's color palette
   - Better lighting, shadows, highlights
   - Color grading that fits the mood

4. COMPOSITION & UI
   - Improve the layout if needed
   - Better spacing, alignment
   - More professional arrangement
   - Fix bad aspect ratios

5. ARTISTIC STYLE
   - Apply the specified artistic effect fully
   - Watercolor = soft, flowing, painterly, dreamy colors
   - Pencil sketch = detailed lines, hand-drawn feel, paper texture
   - Professional = clean, modern, polished, premium
   - Bold = high contrast, vibrant, neon accents, eye-catching

═══════════════════════════════════════════════════
GENERATE THE TRANSFORMED VERSION NOW.
The person's face MUST be identical. Everything else can be elevated.
═══════════════════════════════════════════════════`,
        });
      }
    } else {
      // Fallback if image format is wrong
      parts.push({ text: `Generate an image: ${prompt}` });
    }
  } else {
    // No original image - just generate from text
    parts.push({ text: `Generate an image: ${prompt}` });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GOOGLE_AI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts,
          },
        ],
        generationConfig: {
          responseModalities: ["image", "text"],
        },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Gemini Image API error:", JSON.stringify(errorData));
    const errorMessage = errorData?.error?.message || `Status ${response.status}`;
    throw new Error(`Gemini 3 API: ${errorMessage}`);
  }

  const data = await response.json();
  const responseParts = data.candidates?.[0]?.content?.parts || [];

  for (const part of responseParts) {
    if (part.inlineData) {
      const mimeType = part.inlineData.mimeType || "image/png";
      return `data:${mimeType};base64,${part.inlineData.data}`;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { prompts, provider = "nano", aspectRatio = "9:16", parallel = true, originalImage, preserveMode = "full" }: GenerateRequest = await request.json();

    if (!prompts || prompts.length === 0) {
      return NextResponse.json(
        { error: "Prompt илгээгдээгүй байна" },
        { status: 400 }
      );
    }

    // Check API keys based on provider
    if (provider === "flux" && !HF_TOKEN) {
      return NextResponse.json(
        { error: "HuggingFace token тохируулаагүй байна" },
        { status: 500 }
      );
    }
    if (provider === "nano" && !GOOGLE_AI_API_KEY) {
      return NextResponse.json(
        { error: "Google AI API key тохируулаагүй байна" },
        { status: 500 }
      );
    }

    const dimensions = getDimensions(aspectRatio);

    // BACKGROUND-ONLY MODE: Extract foreground once, generate backgrounds, composite
    // This guarantees 100% preservation of person, text, and icons
    if (originalImage && preserveMode === "background-only" && provider === "nano") {
      console.log(`🎨 BACKGROUND-ONLY MODE: Preserving ALL foreground elements (person, text, icons)`);
      console.log(`📸 Extracting foreground from original image...`);

      // Get original image dimensions
      const base64Match = originalImage.match(/^data:(.+);base64,(.+)$/);
      if (!base64Match) {
        return NextResponse.json({ error: "Invalid image format" }, { status: 400 });
      }
      const originalBuffer = Buffer.from(base64Match[2], "base64");
      const originalMetadata = await sharp(originalBuffer).metadata();
      const origWidth = originalMetadata.width || 1280;
      const origHeight = originalMetadata.height || 720;
      console.log(`📐 Original dimensions: ${origWidth}x${origHeight}`);

      // Extract foreground (person + text + icons) - only do this ONCE
      let foregroundPng: Buffer;
      try {
        foregroundPng = await removeBackground(originalImage);
        console.log(`✅ Foreground extracted successfully!`);
      } catch (err) {
        console.error(`❌ Background removal failed:`, err);
        // Fallback to image-to-image mode
        console.log(`⚠️ Falling back to image-to-image mode...`);
        // Continue below with regular mode
        foregroundPng = null as unknown as Buffer;
      }

      if (foregroundPng) {
        // Generate backgrounds and composite
        const generateWithComposite = async (prompt: string, index: number): Promise<GeneratedImage | null> => {
          try {
            console.log(`🖼️ Generating background ${index}...`);
            const backgroundImage = await generateBackgroundOnly(prompt, origWidth, origHeight);
            if (!backgroundImage) {
              console.error(`❌ Background generation failed for ${index}`);
              return null;
            }
            console.log(`✅ Background ${index} generated!`);

            console.log(`🔧 Compositing foreground onto background ${index}...`);
            const finalImage = await compositeOntoBackground(foregroundPng, backgroundImage, origWidth, origHeight);
            console.log(`✅ Image ${index} complete! 100% original elements preserved.`);

            return { index, imageData: finalImage, prompt, provider: "gemini-composite" };
          } catch (err) {
            console.error(`❌ Error in composite generation ${index}:`, err);
            return null;
          }
        };

        let generatedImages: GeneratedImage[] = [];

        if (parallel && prompts.length > 1) {
          console.log("Starting parallel background generation...");
          const results = await Promise.allSettled(
            prompts.map((prompt, index) => generateWithComposite(prompt, index))
          );

          generatedImages = results
            .filter((r): r is PromiseFulfilledResult<GeneratedImage | null> => r.status === "fulfilled" && r.value !== null)
            .map(r => r.value as GeneratedImage)
            .sort((a, b) => a.index - b.index);
        } else {
          for (let i = 0; i < prompts.length; i++) {
            const result = await generateWithComposite(prompts[i], i);
            if (result) generatedImages.push(result);
          }
        }

        if (generatedImages.length === 0) {
          return NextResponse.json(
            { error: "Зураг үүсгэхэд алдаа гарлаа", details: "Background generation failed" },
            { status: 500 }
          );
        }

        // Auto-save generated images to disk
        const savedPaths: string[] = [];
        for (const img of generatedImages) {
          const savedPath = saveImageToDisk(img.imageData, img.prompt.slice(0, 50), img.index);
          if (savedPath) savedPaths.push(savedPath);
        }
        console.log(`💾 Auto-saved ${savedPaths.length} images to: ${SAVE_FOLDER}`);

        return NextResponse.json({
          success: true,
          images: generatedImages,
          provider: "gemini-composite",
          aspectRatio,
          totalRequested: prompts.length,
          totalGenerated: generatedImages.length,
          mode: "background-only",
          savedPaths,
        });
      }
    }

    // Regular mode (image-to-image or text-to-image)
    const mode = originalImage ? "IMAGE-TO-IMAGE (seeing original)" : "TEXT-TO-IMAGE";
    console.log(`Generating ${prompts.length} images with ${provider}, mode: ${mode}, aspect ratio: ${aspectRatio}, parallel: ${parallel}`);

    // Helper function to generate a single image
    const generateSingleImage = async (prompt: string, index: number): Promise<GeneratedImage | null> => {
      try {
        if (provider === "nano") {
          console.log(`Generating image ${index} with Gemini 2.5 Flash Image (${mode})...`);
          const imageData = await generateWithGemini(prompt, originalImage);
          if (imageData) {
            console.log(`Successfully generated image ${index} with Gemini 2.5 Flash Image`);
            return { index, imageData, prompt, provider: "gemini-2.5" };
          }
        } else {
          console.log(`Generating image ${index} with FLUX.1-dev...`);
          const response = await fetch(HF_INFERENCE_URL, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${HF_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              inputs: prompt,
              parameters: {
                width: dimensions.width,
                height: dimensions.height,
                guidance_scale: 4.0,
                num_inference_steps: 50,
                seed: Math.floor(Math.random() * 1000000),
              },
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`HF Inference API error for prompt ${index}:`, errorData);
            if (response.status === 503) {
              throw new Error("Model is loading, please try again");
            }
            throw new Error(errorData?.error || `Status ${response.status}`);
          }

          const imageBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(imageBuffer).toString("base64");
          const contentType = response.headers.get("content-type") || "image/png";
          const imageData = `data:${contentType};base64,${base64}`;
          console.log(`Successfully generated image ${index} with FLUX`);
          return { index, imageData, prompt, provider: "flux" };
        }
        return null;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error(`Error generating image ${index}:`, errorMessage);
        throw err;
      }
    };

    let generatedImages: GeneratedImage[] = [];

    if (parallel && prompts.length > 1) {
      // Parallel generation using Promise.allSettled
      console.log("Starting parallel generation...");
      const results = await Promise.allSettled(
        prompts.map((prompt, index) => generateSingleImage(prompt, index))
      );

      generatedImages = results
        .filter((result): result is PromiseFulfilledResult<GeneratedImage | null> =>
          result.status === "fulfilled" && result.value !== null
        )
        .map(result => result.value as GeneratedImage)
        .sort((a, b) => a.index - b.index);

      // Log any failures
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(`Image ${index} failed:`, result.reason);
        }
      });
    } else {
      // Sequential generation (for single image or when parallel=false)
      for (let i = 0; i < prompts.length; i++) {
        try {
          const result = await generateSingleImage(prompts[i], i);
          if (result) {
            generatedImages.push(result);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          if (prompts.length === 1) {
            return NextResponse.json(
              { error: "Зураг үүсгэхэд алдаа гарлаа", details: errorMessage },
              { status: 500 }
            );
          }
          // Continue for multiple images
        }
      }
    }

    if (generatedImages.length === 0) {
      return NextResponse.json(
        { error: "Зураг үүсгэхэд алдаа гарлаа", details: "No images were generated" },
        { status: 500 }
      );
    }

    // Auto-save generated images to disk
    const savedPaths: string[] = [];
    for (const img of generatedImages) {
      const savedPath = saveImageToDisk(img.imageData, img.prompt.slice(0, 50), img.index);
      if (savedPath) savedPaths.push(savedPath);
    }
    console.log(`💾 Auto-saved ${savedPaths.length} images to: ${SAVE_FOLDER}`);

    return NextResponse.json({
      success: true,
      images: generatedImages,
      provider,
      aspectRatio,
      totalRequested: prompts.length,
      totalGenerated: generatedImages.length,
      savedPaths,
    });
  } catch (error) {
    console.error("Server error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Серверийн алдаа гарлаа", details: errorMessage },
      { status: 500 }
    );
  }
}
