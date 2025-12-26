import OpenAI from "openai";
import { storage } from "./storage";
import type { WorkflowType, ChannelType, Brand } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface WorkflowResult {
  title: string;
  body: string;
  channel: ChannelType;
}

function getBrandContext(brand: Brand | null): string {
  if (!brand) return "";
  
  const parts: string[] = [];
  if (brand.industry) parts.push(`Industry: ${brand.industry}`);
  if (brand.audience) parts.push(`Target Audience: ${brand.audience}`);
  if (brand.tone) parts.push(`Tone: ${brand.tone}`);
  if (brand.approvedTerms?.length) parts.push(`Preferred Terms: ${brand.approvedTerms.join(", ")}`);
  if (brand.forbiddenWords?.length) parts.push(`Avoid: ${brand.forbiddenWords.join(", ")}`);
  if (brand.styleRules) parts.push(`Style Guidelines: ${brand.styleRules}`);
  
  return parts.length > 0 ? `\n\nBrand Guidelines:\n${parts.join("\n")}` : "";
}

const workflowPrompts: Record<WorkflowType, (input: string, title: string, brandContext: string) => string> = {
  headline_pack: (input, title, brand) => `Generate 5-7 compelling headline variations for the following content. Include different styles: attention-grabbing, question format, how-to, listicle, and curiosity gap.${brand}

Content Title: ${title}
Content: ${input}

Respond in markdown format with each headline numbered.`,

  seo_blog: (input, title, brand) => `Transform this content into a comprehensive, SEO-optimized blog post (800-1200 words). Include:
- Engaging introduction with hook
- Clear H2 subheadings
- Key points and detailed analysis
- Conclusion with call to action
- Meta description (under 160 characters)
- 5-7 relevant keywords${brand}

Source Content: ${title}
${input}`,

  social_pack: (input, title, brand) => `Create a social media content pack from this content. Generate platform-specific posts for:
1. LinkedIn (professional, 100-200 words, include relevant hashtags)
2. Twitter/X (thread of 3-5 tweets, under 280 chars each)
3. Instagram (engaging caption with emojis-as-text, relevant hashtags)
4. Facebook (conversational, 100-150 words)${brand}

Content: ${title}
${input}`,

  press_release: (input, title, brand) => `Transform this content into a professional press release. Include:
- FOR IMMEDIATE RELEASE header
- Compelling headline and subheadline
- Dateline with [City, Date] placeholder
- Strong opening paragraph (who, what, when, where, why)
- 2-3 supporting paragraphs with quotes placeholder
- Boilerplate section
- Media contact information placeholder${brand}

Content: ${title}
${input}`,

  newsletter: (input, title, brand) => `Create a newsletter draft from this content. Include:
- 3 subject line options (compelling, under 50 chars)
- Preview text (under 100 chars)
- Greeting with [First Name] personalization
- Engaging body (200-300 words)
- Clear call-to-action
- Sign-off${brand}

Content: ${title}
${input}`,

  rewrite_tone: (input, title, brand) => `Rewrite this content in 3 different tones:
1. Professional/Formal
2. Casual/Conversational
3. Enthusiastic/Energetic

Keep the core message but adjust language, sentence structure, and vocabulary for each tone.${brand}

Content: ${title}
${input}`,

  executive_brief: (input, title, brand) => `Create a concise executive summary (1 page max). Include:
- Executive Summary header
- Key Findings (3-5 bullet points)
- Strategic Implications
- Recommendations (actionable items)
- Next Steps${brand}

Content: ${title}
${input}`,

  expand_longform: (input, title, brand) => `Expand this content into a detailed, long-form article (1500-2000 words). Include:
- Compelling introduction
- Deep-dive sections with H2 headings
- Examples and explanations
- Expert insights placeholder
- Comprehensive conclusion${brand}

Content: ${title}
${input}`,

  summarize: (input, title, brand) => `Create a concise summary of this content:
1. One-paragraph summary (50-75 words)
2. Key Points (5-7 bullet points)
3. One-sentence takeaway${brand}

Content: ${title}
${input}`,

  translation_ar_en: (input, title, brand) => `Translate this Arabic content to English while:
- Preserving the original meaning and tone
- Adapting cultural references appropriately
- Maintaining professional quality${brand}

Content: ${title}
${input}`,

  translation_en_ar: (input, title, brand) => `Translate this English content to Arabic while:
- Preserving the original meaning and tone
- Using Modern Standard Arabic
- Maintaining professional quality${brand}

Content: ${title}
${input}`,

  image_prompts: (input, title, brand) => `Generate detailed image prompts for AI image generation based on this content. Create prompts for:
1. Hero/Featured Image
2. Social Media Graphic (1:1 square)
3. Blog Header Image (16:9)
4. Infographic concept
5. Quote Card

Each prompt should be detailed, specifying style, composition, colors, and mood.${brand}

Content: ${title}
${input}`,

  repurpose_transcript: (input, title, brand) => `Transform this transcript into multiple content pieces:
1. Article Summary (300-500 words)
2. Key Quotes (5-7 quotable moments)
3. Social Media Snippets (3-5 posts)
4. Blog Post Outline
5. Newsletter Teaser${brand}

Transcript: ${title}
${input}`,
};

