import { NextRequest, NextResponse } from "next/server";

const HF_TOKEN = process.env.HF_TOKEN;

interface GenerateRequest {
  prompts: string[];
}

interface GeneratedImage {
  index: number;
  imageData: string;
  prompt: string;
}

// HuggingFace Inference API endpoint for FLUX.1-dev (high quality, open-weight)
const HF_INFERENCE_URL = "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-dev";

export async function POST(request: NextRequest) {
  try {
    if (!HF_TOKEN) {
      return NextResponse.json(
        { error: "HuggingFace token тохируулаагүй байна" },
        { status: 500 }
      );
    }

    const { prompts }: GenerateRequest = await request.json();

    if (!prompts || prompts.length === 0) {
      return NextResponse.json(
        { error: "Prompt илгээгдээгүй байна" },
        { status: 400 }
      );
    }

    const generatedImages: GeneratedImage[] = [];

    // Generate images sequentially
    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];

      try {
        console.log(`Generating image ${i} with FLUX.1-dev...`);

        // Call HuggingFace Inference API
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

          // Check if model is loading
          if (response.status === 503) {
            console.log("Model is loading, waiting...");
            // Wait and retry once
            await new Promise(resolve => setTimeout(resolve, 20000));
            continue;
          }
          continue;
        }

        // Response is raw image bytes
        const imageBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(imageBuffer).toString("base64");
        const contentType = response.headers.get("content-type") || "image/png";
        const imageData = `data:${contentType};base64,${base64}`;

        generatedImages.push({
          index: i,
          imageData: imageData,
          prompt: prompt,
        });
        console.log(`Successfully generated image ${i}`);

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
