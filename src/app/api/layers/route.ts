import { NextRequest, NextResponse } from "next/server";
import { Client } from "@gradio/client";

const HF_TOKEN = process.env.HF_TOKEN;

interface LayerResult {
  layers: string[];
  pptx_url?: string;
  zip_url?: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!HF_TOKEN) {
      return NextResponse.json(
        { error: "HuggingFace token тохируулаагүй байна" },
        { status: 500 }
      );
    }

    const { image, num_layers = 4 } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: "Зураг илгээгдээгүй байна" },
        { status: 400 }
      );
    }

    // Extract base64 data from data URL
    const matches = image.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json(
        { error: "Зургийн формат буруу байна" },
        { status: 400 }
      );
    }

    const base64Data = matches[2];

    // Convert base64 to Blob
    const binaryData = Buffer.from(base64Data, "base64");
    const blob = new Blob([binaryData], { type: matches[1] });

    // Connect to Hugging Face Space
    const client = await Client.connect("Qwen/Qwen-Image-Layered", {
      hf_token: HF_TOKEN,
    } as Parameters<typeof Client.connect>[1]);

    // Call the API - using positional parameters
    const result = await client.predict("/infer", [
      blob,           // input_image
      777,            // seed
      false,          // randomize_seed
      "",             // prompt
      "",             // neg_prompt
      4.0,            // true_guidance_scale
      50,             // num_inference_steps
      num_layers,     // layer
      true,           // cfg_norm
      true,           // use_en_prompt
    ]);

    // Process the result
    const data = result.data as unknown[];

    // The result typically contains layer images and download links
    const layerResult: LayerResult = {
      layers: [],
    };

    // Extract layer images from the result
    if (Array.isArray(data)) {
      for (const item of data) {
        if (typeof item === "object" && item !== null) {
          const obj = item as Record<string, unknown>;
          // Check for image URLs
          if (obj.url && typeof obj.url === "string") {
            layerResult.layers.push(obj.url);
          }
          // Check for file paths
          if (obj.path && typeof obj.path === "string") {
            layerResult.layers.push(obj.path);
          }
          // Check for PPTX download
          if (obj.name && typeof obj.name === "string" && obj.name.endsWith(".pptx")) {
            layerResult.pptx_url = obj.url as string || obj.path as string;
          }
          // Check for ZIP download
          if (obj.name && typeof obj.name === "string" && obj.name.endsWith(".zip")) {
            layerResult.zip_url = obj.url as string || obj.path as string;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      ...layerResult,
      raw: data, // Include raw data for debugging
    });

  } catch (error) {
    console.error("Layer decomposition error:", error);

    // Check if it's a specific error type
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : "";

    // If the Space is not available or sleeping
    if (errorMessage.includes("sleeping") || errorMessage.includes("loading") || errorMessage.includes("is currently")) {
      return NextResponse.json(
        {
          error: "Qwen Space одоогоор ачааллаж байна. 1-2 минут хүлээгээд дахин оролдоно уу.",
          details: errorMessage
        },
        { status: 503 }
      );
    }

    // Authentication error
    if (errorMessage.includes("401") || errorMessage.includes("unauthorized") || errorMessage.includes("token")) {
      return NextResponse.json(
        {
          error: "HuggingFace token буруу эсвэл хүчингүй байна",
          details: errorMessage
        },
        { status: 401 }
      );
    }

    // Space not found
    if (errorMessage.includes("404") || errorMessage.includes("not found")) {
      return NextResponse.json(
        {
          error: "Qwen Space олдсонгүй",
          details: errorMessage
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: "Layer задлахад алдаа гарлаа",
        details: errorMessage,
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}
