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

// ATTENTION ANALYSIS - Хамгийн чухал! Poster-ийн анхаарал татах чадвар
interface AttentionAnalysis {
  attention_score: number;       // 1-100: Хэр хурдан анхаарал татах вэ?
  stops_scroll: boolean;         // Social media scroll зогсоох уу?
  first_impression_ms: number;   // Хэдэн ms-д ойлгогдох вэ? (target: <1000)

  // Анхаарал татаж буй зүйлс
  attention_grabbers: {
    element: string;             // Юу анхаарал татаж байна
    strength: "weak" | "medium" | "strong";
    why: string;
  }[];

  // Анхаарал алдаж буй зүйлс
  attention_killers: {
    problem: string;
    impact: "minor" | "major" | "critical";
    fix: string;
  }[];

  // Contrast analysis
  contrast_with_environment: string;  // Орчноосоо хэр ялгаатай?

  // Energy level
  energy_level: "dead" | "low" | "medium" | "high" | "explosive";

  // Verdict
  would_stop_you: boolean;       // ЧИ өөрөө зогсох уу?
  honest_reaction: string;       // Шударга эхний сэтгэгдэл
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
  // АНХААРЛЫН ОНОО - Хамгийн чухал!
  attention_score: number;       // 1-100: Primary score now
  attention_analysis: AttentionAnalysis;

