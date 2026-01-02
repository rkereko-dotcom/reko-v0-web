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
                text: `Та дизайны мэргэжилтэн хувиар энэ poster/дизайныг шинжилнэ үү.

Дараах Design Principles-ийг ашиглан үнэлгээ өгнө үү:

**Gestalt Principles:**
- Proximity (Ойрхон байдал): Ойр элементүүд бүлэг үүсгэдэг
- Similarity (Төсөөтэй байдал): Ижил хэлбэр, өнгө нь холбоотой
- Closure (Бүрэн дүрс): Тархи дутуу дүрсийг бүтэн болгодог
- Continuity (Үргэлжлэл): Нүд шугам, муруйг дагадаг
- Figure/Ground (Дүрс/Суурь): Дүрсийг background-аас ялгах
- Focal Point (Анхаарлын төв): Ялгаатай элемент анхаарал татдаг

**Color Harmonies:**
- Complementary: Эсрэг өнгө (180°)
- Analogous: Зэргэлдээ өнгө (30° зайтай)
- Triadic: Гурвалжин (120° зайтай)
- Split-Complementary: Хуваагдсан эсрэг
- Monochromatic: Нэг өнгөний өнгөлөгүүд

**Typography Principles:**
- Visual Hierarchy: Чухлын дараалал
- Readability: Уншигдах байдал
- Font Pairing: Фонтын хослол

**Layout Principles:**
- Balance: Тэнцвэр (Symmetric/Asymmetric)
- Whitespace: Хоосон зай
- Alignment: Зэрэгцүүлэлт
- Grid: Торон систем

Дараах JSON форматаар хариулна уу:

{
  "score": <1-100 нийт оноо>,
  "category_scores": {
    "gestalt": {
      "score": <1-100>,
      "principles_used": ["proximity", "similarity"],
      "principles_violated": ["focal_point"],
      "feedback": "Gestalt-ийн талаарх санал"
    },
    "color": {
      "score": <1-100>,
      "harmony_type": "analogous",
      "palette": ["#FFD700", "#FFA500", "#FF8C00"],
      "temperature": "warm",
      "feedback": "Өнгөний талаарх санал"
    },
    "typography": {
      "score": <1-100>,
      "hierarchy_clear": true,
      "fonts_detected": ["Sans-serif heading", "Script body"],
      "readability": "good",
      "feedback": "Typography талаарх санал"
    },
    "layout": {
      "score": <1-100>,
      "balance": "asymmetric",
      "whitespace": "adequate",
      "alignment": "center",
      "feedback": "Layout талаарх санал"
    },
    "composition": {
      "score": <1-100>,
      "focal_point": true,
      "visual_flow": "top-to-bottom",
      "feedback": "Composition талаарх санал"
    }
  },
  "feedback": {
    "strengths": ["давуу тал 1", "давуу тал 2", "давуу тал 3"],
    "improvements": ["сайжруулах 1", "сайжруулах 2", "сайжруулах 3"],
    "overall": "Нийт дүгнэлт - 2-3 өгүүлбэр"
  },
  "principles_analysis": [
    {
      "id": "proximity",
      "name": "Proximity",
      "name_mn": "Ойрхон байдал",
      "status": "applied",
      "explanation": "Яагаад сайн/муу хэрэглэсэн тухай",
      "suggestion": "Хэрхэн сайжруулах (status=violated үед)"
    }
  ],
  "elements": {
    "title": "Гол гарчиг",
    "subtitle": "Дэд гарчиг эсвэл null",
    "bodyText": ["Бусад текстүүд"],
    "colors": {
      "primary": "#hex",
      "secondary": "#hex",
      "background": "#hex",
      "accent": "#hex"
    },
    "images": ["Зурагнуудын тодорхойлолт"],
    "logo": "Лого тодорхойлолт эсвэл null",
    "style": "minimal/bold/vintage/modern гэх мэт",
    "purpose": "Poster-ийн зорилго"
  },
  "variations": [
    {
      "name": "Dieter Rams Minimalism",
      "principle": "Less but better - Functionalism",
      "designer": {
        "name": "Dieter Rams",
        "technique": "10 Principles of Good Design - Remove all unnecessary elements, focus on function",
        "style": "German Industrial Minimalism"
      },
      "description": "Dieter Rams-ын 'Less but better' зарчмаар хялбарчилсан",
      "improvements": ["Шаардлагагүй элементүүдийг хассан", "Цэвэрхэн whitespace", "Функциональ дизайн"],
      "prompt": "Redesign this [elements.purpose] poster featuring '[elements.title]' in Dieter Rams's sophisticated minimalist style. Apply Braun design language with mathematical grid layout. Use [elements.colors.primary] and [elements.colors.secondary] as restrained color palette. Typography: clean Helvetica Neue with strict hierarchy - dominant headline, minimal supporting text. Incorporate purposeful negative space. The aesthetic should feel like a premium Braun advertisement - refined, intelligent, timeless. 9:16 portrait ratio, print-quality resolution."
    },
    {
      "name": "Massimo Vignelli Grid",
      "principle": "Grid Systems & Visual Power",
      "designer": {
        "name": "Massimo Vignelli",
        "technique": "Strict grid systems, limited typefaces (Helvetica, Bodoni, Garamond, Century, Futura only)",
        "style": "Swiss International Style"
      },
      "description": "Vignelli-ийн grid system болон хүчтэй typography",
      "improvements": ["6-column grid ашигласан", "Helvetica/Futura typography", "Bold contrast"],
      "prompt": "Redesign this [elements.purpose] poster featuring '[elements.title]' following Massimo Vignelli's Swiss International Style. Construct on a 6-column grid system with mathematical precision. Typography: Helvetica Bold for headlines, Helvetica Light for body. Use [elements.colors.primary] as accent color against black/white foundation. Create dramatic scale contrast - oversized typography against precise small text. Include bold geometric dividers. Feel like NYC subway map identity - systematic, authoritative, modern. 9:16 portrait ratio, vector-crisp quality."
    },
    {
      "name": "Kenya Hara Emptiness",
      "principle": "Ma (間) - The beauty of emptiness",
      "designer": {
        "name": "Kenya Hara",
        "technique": "Emptiness as possibility, sensory design, MUJI philosophy",
        "style": "Japanese Minimalism"
      },
      "description": "Kenya Hara-ын 'Ma' буюу хоосон зайны гоо зүй",
      "improvements": ["Хоосон зайг үндсэн элемент болгосон", "Мэдрэмжит дизайн", "Энгийн боловч гүнзгий"],
      "prompt": "Redesign this [elements.purpose] poster featuring '[elements.title]' in Kenya Hara's MUJI philosophy of 'emptiness as possibility'. Composition: 70%+ negative space - white/off-white as primary element. Place '[elements.title]' with surgical precision using golden ratio. Color: white, cream, soft grey with subtle accent from [elements.colors.accent]. Typography: thin-weight sans-serif, minimal characters. Include subtle paper texture for tactile depth. Evoke silence and infinite possibility - like MUJI catalog. 9:16 portrait ratio, gallery-quality aesthetic."
    },
    {
      "name": "Paul Rand Wit",
      "principle": "Simplicity with wit and surprise",
      "designer": {
        "name": "Paul Rand",
        "technique": "Playful geometry, clever visual puns, memorable symbols",
        "style": "American Modernism"
      },
      "description": "Paul Rand-ын ухаалаг, тоглоомлог хандлага",
      "improvements": ["Clever visual metaphor нэмсэн", "Memorable shape", "Playful yet professional"],
      "prompt": "Redesign this [elements.purpose] poster featuring '[elements.title]' in Paul Rand's American Modernist wit - simplicity meets intellectual playfulness. Create a bold visual concept for '[elements.title]' using reductive geometric shapes that form a clever visual pun. Color: use [elements.colors.primary] as bold accent against clean background - maximum 3 colors. Typography: bold condensed sans-serif integrated as design element. The concept should spark recognition and a smile - like IBM rebus or ABC logo. Every element must serve a purpose. Feel like corporate identity meets children's book - sophisticated, accessible, memorable. 9:16 portrait ratio, iconic quality."
    }
  ],
  "learning_points": [
    "Энэ дизайнаас суралцах зүйл 1",
    "Суралцах зүйл 2",
    "Суралцах зүйл 3"
  ]
}

**ЧУХАЛ - Dynamic Prompt үүсгэх заавар (Gemini Image Generation):**

Variation prompt бүрд ЗААВАЛ poster-ийн content-ийг оруулна:

1. **Poster-ийн гарчиг**: elements.title-ийг prompt-д тодорхой оруулах
2. **Зорилго**: elements.purpose-ийг prompt-д тусгах
3. **Өнгөний palette**: Илрүүлсэн өнгөнүүдийг prompt-д hex code-оор дурдах
4. **Дизайнерын стиль**: Variation-ий дизайнерын зарчмуудыг хадгалах
5. **Формат**: 9:16 portrait ratio гэж дурдах

**Prompt template:**
"Redesign a [purpose] poster with the title '[EXACT TITLE FROM POSTER]' in [Designer Name]'s style. [Designer's specific techniques and philosophy]. Color palette: [detected colors as hex codes]. [Specific design instructions]. 9:16 portrait ratio, professional quality."

**Жишээ (poster-ийн content-тэй):**
"Redesign a concert event poster with the title 'SUMMER JAZZ NIGHT' in Dieter Rams's style. Apply mathematical grid layout with precise geometric proportions. Use detected colors #1E3A5F and #F4A460 as primary palette. Typography: clean Helvetica Neue with strict hierarchy. 9:16 portrait ratio, print-quality resolution."

**ЗААВАЛ**: Prompt бүрт poster-ийн гарчиг, өнгө, зорилгыг оруулах!

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
