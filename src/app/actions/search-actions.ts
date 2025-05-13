// src/app/actions/search-actions.ts
'use server';

import { z } from 'zod';

// Forward declaration for recursive schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DuckDuckGoTopicSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    Result: z.string().optional(),
    Icon: z.object({
      URL: z.string().optional(),
      Height: z.number().optional(),
      Width: z.number().optional(),
    }).optional(),
    FirstURL: z.string().optional(),
    Text: z.string().optional(),
    // For categories/disambiguation groups
    Name: z.string().optional(), // Name of the group
    Topics: z.array(DuckDuckGoTopicSchema).optional(), // Array of sub-topics
  })
);

const DuckDuckGoResponseSchema = z.object({
  Abstract: z.string().optional(), // Corrected from AbstractText
  AbstractSource: z.string().optional(),
  AbstractURL: z.string().optional(),
  Image: z.string().optional(),
  Heading: z.string().optional(),
  Answer: z.string().optional(),
  AnswerType: z.string().optional(),
  Definition: z.string().optional(),
  DefinitionSource: z.string().optional(),
  DefinitionURL: z.string().optional(),
  RelatedTopics: z.array(DuckDuckGoTopicSchema).optional(),
  Results: z.array(DuckDuckGoTopicSchema).optional(), 
  Type: z.string().optional(), 
});

type DuckDuckGoTopic = z.infer<typeof DuckDuckGoTopicSchema>;

// Helper function to extract text from topics and sub-topics
function extractTopicTexts(topics: DuckDuckGoTopic[] | undefined, maxTopics: number): string[] {
  if (!topics) return [];
  const texts: string[] = [];

  function processTopic(topic: DuckDuckGoTopic) {
    if (texts.length >= maxTopics) return;

    if (topic.Text && topic.Text.trim() && !topic.Result?.includes('Category:') && !topic.Result?.startsWith('<a href="https://duckduckgo.com/c/')) {
      let textToAdd = topic.Text.replace(/<[^>]*>?/gm, ''); // Strip HTML tags
      if (topic.FirstURL) {
        textToAdd += ` (More: ${topic.FirstURL})`;
      }
      texts.push(textToAdd);
    }

    if (topic.Topics && topic.Topics.length > 0) {
      for (const subTopic of topic.Topics) {
        if (texts.length >= maxTopics) break;
        processTopic(subTopic); // Recursive call
      }
    }
  }

  for (const topic of topics) {
    if (texts.length >= maxTopics) break;
    processTopic(topic);
  }
  return texts;
}


export async function searchDuckDuckGo(query: string): Promise<string | null> {
  if (!query.trim()) {
    return null;
  }

  const DUCKDUCKGO_API_URL = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

  try {
    const response = await fetch(DUCKDUCKGO_API_URL, {
      headers: {
        // DuckDuckGo API is public, but some APIs might require a User-Agent.
        // 'User-Agent': 'FlashZenApp/1.0 (https://your-app-contact-page.com)' 
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`DuckDuckGo API request failed with status: ${response.status}. Body: ${errorBody}`);
      return `Error: Failed to fetch from DuckDuckGo (status ${response.status}). Please try again later or rephrase your query.`;
    }

    const data = await response.json();
    const parsedData = DuckDuckGoResponseSchema.safeParse(data);

    if (!parsedData.success) {
      console.error('Failed to parse DuckDuckGo API response:', parsedData.error.flatten());
      return 'Error: Could not parse DuckDuckGo search results. The API might have changed its format.';
    }

    const result = parsedData.data;
    let context = '';
    const MAX_CONTEXT_LENGTH = 2000; // Limit context length to avoid overly long prompts

    if (result.Heading && result.Abstract && result.Abstract.trim()) { // Changed AbstractText to Abstract
      context += `Topic: ${result.Heading}\nSummary: ${result.Abstract}\n`; // Changed AbstractText to Abstract
      if (result.AbstractURL) {
        context += `Source: ${result.AbstractURL}\n`;
      }
      context += '---\n';
    } else if (result.Abstract && result.Abstract.trim()) { // Changed AbstractText to Abstract
        context += `Search Result Summary: ${result.Abstract}\n`; // Changed AbstractText to Abstract
        if (result.AbstractURL) {
            context += `Source: ${result.AbstractURL}\n`;
        }
        context += '---\n';
    }
    
    if (result.Answer && result.Answer.trim()) {
        context += `Direct Answer: ${result.Answer}\n`;
         if (result.AnswerType) {
            context += `Answer Type: ${result.AnswerType}\n`;
        }
        context += '---\n';
    }

    if (result.Definition && result.Definition.trim()) {
      context += `Definition: ${result.Definition}\n`;
      if (result.DefinitionSource) {
        context += `Definition Source: ${result.DefinitionSource}\n`;
      }
      if (result.DefinitionURL) {
        context += `Definition URL: ${result.DefinitionURL}\n`;
      }
      context += '---\n';
    }

    const MAX_RELATED_TOPICS = 5;
    if (result.RelatedTopics && result.RelatedTopics.length > 0) {
      const extractedTexts = extractTopicTexts(result.RelatedTopics, MAX_RELATED_TOPICS);
      if (extractedTexts.length > 0) {
        context += 'Related Information:\n';
        extractedTexts.forEach(text => {
          context += `- ${text}\n`;
        });
        context += '---\n';
      }
    }
    
    const trimmedContext = context.trim();
    if (trimmedContext === "") {
        return `No specific information found for "${query}" via web search. Try a broader topic or different phrasing.`;
    }
    
    if (trimmedContext.length > MAX_CONTEXT_LENGTH) {
        return trimmedContext.substring(0, MAX_CONTEXT_LENGTH) + "... (context truncated)";
    }

    return trimmedContext;

  } catch (error: any) {
    console.error('Error fetching or processing DuckDuckGo API:', error);
    return `Error: An unexpected error occurred while searching: ${error.message}. Please check your network connection.`;
  }
}