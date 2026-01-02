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

// Style detection - poster-ийн дизайны төрлийг тодорхойлох
interface StyleDetection {
  primary_style: string;         // minimal, bold, classic, modern, vintage, brutalist, swiss, japanese, art_deco
  style_confidence: number;      // 0-100 confidence score
  secondary_influences: string[]; // Other style elements detected
  color_mood: string;            // warm, cool, neutral, vibrant, muted
  typography_approach: string;   // serif, sans-serif, display, mixed
  layout_tendency: string;       // centered, asymmetric, grid, freeform
  recommended_direction: string; // Where the design should go
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
  style_detection: StyleDetection;
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
                text: `Та Pentagram, Apple, Nike-д ажилладаг дэлхийн шилдэг график дизайнер. Энэ poster-ийг шинжилж:

1. **ДИЗАЙНЫ ТӨРЛИЙГ ТОДОРХОЙЛОХ** - Minimal, Bold, Classic, Modern, Vintage, Swiss, Japanese гэх мэт
2. **БҮХ АСУУДЛЫГ ЗАСАХ** - 4 хувилбар тус бүр ЦОГЦ дизайн байх (зөвхөн нэг зүйл биш)
3. **МЭРГЭЖЛИЙН ТҮВШИН** - Portfolio-ready, agency-quality output

## ДИЗАЙНЫ ТӨРЛҮҮД:

| Төрөл | Онцлог | Reference Designers |
|-------|--------|---------------------|
| minimal | Whitespace, simplicity, less is more | Dieter Rams, Kenya Hara, Jony Ive |
| bold | High contrast, dramatic, impactful | Paula Scher, David Carson, Neville Brody |
| classic | Timeless, elegant, traditional | Massimo Vignelli, Paul Rand, Herb Lubalin |
| modern | Clean, contemporary, fresh | Jessica Walsh, Collins, ManvsMachine |
| vintage | Retro, nostalgic, textured | Aaron Draplin, DKNG Studios |
| swiss | Grid systems, Helvetica, mathematical | Josef Müller-Brockmann, Armin Hofmann |
| japanese | Ma (空間), subtlety, zen | Kenya Hara, Kashiwa Sato, Ikko Tanaka |
| editorial | Magazine-style, sophisticated | Fabien Baron, Alexey Brodovitch |

## JSON БҮТЭЦ:

{
  "score": <1-100>,
  "category_scores": {
    "gestalt": { "score": <1-100>, "principles_used": [], "principles_violated": [], "feedback": "" },
    "color": { "score": <1-100>, "harmony_type": "", "palette": ["#hex"], "temperature": "", "feedback": "" },
    "typography": { "score": <1-100>, "hierarchy_clear": true/false, "fonts_detected": [], "readability": "", "feedback": "" },
    "layout": { "score": <1-100>, "balance": "", "whitespace": "", "alignment": "", "feedback": "" },
    "composition": { "score": <1-100>, "focal_point": true/false, "visual_flow": "", "feedback": "" }
  },

  "style_detection": {
    "primary_style": "minimal/bold/classic/modern/vintage/swiss/japanese/editorial",
    "style_confidence": <0-100>,
    "secondary_influences": ["Бусад нөлөөлж буй стилүүд"],
    "color_mood": "warm/cool/neutral/vibrant/muted",
    "typography_approach": "serif/sans-serif/display/mixed",
    "layout_tendency": "centered/asymmetric/grid/freeform",
    "recommended_direction": "Энэ poster-ийг ямар чиглэлд хөгжүүлэх"
  },

  "emotional_analysis": {
    "primary_emotion": "energetic/calm/urgent/nostalgic/playful/elegant/bold/mysterious",
    "intended_mood": "Ямар мэдрэмж төрүүлэхийг хүссэн",
    "target_audience": "Хэнд зориулсан",
    "visual_personality": "Bold/Subtle/Elegant/Raw/Playful/Professional",
    "preserve_elements": ["Poster-ийн сүнс - ЗААВАЛ хадгалах"]
  },

  "design_problems": {
    "critical": ["Хамгийн чухал 1-2 асуудал"],
    "color_issues": ["Өнгөний асуудлууд"],
    "typography_issues": ["Typography асуудлууд"],
    "layout_issues": ["Layout асуудлууд"],
    "composition_issues": ["Composition асуудлууд"]
  },

  "color_recommendation": {
    "original_palette": ["#hex"],
    "recommended_palette": ["#hex - 4-5 өнгө"],
    "contrast_ratio_fix": "Contrast засвар",
    "harmony_suggestion": "Harmony зөвлөмж"
  },

  "feedback": {
    "strengths": ["Давуу талууд"],
    "improvements": ["Сайжруулах зүйлс"],
    "overall": "Нэг өгүүлбэр"
  },

  "principles_analysis": [
    { "id": "", "name": "", "name_mn": "", "status": "applied/violated/neutral", "explanation": "", "suggestion": "" }
  ],

  "elements": {
    "title": "Poster дээрх гарчиг",
    "subtitle": "Дэд гарчиг эсвэл null",
    "bodyText": ["Бусад текст"],
    "colors": { "primary": "#hex", "secondary": "#hex", "background": "#hex", "accent": "#hex" },
    "images": ["Зурагнуудын тодорхойлолт"],
    "logo": "Лого эсвэл null",
    "style": "Одоогийн стиль",
    "purpose": "Зорилго"
  },

  "variations": [
    {
      "name": "STYLE нэртэй холбоотой - Classic Interpretation",
      "principle": "Тухайн style-ийн үндсэн зарчим",
      "designer": {
        "name": "Style-д тохирсон дизайнер",
        "technique": "Тэр дизайнерын арга барил",
        "style": "Дизайнерын стиль"
      },
      "description": "Энэ хувилбар юу хийх",
      "improvements": ["БҮХ асуудлыг яаж засах"],
      "prompt": "<PROMPT - доор заавар>"
    }
  ],

  "learning_points": ["Суралцах зүйлс"]
}

## 4 ХУВИЛБАРЫН СТРАТЕГИ:

Илрүүлсэн style (жишээ: "modern")-д үндэслэн 4 ЦОГЦ хувилбар:

### Variation 1: "[Style] Classic"
- Тухайн стилийн сонгодог, timeless хувилбар
- БҮХ асуудлыг засна: color + typography + layout + composition
- Reference: Style-ийн анхдагч дизайнер

### Variation 2: "[Style] Bold"
- Тухайн стилийн илүү хүчтэй, dramatic хувилбар
- БҮХ асуудлыг засна + илүү impactful болгоно
- Reference: Paula Scher эсвэл style-д тохирсон bold designer

### Variation 3: "[Style] Refined"
- Тухайн стилийн илүү нарийн, elegant хувилбар
- БҮХ асуудлыг засна + sophistication нэмнэ
- Reference: Style-д тохирсон refined designer

### Variation 4: "[Style] Contemporary"
- Тухайн стилийн 2024 орчин үеийн хувилбар
- БҮХ асуудлыг засна + fresh, current feel
- Reference: Jessica Walsh, Collins, эсвэл style-д тохирсон contemporary designer

## PROMPT TEMPLATE (Gemini):

**ЧУХАЛ**: Prompt бүр ЦОГЦ дизайн үүсгэнэ - БҮХ асуудлыг нэг дор засна!

"Create a [STYLE_NAME] style poster for '[EXACT_TITLE]' - a [PURPOSE].

DESIGN DIRECTION: [Style-ийн онцлог, reference designer].

MUST FIX ALL:
- Color: [specific color fix + recommended palette hex codes]
- Typography: [specific typography fix]
- Layout: [specific layout fix]
- Composition: [specific composition fix]

PRESERVE: [preserve_elements - poster-ийн сүнс]
MOOD: [primary_emotion] - [intended_mood]
AUDIENCE: [target_audience]

STYLE REFERENCE: Inspired by [DESIGNER_NAME]'s work - [specific technique].
COLOR PALETTE: [recommended_palette hex codes]
TYPOGRAPHY: [typography approach based on style]

Create a cohesive, portfolio-quality poster that solves all design problems while maintaining the [STYLE] aesthetic.
9:16 portrait ratio, print-ready quality, professional design."

## ЖИШЭЭ PROMPT (Modern style илэрсэн бол):

"Create a Modern Minimalist style poster for 'SUMMER MUSIC FEST 2024' - a music festival event.

DESIGN DIRECTION: Contemporary clean design inspired by Collins agency and Jessica Walsh.

MUST FIX ALL:
- Color: Replace muddy brown #8B7355 with vibrant coral #FF6B6B, ensure 7:1 contrast ratio
- Typography: Establish clear 3-level hierarchy with Inter or DM Sans
- Layout: Add 40% more whitespace, implement 12-column grid
- Composition: Create strong focal point with oversized date

PRESERVE: The energetic festival vibe and geometric pattern element
MOOD: Energetic - excitement for summer music
AUDIENCE: Young adults 18-35, music enthusiasts

STYLE REFERENCE: Inspired by Collins agency's festival branding - bold simplicity meets contemporary freshness.
COLOR PALETTE: #FF6B6B (coral), #1A1A2E (deep navy), #FFFFFF (white), #F0F0F0 (light grey)
TYPOGRAPHY: Modern geometric sans-serif, bold headlines, light body text

Create a cohesive, portfolio-quality poster that solves all design problems while maintaining the Modern aesthetic.
9:16 portrait ratio, print-ready quality, professional design."

**ЗААВАЛ**:
1. Style илрүүлж, тэр style-д тохирсон 4 хувилбар
2. Prompt бүр БҮХ асуудлыг засдаг байх
3. Preserve elements-ийг бүү мартаарай
4. Hex codes, тодорхой дизайнер reference заавал оруулах

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
