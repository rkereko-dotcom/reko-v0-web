import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

// Increase timeout for image analysis
export const maxDuration = 60;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB (under Claude's 5MB limit)

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

// Emotional analysis - poster-ийн сэтгэл хөдлөлийг таних
interface EmotionalAnalysis {
  primary_emotion: string;       // energetic, calm, urgent, nostalgic, playful, elegant
  intended_mood: string;         // What feeling the designer wanted to create
  target_audience: string;       // Who this is designed for
  visual_personality: string;    // Bold, Subtle, Elegant, Raw, Playful
  preserve_elements: string[];   // What works and MUST be kept
}

// Specific design problems to fix
interface DesignProblems {
  critical: string[];            // Most urgent issues
  color_issues: string[];        // Specific color problems
  typography_issues: string[];   // Font/hierarchy problems
  layout_issues: string[];       // Spacing/balance problems
  composition_issues: string[];  // Flow/focal point problems
}

// Professional color recommendations
interface ColorRecommendation {
  original_palette: string[];
  recommended_palette: string[];
  contrast_ratio_fix: string;
  harmony_suggestion: string;
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

interface DesignerInfo {
  name: string;
  technique: string;
  style: string;
}

interface DesignVariation {
  name: string;
  principle: string;
  designer: DesignerInfo;
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
  category_scores: CategoryScores;
  emotional_analysis: EmotionalAnalysis;
  design_problems: DesignProblems;
  color_recommendation: ColorRecommendation;
  feedback: {
    strengths: string[];
    improvements: string[];
    overall: string;
  };
  principles_analysis: PrincipleDetail[];
  elements: PosterElements;
  variations: DesignVariation[];
  learning_points: string[];
}

export async function POST(request: NextRequest) {
  try {
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "API key тохируулаагүй байна" },
        { status: 500 }
      );
    }

    const { image } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: "Зураг илгээгдээгүй байна" },
        { status: 400 }
      );
    }

    // Extract base64 data and media type from data URL
    const matches = image.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json(
        { error: "Зургийн формат буруу байна" },
        { status: 400 }
      );
    }

    let mediaType = matches[1];
    let base64Data = matches[2];

    // Check image size and compress if needed
    const imageBuffer = Buffer.from(base64Data, "base64");
    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      console.log(`Image too large (${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB), compressing...`);

      // Compress image using sharp
      const compressedBuffer = await sharp(imageBuffer)
        .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      base64Data = compressedBuffer.toString("base64");
      mediaType = "image/jpeg";
      console.log(`Compressed to ${(compressedBuffer.length / 1024 / 1024).toFixed(2)}MB`);
    }

    // Call Claude Vision API with enhanced prompt
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: `Та 20+ жилийн туршлагатай мэргэжлийн график дизайнер. Энэ poster-ийг шинжилж, ТОДОРХОЙ АСУУДЛУУДЫГ олж, тэдгээрийг ЗАСАХ хувилбаруудыг санал болгоно уу.

## ТАНЫ ҮҮРЭГ:
1. **Сэтгэл хөдлөлийг таних** - Энэ poster ямар мэдрэмж төрүүлэхийг хүсч байна?
2. **Тодорхой асуудлуудыг олох** - "Өнгө муу" гэхгүй, "Шар текст цайвар background дээр contrast ratio 2.1:1 байна, WCAG стандартын 4.5:1-ээс доогуур" гэх мэт
3. **Үндсэн санааг хадгалах** - Soul-ийг нь устгахгүй, зөвхөн execution-ийг сайжруулах
4. **Асуудал шийдэх хувилбарууд** - Style apply хийхгүй, асуудлыг ШИЙДЭХ

## ШИНЖИЛГЭЭНИЙ БҮТЭЦ:

{
  "score": <1-100>,
  "category_scores": {
    "gestalt": { "score": <1-100>, "principles_used": [], "principles_violated": [], "feedback": "" },
    "color": { "score": <1-100>, "harmony_type": "", "palette": ["#hex"], "temperature": "", "feedback": "" },
    "typography": { "score": <1-100>, "hierarchy_clear": true/false, "fonts_detected": [], "readability": "", "feedback": "" },
    "layout": { "score": <1-100>, "balance": "", "whitespace": "", "alignment": "", "feedback": "" },
    "composition": { "score": <1-100>, "focal_point": true/false, "visual_flow": "", "feedback": "" }
  },

  "emotional_analysis": {
    "primary_emotion": "energetic/calm/urgent/nostalgic/playful/elegant/bold/mysterious",
    "intended_mood": "Дизайнер ямар мэдрэмж төрүүлэхийг хүссэн",
    "target_audience": "Хэнд зориулсан",
    "visual_personality": "Bold/Subtle/Elegant/Raw/Playful/Professional",
    "preserve_elements": ["Юуг ЗААВАЛ хадгалах - poster-ийн сүнс"]
  },

  "design_problems": {
    "critical": ["Хамгийн чухал засах асуудлууд - 1-2"],
    "color_issues": ["Тодорхой өнгөний асуудлууд: contrast ratio, clashing colors, muddy tones"],
    "typography_issues": ["Font хослол, hierarchy, readability асуудлууд"],
    "layout_issues": ["Whitespace дутмаг, overcrowded, alignment асуудлууд"],
    "composition_issues": ["Focal point байхгүй, visual flow тодорхойгүй"]
  },

  "color_recommendation": {
    "original_palette": ["#hex одоогийн өнгөнүүд"],
    "recommended_palette": ["#hex мэргэжлийн зөвлөмж - 3-5 өнгө"],
    "contrast_ratio_fix": "Текст contrast яаж засах",
    "harmony_suggestion": "Ямар color harmony хэрэглэх"
  },

  "feedback": {
    "strengths": ["Юу сайн байна - хадгалах зүйлс"],
    "improvements": ["Юуг засах - тодорхой"],
    "overall": "Нэг өгүүлбэрээр"
  },

  "principles_analysis": [
    { "id": "proximity", "name": "Proximity", "name_mn": "Ойрхон байдал", "status": "applied/violated/neutral", "explanation": "", "suggestion": "" }
  ],

  "elements": {
    "title": "Яг poster дээрх гарчиг",
    "subtitle": "Дэд гарчиг эсвэл null",
    "bodyText": ["Бусад текстүүд"],
    "colors": { "primary": "#hex", "secondary": "#hex", "background": "#hex", "accent": "#hex" },
    "images": ["Зурагнуудын тодорхойлолт"],
    "logo": "Лого эсвэл null",
    "style": "Одоогийн стиль",
    "purpose": "Poster-ийн зорилго"
  },

  "variations": [
    {
      "name": "Өнгөний Мэргэжлийн Засвар",
      "principle": "Color Theory + WCAG Accessibility",
      "designer": { "name": "Josef Albers", "technique": "Interaction of Color - өнгөний харилцан үйлчлэл", "style": "Bauhaus Color Theory" },
      "description": "Өнгөний contrast, harmony асуудлуудыг засаж, мэргэжлийн түвшинд хүргэх",
      "improvements": ["Илрүүлсэн тодорхой өнгөний асуудлуудыг засна"],
      "prompt": "<ДИНАМИК - доор заавар>"
    },
    {
      "name": "Typography Hierarchy Засвар",
      "principle": "Visual Hierarchy + Readability First",
      "designer": { "name": "Jan Tschichold", "technique": "New Typography - тодорхой hierarchy, уншигдах байдал", "style": "Swiss Typography" },
      "description": "Текстийн hierarchy, readability асуудлуудыг засах",
      "improvements": ["Font hierarchy тодорхой болгох", "Readability сайжруулах"],
      "prompt": "<ДИНАМИК - доор заавар>"
    },
    {
      "name": "Layout & Breathing Room",
      "principle": "Whitespace as Design Element",
      "designer": { "name": "Josef Müller-Brockmann", "technique": "Grid Systems - математик тэнцвэр", "style": "Swiss Grid Design" },
      "description": "Layout-ийн тэнцвэр, whitespace асуудлуудыг засах",
      "improvements": ["Whitespace нэмэх", "Grid system хэрэглэх"],
      "prompt": "<ДИНАМИК - доор заавар>"
    },
    {
      "name": "Сэтгэл Хөдлөлийг Хүчирхэгжүүлэх",
      "principle": "Emotional Design - preserve and amplify",
      "designer": { "name": "Saul Bass", "technique": "Dramatic impact, bold simplicity", "style": "Hollywood Title Design" },
      "description": "Poster-ийн анхны сэтгэл хөдлөлийг хадгалж, илүү хүчтэй болгох",
      "improvements": ["Анхны санааг хадгалах", "Илүү хүчтэй focal point"],
      "prompt": "<ДИНАМИК - доор заавар>"
    }
  ],

  "learning_points": ["Суралцах зүйлс"]
}

## PROMPT ҮҮСГЭХ ЗААВАР (Gemini Image Generation):

**ЧУХАЛ**: Prompt бүр ТОДОРХОЙ АСУУДЛЫГ ШИЙДДЭГ байх ёстой!

### Variation 1 - Өнгөний Засвар:
"Create a professionally color-corrected version of a [purpose] poster titled '[EXACT TITLE]'.
PROBLEM TO FIX: [color_issues-ээс тодорхой асуудал].
SOLUTION: Apply [recommended_palette] color scheme with proper contrast ratios.
Keep the [primary_emotion] mood. Use [harmony_suggestion].
Text must have minimum 4.5:1 contrast ratio against background.
[preserve_elements]-ийг хадгалах.
9:16 portrait, print-quality."

### Variation 2 - Typography Засвар:
"Create a typographically refined version of a [purpose] poster titled '[EXACT TITLE]'.
PROBLEM TO FIX: [typography_issues-ээс тодорхой асуудал].
SOLUTION: Establish clear 3-level hierarchy (headline/subhead/body).
Use professional font pairing. Ensure readability at all sizes.
Keep the [visual_personality] personality and [primary_emotion] mood.
[preserve_elements]-ийг хадгалах.
9:16 portrait, editorial quality."

### Variation 3 - Layout Засвар:
"Create a spatially balanced version of a [purpose] poster titled '[EXACT TITLE]'.
PROBLEM TO FIX: [layout_issues-ээс тодорхой асуудал].
SOLUTION: Apply grid system with proper breathing room.
Create visual rhythm through intentional whitespace.
Maintain [primary_emotion] feeling while improving clarity.
[preserve_elements]-ийг хадгалах.
9:16 portrait, gallery-quality."

### Variation 4 - Сэтгэл Хөдлөл Хүчирхэгжүүлэх:
"Create an emotionally amplified version of a [purpose] poster titled '[EXACT TITLE]'.
PRESERVE: The [primary_emotion] mood and [intended_mood].
AMPLIFY: Make the feeling more powerful and immediate.
Use [recommended_palette] colors that enhance the emotion.
Bold, dramatic composition with clear focal point.
[preserve_elements]-ийг хадгалах.
9:16 portrait, cinematic impact."

**ЗААВАЛ**:
- Prompt бүрт ТОДОРХОЙ АСУУДАЛ болон ШИЙДЭЛ байх
- Poster-ийн гарчиг, зорилго, мэдрэмжийг оруулах
- preserve_elements-ийг бүү мартаарай

Зөвхөн JSON хариулна уу.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Claude API error:", errorData);
      return NextResponse.json(
        { error: "Claude API алдаа гарлаа" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.content[0]?.text;

    if (!content) {
      return NextResponse.json(
        { error: "Хариулт хоосон байна" },
        { status: 500 }
      );
    }

    // Parse the JSON response from Claude
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("JSON олдсонгүй");
      }

      const analysisResult: AnalysisResult = JSON.parse(jsonMatch[0]);
      return NextResponse.json(analysisResult);
    } catch (parseError) {
      console.error("JSON parse error:", parseError, "Content:", content);
      return NextResponse.json(
        { error: "Хариултыг задлахад алдаа гарлаа", raw: content },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "Серверийн алдаа гарлаа" },
      { status: 500 }
    );
  }
}
