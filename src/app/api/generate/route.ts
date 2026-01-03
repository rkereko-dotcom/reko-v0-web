import { NextRequest, NextResponse } from "next/server";

// Increase timeout for image generation
export const maxDuration = 60;

const HF_TOKEN = process.env.HF_TOKEN;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5" | "3:4";

interface GenerateRequest {
  prompts: string[];
  provider?: "flux" | "nano" | "gemini3";  // Default: nano (uses Gemini 3 Flash)
  aspectRatio?: AspectRatio;   // Default: 9:16
  parallel?: boolean;          // Default: true
  originalImage?: string;      // Base64 original image for image-to-image improvement
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
      // The prompt becomes an IMPROVEMENT instruction
      parts.push({
        text: `LOOK at this poster carefully. FEEL what the designer was trying to express.

Now CREATE an IMPROVED version based on this vision:

${prompt}

IMPORTANT:
- Keep the SAME content, text, and core message
- Keep the SOUL of what they were trying to say
- But TRANSFORM the execution to be more powerful
- This is not a new poster - it's THIS poster, elevated`,
      });
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
    const { prompts, provider = "nano", aspectRatio = "9:16", parallel = true, originalImage }: GenerateRequest = await request.json();

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

    return NextResponse.json({
      success: true,
      images: generatedImages,
      provider,
      aspectRatio,
      totalRequested: prompts.length,
      totalGenerated: generatedImages.length,
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
