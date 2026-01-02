import { NextRequest, NextResponse } from "next/server";

const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

interface GenerateRequest {
  prompt: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!GOOGLE_AI_API_KEY) {
      return NextResponse.json(
        { error: "Google AI API key тохируулаагүй байна" },
        { status: 500 }
      );
    }

    const { prompt }: GenerateRequest = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt илгээгдээгүй байна" },
        { status: 400 }
      );
    }

    console.log("Generating image with Nano Banana (Gemini 2.5 Flash)...");

    // Call Gemini API with image generation
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
              parts: [
                {
                  text: prompt,
                },
              ],
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

      if (response.status === 429) {
        return NextResponse.json(
          { error: "API хязгаарлалтад хүрсэн. Түр хүлээнэ үү.", details: JSON.stringify(errorData) },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: "Nano Banana API алдаа", details: JSON.stringify(errorData) },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Extract image from response
    const candidates = data.candidates;
    if (!candidates || candidates.length === 0) {
      return NextResponse.json(
        { error: "Зураг үүсгэгдсэнгүй", raw: data },
        { status: 500 }
      );
    }

    const parts = candidates[0].content?.parts || [];
    let imageData = null;
    let textResponse = null;

    for (const part of parts) {
      if (part.inlineData) {
        // Base64 image data
        const mimeType = part.inlineData.mimeType || "image/png";
        imageData = `data:${mimeType};base64,${part.inlineData.data}`;
      }
      if (part.text) {
        textResponse = part.text;
      }
    }

    if (!imageData) {
      return NextResponse.json(
        { error: "Зураг олдсонгүй", raw: data, text: textResponse },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      imageData,
      text: textResponse,
      model: "gemini-2.0-flash-exp-image-generation",
    });

  } catch (error) {
    console.error("Server error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: "Серверийн алдаа", details: errorMessage },
      { status: 500 }
    );
  }
}