const workflowChannels: Record<WorkflowType, ChannelType> = {
  headline_pack: "generic",
  seo_blog: "blog",
  social_pack: "linkedin",
  press_release: "press_release",
  newsletter: "newsletter",
  rewrite_tone: "generic",
  executive_brief: "generic",
  expand_longform: "blog",
  summarize: "generic",
  translation_ar_en: "generic",
  translation_en_ar: "generic",
  image_prompts: "generic",
  repurpose_transcript: "generic",
};

export async function processWorkflowWithAI(
  runId: string,
  inputId: string,
  workflowType: WorkflowType,
  workspaceId: string,
  brandId?: string | null,
  userId?: string
): Promise<void> {
  console.log(`[AI Workflow] Starting processing for run ${runId}, workflow type: ${workflowType}`);

  try {
    const input = await storage.getInput(inputId);
    if (!input) {
      console.log(`[AI Workflow] Input ${inputId} not found, marking run as failed`);
      await storage.updateWorkflowRun(runId, {
        status: "failed",
        completedAt: new Date(),
      });
      return;
    }

    console.log(`[AI Workflow] Found input: ${input.title}`);

    await storage.updateWorkflowRun(runId, { status: "running" });

    const brand = brandId ? await storage.getBrand(brandId) : null;
    const brandContext = getBrandContext(brand);

    const inputText = input.rawText || input.sourceUrl || "";
    const promptGenerator = workflowPrompts[workflowType];
    const prompt = promptGenerator(inputText, input.title, brandContext);

    console.log(`[AI Workflow] Calling OpenAI for ${workflowType}...`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert content strategist and writer. Create high-quality, professional content that follows best practices for the specific format requested. Format your response in clean markdown.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 4000,
    });

    const generatedContent = completion.choices[0]?.message?.content || "";

    if (!generatedContent) {
      throw new Error("No content generated from AI");
    }

    const result: WorkflowResult = {
      title: `${input.title} - ${workflowType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
      body: generatedContent,
      channel: workflowChannels[workflowType],
    };

    console.log(`[AI Workflow] Creating asset with ${result.body.length} characters`);

    const asset = await storage.createAsset({
      workspaceId,
      runId,
      status: "draft",
    });

    await storage.createAssetVersion({
      assetId: asset.id,
      versionNo: 1,
      title: result.title,
      body: result.body,
      workflowType,
      language: input.language || "en",
      channel: result.channel,
      createdBy: userId,
    });

    await storage.updateWorkflowRun(runId, {
      status: "succeeded",
      completedAt: new Date(),
    });

    if (userId && workspaceId) {
      await storage.recordUsage(workspaceId, userId, workflowType, 1);
    }

    console.log(`[AI Workflow] Successfully completed run ${runId}`);
  } catch (error) {
    console.error(`[AI Workflow] Error processing workflow:`, error);
    await storage.updateWorkflowRun(runId, {
      status: "failed",
      completedAt: new Date(),
    });
  }
}
