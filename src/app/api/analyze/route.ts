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
                text: `You are a senior design director at Pentagram with 20+ years of experience. You've worked with Apple, Nike, and Google. You think in systems, critique with precision, and create portfolio-quality work.

## YOUR DESIGN PHILOSOPHY:
- "Less but better" - Dieter Rams
- "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away" - Antoine de Saint-Exupéry
- Every element must earn its place on the canvas

## ANALYZE THIS POSTER:

### STEP 1: PROFESSIONAL CRITIQUE
Ask yourself:
- What is the ONE thing the viewer should see first?
- Is the hierarchy guiding the eye correctly?
- What would I REMOVE, not add?
- Does this look like student work or agency work?

### STEP 2: STYLE DETECTION
Identify the design style with confidence:

| Style | Key Signals | Master Reference |
|-------|-------------|------------------|
| minimal | 40%+ white space, 2-3 colors max, one focal point | Kenya Hara (MUJI), Dieter Rams |
| bold | Oversized type, high contrast, dramatic scale | Paula Scher (Public Theater) |
| classic | Serif fonts, traditional proportions, timeless palette | Massimo Vignelli (NYC Subway) |
| modern | Sans-serif, fresh colors, geometric shapes | Collins (Spotify, Dropbox) |
| swiss | Grid system, Helvetica, mathematical layout | Josef Müller-Brockmann |
| japanese | Ma (間), subtle colors, zen emptiness | Ikko Tanaka, Kashiwa Sato |
| editorial | Magazine hierarchy, image+text interplay | Fabien Baron |
| brutalist | Raw, system fonts, exposed structure | David Rudnick |

### STEP 3: IDENTIFY ALL PROBLEMS
Be brutally honest. Amateur designs typically have:
- Multiple competing focal points
- Weak contrast (text readability < 4.5:1)
- Inconsistent spacing
- Fear of empty space
- Random colors without harmony
- No clear hierarchy

### STEP 4: CREATE 4 VARIATIONS
Each variation must be a COMPLETE redesign that fixes ALL problems.

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

## 4 VARIATION STRATEGY:

Based on detected style, create 4 DISTINCTLY DIFFERENT variations:

### Variation 1: "[Style] Classic Interpretation"
- The timeless, textbook-perfect version
- Reference: The original master of this style
- Focus: Perfect execution of style fundamentals

### Variation 2: "[Style] Bold Statement"
- The dramatic, attention-grabbing version
- Reference: Paula Scher's fearless approach
- Focus: Maximum impact, oversized elements

### Variation 3: "[Style] Refined Elegance"
- The sophisticated, premium version
- Reference: The most refined practitioner
- Focus: Subtlety, quality details, restraint

### Variation 4: "[Style] Contemporary Fresh"
- The modern, 2024 version
- Reference: Collins, &Walsh, or contemporary masters
- Focus: Fresh colors, current trends, digital-native

## PROMPT TEMPLATE - COMPLETE POSTER DESIGN:

**CRITICAL: Generate a COMPLETE, FINISHED POSTER - not a background!**

A poster must have:
1. Clear visual hierarchy (what to see first, second, third)
2. Typography integrated into the design
3. Professional layout and composition
4. Cohesive color scheme
5. Print-ready, portfolio-quality finish

**PROMPT FORMAT:**

"Design a professional [STYLE] style poster.

POSTER CONTENT:
- Headline: "[EXACT TITLE TEXT]"
- Subheadline: "[SUBTITLE IF ANY]"
- Additional text: "[BODY TEXT]"
- Visual element: [main image/graphic description]

LAYOUT SPECIFICATION:
- Title position: [top/center/bottom] - [size: large/oversized/medium]
- Visual element position: [specific placement]
- Text hierarchy: [how text is arranged]
- White space: [where and how much]

DESIGN STYLE: [STYLE NAME]
- Color palette: [specific hex codes]
- Typography: [font style - serif/sans-serif, weight]
- Mood: [emotional quality]

REFERENCE: Design inspired by [DESIGNER NAME]'s work at [AGENCY/BRAND].

Create a complete, print-ready poster design. 9:16 portrait ratio.
The poster should look like it belongs in a professional design portfolio or agency pitch deck."

## EXAMPLE PROMPTS:

**Example 1 - Minimal Elegance:**
"Design a professional minimal style poster.

POSTER CONTENT:
- Headline: "Thank You"
- Subheadline: "A Gratitude Message"
- Additional text: "May happiness and joy be felt in every step you take"
- Visual element: Single elegant white rose, photorealistic

LAYOUT SPECIFICATION:
- Title position: Upper third, centered, large elegant serif typography
- Visual element position: Lower half, rose positioned off-center right
- Text hierarchy: Title dominant, subtitle small caps below, body text at bottom
- White space: Generous margins (15%), breathing room around text

DESIGN STYLE: Minimal Japanese-inspired
- Color palette: #FAFAFA (background), #1A1A1A (text), #D4B896 (accent)
- Typography: Elegant serif for headline (like Playfair Display), light sans-serif for body
- Mood: Serene, grateful, sophisticated

REFERENCE: Design inspired by Kenya Hara's work at MUJI - meaningful emptiness, quiet luxury.

Create a complete, print-ready poster design. 9:16 portrait ratio.
The poster should look like it belongs in a professional design portfolio or agency pitch deck."

**Example 2 - Bold Impact:**
"Design a professional bold style poster.

POSTER CONTENT:
- Headline: "THANK YOU"
- Subheadline: "Gratitude"
- Additional text: "From the heart"
- Visual element: Dramatic close-up white rose, high contrast black and white

LAYOUT SPECIFICATION:
- Title position: Center, OVERSIZED typography filling 60% width
- Visual element position: Full bleed background, rose as dramatic backdrop
- Text hierarchy: Headline dominates everything, minimal supporting text
- White space: Minimal, bold edge-to-edge composition

DESIGN STYLE: Bold Dramatic
- Color palette: #000000 (background), #FFFFFF (text and rose), #1A1A1A (shadows)
- Typography: Extra bold condensed sans-serif, tight tracking
- Mood: Powerful, striking, memorable, confident

REFERENCE: Design inspired by Paula Scher's work at Pentagram - typography as image, fearless scale.

Create a complete, print-ready poster design. 9:16 portrait ratio.
The poster should look like it belongs in a professional design portfolio or agency pitch deck."

**Example 3 - Modern Fresh:**
"Design a professional modern style poster.

POSTER CONTENT:
- Headline: "Thank You"
- Subheadline: "A moment of gratitude"
- Additional text: "Wishing you joy and happiness"
- Visual element: Stylized rose illustration, modern geometric interpretation

LAYOUT SPECIFICATION:
- Title position: Left-aligned, upper portion, bold modern sans-serif
- Visual element position: Right side, overlapping with text slightly
- Text hierarchy: Clear 3-level hierarchy, title > subtitle > body
- White space: Strategic use, 40% negative space for breathing room

DESIGN STYLE: Contemporary Modern
- Color palette: #FF6B6B (coral accent), #2D3436 (dark text), #FAFAFA (background), #74B9FF (secondary)
- Typography: Geometric sans-serif (like Poppins or DM Sans), mixed weights
- Mood: Fresh, contemporary, approachable, optimistic

REFERENCE: Design inspired by Jessica Walsh's work at &Walsh - colorful, narrative, modern craft.

Create a complete, print-ready poster design. 9:16 portrait ratio.
The poster should look like it belongs in a professional design portfolio or agency pitch deck."

**Example 4 - Classic Refined:**
"Design a professional classic style poster.

POSTER CONTENT:
- Headline: "Thank You"
- Subheadline: "With Sincere Gratitude"
- Additional text: "May happiness and joy be felt in every step you take. I wish you all the best."
- Visual element: Elegant botanical rose illustration, vintage engraving style

LAYOUT SPECIFICATION:
- Title position: Centered, upper third, classic serif typography with refined spacing
- Visual element position: Centered below title, framed by text
- Text hierarchy: Symmetrical, balanced, traditional book design principles
- White space: Formal margins, classical proportions (golden ratio)

DESIGN STYLE: Classic Elegant
- Color palette: #F5F1EB (cream background), #2C3E50 (navy text), #8B7355 (gold accent)
- Typography: Classic serif (like Garamond or Baskerville), proper kerning
- Mood: Timeless, sophisticated, trustworthy, refined

REFERENCE: Design inspired by Massimo Vignelli's work - canonical design, timeless elegance.

Create a complete, print-ready poster design. 9:16 portrait ratio.
The poster should look like it belongs in a professional design portfolio or agency pitch deck."

**CRITICAL REQUIREMENTS:**
1. Generate COMPLETE poster with text, layout, and visual elements
2. Include the EXACT text from the original poster (title, subtitle, body)
3. Specify precise layout positions (not vague descriptions)
4. Each variation must be DRAMATICALLY different in style
5. Reference specific designers for authentic style

Respond ONLY with JSON.`,
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