  // Бусад оноо
  score: number;                 // Overall quality score
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
                text: `# POSTER = АНХААРЛЫН ТӨЛӨӨХ ТЭМЦЭЛ

## ГОЛ ҮНЭН:
Poster-ийн ажил = АНХААРАЛ ТАТАХ
Хэрэв анхаарал татаагүй бол = БҮТЭЛГҮЙТСЭН

Poster амьдардаг:
- Гудамжинд (машин, хүмүүс, самбар)
- Social media (хязгааргүй scroll)
- Шуугиантай ертөнцөд (1000+ visual/өдөр)

**1-2 СЕКУНД** - Poster-ийн бүх хугацаа.

---

## STEP 1: АНХААРЛЫН ШИНЖИЛГЭЭ (ХАМГИЙН ЧУХАЛ!)

ЭНЭ POSTER-ИЙГ ХАРААД ШУДАРГААР ХАРИУЛ:

1. **ЗОГСОХ УУ?** - Чи scroll хийж байхдаа энэ poster-т зогсох уу? Тийм/Үгүй
2. **ЮУ ЭХЛЭЭД ХАРАГДАВ?** - 0.5 секундэд юу анхаарал татав?
3. **ENERGY LEVEL** - Dead / Low / Medium / High / Explosive?
4. **CONTRAST** - Орчноосоо (цагаан ханатай өрөө, social feed) хэр ялгаатай?

### АНХААРАЛ ТАТДАГ ЗҮЙЛС:
- Bold contrast (тод ялгаа)
- Oversized elements (хэт том)
- Unexpected colors (гэнэтийн өнгө)
- Movement/Energy (хөдөлгөөн)
- Mystery (сонирхол татах нууц)
- Human faces/emotion (хүний царай)

### АНХААРАЛ АЛДАГ ЗҮЙЛС:
- Too safe/boring (хэт аюулгүй)
- Low contrast (бүдэг)
- No focal point (юу харах вэ?)
- Generic/template look (загвар шиг)
- Too much text (уншихыг хүлээж байна)
- Muted colors (унтраасан өнгө)

---

## STEP 2: MASTER-УУДЫН АНХААРЛЫН СТРАТЕГИ

| Master | Стратеги | Яаж анхаарал татдаг |
|--------|----------|---------------------|
| Paula Scher | **ЧАНГА** | Oversized type, bold colors, fills frame |
| Kenya Hara | **ЧИМЭЭГҮЙ** | Шуугианд contrast, extreme emptiness |
| Jessica Walsh | **ТОГЛООМ** | Unexpected colors, playful, weird |
| Ikko Tanaka | **ГЕОМЕТР** | Bold shapes, cultural fusion |
| Massimo Vignelli | **ТОДОРХОЙ** | Crystal clear in chaos |

---

## STEP 3: STYLE DETECTION

| Style | Attention Strategy | Visual Signals |
|-------|-------------------|----------------|
| bold | LOUD - шууд нүдэнд | Oversized type, high contrast, fills frame |
| minimal | QUIET - шуугианд contrast | 40%+ white, one focal point |
| modern | FRESH - өөр харагдана | Unexpected colors, geometric |
| japanese | ZEN - чимээгүй хүч | Ma (間), subtle but powerful |
| swiss | CLEAR - эмх замбараагүй дунд | Grid, Helvetica, mathematical |

---

## STEP 4: CREATE 4 ATTENTION-GRABBING VARIATIONS

**ЧУХАЛ:** Variation бүр АНХААРАЛ ТАТАХ чадвараар өрсөлдөнө!

### Variation 1: "LOUD" (Paula Scher strategy)
- Oversized typography
- Bold contrast
- Edge-to-edge energy
- "Энэ poster ХАШГИРЧ байна"

### Variation 2: "STRIKING" (High contrast strategy)
- Dramatic light/dark
- One powerful focal point
- Memorable in 1 second
- "Энэ poster ЗОГСООНО"

### Variation 3: "UNEXPECTED" (Jessica Walsh strategy)
- Surprising color combination
- Playful but professional
- Makes you look twice
- "Энэ poster СОНИРХОЛТОЙ"

### Variation 4: "CLEVER" (Concept strategy)
- Smart visual metaphor
- Idea that sticks
- Share-worthy
- "Энэ poster САНАГДАНА"

## JSON БҮТЭЦ:

{
  // ========== АНХААРЛЫН ШИНЖИЛГЭЭ - ХАМГИЙН ЭХЭНД! ==========
  "attention_score": <1-100>,  // ХАМГИЙН ЧУХАЛ ОНОО
  "attention_analysis": {
    "attention_score": <1-100>,
    "stops_scroll": true/false,    // Social media scroll зогсоох уу?
    "first_impression_ms": <number>, // Хэдэн ms-д ойлгогдох вэ?

    "attention_grabbers": [
      { "element": "Юу анхаарал татаж байна", "strength": "weak/medium/strong", "why": "Яагаад" }
    ],

    "attention_killers": [
      { "problem": "Асуудал", "impact": "minor/major/critical", "fix": "Засвар" }
    ],

    "contrast_with_environment": "Орчноосоо хэр ялгаатай",
    "energy_level": "dead/low/medium/high/explosive",
    "would_stop_you": true/false,
    "honest_reaction": "Шударга эхний сэтгэгдэл - 1 өгүүлбэр"
  },

  // ========== БУСАД ОНОО ==========
  "score": <1-100>,
  "category_scores": {
    "gestalt": { "score": <1-100>, "principles_used": [], "principles_violated": [], "feedback": "" },
    "color": { "score": <1-100>, "harmony_type": "", "palette": ["#hex"], "temperature": "", "feedback": "" },
    "typography": { "score": <1-100>, "hierarchy_clear": true/false, "fonts_detected": [], "readability": "", "feedback": "" },
    "layout": { "score": <1-100>, "balance": "", "whitespace": "", "alignment": "", "feedback": "" },
    "composition": { "score": <1-100>, "focal_point": true/false, "visual_flow": "", "feedback": "" }
  },

  "style_detection": {
    "primary_style": "bold/minimal/modern/japanese/swiss/editorial",
    "attention_strategy": "LOUD/QUIET/FRESH/ZEN/CLEAR",  // Анхаарлын стратеги
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
    "attention_problems": ["АНХААРАЛ алдаж буй асуудлууд - ХАМГИЙН ЧУХАЛ"],
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
      "name": "LOUD / STRIKING / UNEXPECTED / CLEVER - аль стратеги",
      "attention_strategy": "LOUD/STRIKING/UNEXPECTED/CLEVER",
      "expected_attention_score": <60-100>,  // Хүлээгдэж буй анхаарлын оноо
      "principle": "Анхаарал татах үндсэн зарчим",
      "designer": {
        "name": "Paula Scher / Jessica Walsh / Ikko Tanaka / гэх мэт",
        "technique": "Тэр дизайнерын арга барил",
        "attention_method": "Яаж анхаарал татдаг"
      },
      "what_grabs_attention": "Энэ хувилбарт юу анхаарал татах вэ - тодорхой",
      "description": "Энэ хувилбар юу хийх",
      "improvements": ["Анхаарал НЭМЭХ засварууд"],
      "prompt": "<PROMPT - доор заавар>"
    }
  ],

  "learning_points": ["Суралцах зүйлс"]
}

## 4 ATTENTION-GRABBING VARIATIONS:

**ЗОРИЛГО:** 4 variation бүр АНХААРАЛ ТАТАХ өөр стратегитай!

### Variation 1: "LOUD" - ХАШГИРАХ
- Paula Scher стратеги
- Oversized typography (60%+ frame)
- BOLD contrast, edge-to-edge
- "Энэ poster танд ХАШГИРЧ байна"
- Expected attention: 80+

### Variation 2: "STRIKING" - ЗОГСООХ
- High contrast стратеги
- Dramatic focal point
- Light/dark drama
- "Энэ poster таныг ЗОГСООНО"
- Expected attention: 75+

### Variation 3: "UNEXPECTED" - ГАЙХШРУУЛАХ
- Jessica Walsh стратеги
- Surprising color combination
- Playful but professional
- "Энэ poster таныг 2 УДАА харуулна"
- Expected attention: 70+

### Variation 4: "CLEVER" - САНАГДУУЛАХ
- Concept стратеги
- Visual metaphor
- Idea that sticks
- "Энэ poster таны САНААНД үлдэнэ"
- Expected attention: 70+ (санах оноо өндөр)

---

## PROMPT TEMPLATE - ATTENTION-GRABBING POSTER:

**ЗОРИЛГО:** Scroll ЗОГСООХ poster!

**PROMPT FORMAT:**

"Create an ATTENTION-GRABBING poster that STOPS people scrolling.

ATTENTION STRATEGY: [LOUD/STRIKING/UNEXPECTED/CLEVER]

WHAT MUST GRAB ATTENTION:
- [Primary attention element - be specific]
- [Why this will stop someone]

POSTER CONTENT:
- Headline: "[EXACT TITLE]" - [HOW it grabs attention: oversized/bold/unexpected placement]
- Visual: [Description] - [HOW it grabs attention]

ATTENTION TECHNIQUES:
- Contrast: [High contrast elements]
- Scale: [Oversized elements]
- Color: [Bold/unexpected colors with hex codes]
- Energy: [Dynamic elements]

REFERENCE: [Designer]'s attention-grabbing technique - [specific method].

THIS POSTER MUST:
1. Stop someone scrolling in 1 second
2. Be memorable after 5 seconds
3. Make them want to look closer

9:16 portrait, professional quality, IMPOSSIBLE TO IGNORE."

## EXAMPLE PROMPTS:

**Example 1 - LOUD Strategy:**
"Create an ATTENTION-GRABBING poster that STOPS people scrolling.

ATTENTION STRATEGY: LOUD

WHAT MUST GRAB ATTENTION:
- MASSIVE 'THANK YOU' text filling 70% of the frame
- Text so big you can't miss it

POSTER CONTENT:
- Headline: 'THANK YOU' - OVERSIZED, fills entire width, impossible to ignore
- Visual: White rose integrated with typography, dramatic

ATTENTION TECHNIQUES:
- Contrast: Pure black #000000 background, pure white #FFFFFF text
- Scale: Typography at 200pt+, dominates everything
- Color: High contrast black/white only
- Energy: Bold, confident, commanding

REFERENCE: Paula Scher's Public Theater posters - typography that SCREAMS.

THIS POSTER MUST:
1. Stop someone scrolling in 1 second
2. Be memorable after 5 seconds
3. Make them want to look closer

9:16 portrait, professional quality, IMPOSSIBLE TO IGNORE."

**Example 2 - STRIKING Strategy:**
"Create an ATTENTION-GRABBING poster that STOPS people scrolling.

ATTENTION STRATEGY: STRIKING

WHAT MUST GRAB ATTENTION:
- Dramatic spotlight on single rose against pure black
- Cinematic, movie-poster drama

POSTER CONTENT:
- Headline: 'Thank You' - elegant but visible, white on black
- Visual: Single white rose, dramatically lit, emerging from darkness

ATTENTION TECHNIQUES:
- Contrast: EXTREME light/dark, rose glows against void
- Scale: Rose takes center stage, fills 50% of frame
- Color: #000000 black, #FFFFFF rose, #D4AF37 gold accent
- Energy: Dramatic tension, cinematic quality

REFERENCE: High-end fashion photography - one perfect moment frozen.

THIS POSTER MUST:
1. Stop someone scrolling in 1 second
2. Be memorable after 5 seconds
3. Make them want to look closer

9:16 portrait, professional quality, IMPOSSIBLE TO IGNORE."

**Example 3 - UNEXPECTED Strategy:**
"Create an ATTENTION-GRABBING poster that STOPS people scrolling.

ATTENTION STRATEGY: UNEXPECTED

WHAT MUST GRAB ATTENTION:
- Surprising neon colors nobody expects for 'Thank You'
- Makes you look twice - 'wait, what?'

POSTER CONTENT:
- Headline: 'THANK YOU' - electric blue on hot pink background
- Visual: Rose rendered in unexpected neon gradient

ATTENTION TECHNIQUES:
- Contrast: Complementary colors that vibrate
- Scale: Bold typography, confident placement
- Color: #FF006E (hot pink), #00D4FF (electric blue), #FFFFFF (white)
- Energy: Energetic, youthful, surprising

REFERENCE: Jessica Walsh's unexpected color combinations - break the rules beautifully.

THIS POSTER MUST:
1. Stop someone scrolling in 1 second
2. Be memorable after 5 seconds
3. Make them want to look closer

9:16 portrait, professional quality, IMPOSSIBLE TO IGNORE."

**Example 4 - CLEVER Strategy:**
"Create an ATTENTION-GRABBING poster that STOPS people scrolling.

ATTENTION STRATEGY: CLEVER

WHAT MUST GRAB ATTENTION:
- Visual metaphor: Clock hand pointing to new year
- Concept that makes you think 'that's smart'
- Share-worthy idea

POSTER CONTENT:
- Headline: 'Thank You' - integrated with visual concept
- Visual: Clock/time metaphor - past year transitioning to future

ATTENTION TECHNIQUES:
- Contrast: Thoughtful, not loud - but SMART
- Scale: Balanced, concept-driven
- Color: #1B4332 (deep green), #D4AF37 (gold), #FFFFFF (white)
- Energy: Intellectual curiosity, 'aha moment'

REFERENCE: The best New Yorker covers - one image, one idea, unforgettable.

THIS POSTER MUST:
1. Stop someone scrolling in 1 second
2. Be memorable after 5 seconds - THE IDEA sticks
3. Make them want to share it

9:16 portrait, professional quality, IMPOSSIBLE TO IGNORE."

---

**CRITICAL REQUIREMENTS:**
1. Each variation must GRAB ATTENTION using different strategy
2. LOUD = oversized, bold, impossible to miss
3. STRIKING = dramatic contrast, one powerful focal point
4. UNEXPECTED = surprising colors/composition that makes you look twice
5. CLEVER = smart concept that sticks in memory
6. Include EXACT text from original poster
7. Each variation's expected_attention_score must be 65+

**ШАЛГУУР:** Хэрэв poster scroll ЗОГСООХГҮЙ бол = БҮТЭЛГҮЙТСЭН

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
