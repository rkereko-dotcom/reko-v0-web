import { NextRequest, NextResponse } from "next/server";

const HF_TOKEN = process.env.HF_TOKEN;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

interface GenerateRequest {
  prompts: string[];
  provider?: "flux" | "nano";  // Default: flux
}

interface GeneratedImage {
  index: number;
  imageData: string;
  prompt: string;
  provider: string;
}

// HuggingFace Inference API endpoint for FLUX.1-dev (high quality, open-weight)
const HF_INFERENCE_URL = "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-dev";

// Nano Banana (Gemini) image generation
async function generateWithNano(prompt: string): Promise<string | null> {
  if (!GOOGLE_AI_API_KEY) {
    throw new Error("Google AI API key тохируулаагүй байна");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GOOGLE_AI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ["image", "text"],
          responseMimeType: "image/png",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Nano Banana API error:", errorData);
    throw new Error(`Nano Banana API error: ${response.status}`);
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

export async function POST(request: NextRequest) {
  try {
    const { prompts, provider = "nano" }: GenerateRequest = await request.json();

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

    const generatedImages: GeneratedImage[] = [];

    // Generate images sequentially
    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];

      try {
        if (provider === "nano") {
          // Use Nano Banana (Gemini)
          console.log(`Generating image ${i} with Nano Banana...`);
          const imageData = await generateWithNano(prompt);

          if (imageData) {
            generatedImages.push({
              index: i,
              imageData,
              prompt,
              provider: "nano",
            });
            console.log(`Successfully generated image ${i} with Nano Banana`);
          }
        } else {
          // Use FLUX.1-dev (default)
          console.log(`Generating image ${i} with FLUX.1-dev...`);

          const response = await fetch(HF_INFERENCE_URL, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${HF_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              inputs: prompt,
              parameters: {
                width: 768,
                height: 1344,  // 9:16 portrait for posters
                guidance_scale: 4.0,
                num_inference_steps: 50,
                seed: Math.floor(Math.random() * 1000000),
              },
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`HF Inference API error for prompt ${i}:`, errorData);

            if (response.status === 503) {
              console.log("Model is loading, waiting...");
              await new Promise(resolve => setTimeout(resolve, 20000));
              continue;
            }
            continue;
          }

          const imageBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(imageBuffer).toString("base64");
          const contentType = response.headers.get("content-type") || "image/png";
          const imageData = `data:${contentType};base64,${base64}`;

          generatedImages.push({
            index: i,
            imageData,
            prompt,
            provider: "flux",
          });
          console.log(`Successfully generated image ${i} with FLUX`);
        }
      } catch (err) {
        console.error(`Error generating image ${i}:`, err);
        continue;
      }
    }

    if (generatedImages.length === 0) {
      return NextResponse.json(
        { error: "Зураг үүсгэхэд алдаа гарлаа" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      images: generatedImages,
      provider,
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
