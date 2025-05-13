// src/app/actions/search-actions.ts
'use server';

import { z } from 'zod';

// Forward declaration for recursive schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DuckDuckGoTopicSchema: z.ZodTypeAny = z.lazy(() =>
  z.object({
    Result: z.string().optional().nullable(),
    Icon: z.object({
      URL: z.string().optional().nullable(),
      Height: z.number().optional(),
      Width: z.number().optional(),
    }).optional().nullable(),
    FirstURL: z.string().optional().nullable(),
    Text: z.string().optional().nullable(),
    // For categories/disambiguation groups
    Name: z.string().optional().nullable(), // Name of the group
    Topics: z.array(z.lazy(() => DuckDuckGoTopicSchema.nullable())).optional().nullable(), // Array of sub-topics, elements can be null
  })
);

const DuckDuckGoResponseSchema = z.object({
  Abstract: z.string().optional().nullable(),
  AbstractSource: z.string().optional().nullable(),
  AbstractURL: z.string().optional().nullable(),
  Image: z.string().optional().nullable(),
  Heading: z.string().optional().nullable(),
  Answer: z.string().optional().nullable(),
  AnswerType: z.string().optional().nullable(),
  Definition: z.string().optional().nullable(),
  DefinitionSource: z.string().optional().nullable(),
  DefinitionURL: z.string().optional().nullable(),
  RelatedTopics: z.array(z.lazy(() => DuckDuckGoTopicSchema.nullable())).optional().nullable(), // elements can be null
  Results: z.array(z.lazy(() => DuckDuckGoTopicSchema.nullable())).optional().nullable(), // elements can be null
  Type: z.string().optional().nullable(), 
});

type DuckDuckGoTopic = z.infer<typeof DuckDuckGoTopicSchema>;

// Helper function to extract text from topics and sub-topics
function extractTopicTexts(topics: (DuckDuckGoTopic | null)[] | undefined | null, maxTopics: number): string[] {
  if (!topics) return [];
  const texts: string[] = [];

  function processTopic(topic: DuckDuckGoTopic | null) {
    if (!topic || texts.length >= maxTopics) return; // Handle null topic

    const topicText = topic.Text;
    const topicResult = topic.Result; // This can be string | null | undefined

    if (topicText && topicText.trim()) {
      // Check if topicResult is not a category link. If topicResult is null/undefined, it's not a category link.
      const isNotCategoryLink = !topicResult || 
                                (!topicResult.includes('Category:') && 
                                 !topicResult.startsWith('<a href="https://duckduckgo.com/c/'));
      
      if (isNotCategoryLink) {
        let textToAdd = topicText.replace(/<[^>]*>?/gm, ''); // Strip HTML tags
        if (topic.FirstURL) {
          textToAdd += ` (More: ${topic.FirstURL})`;
        }
        texts.push(textToAdd);
      }
    }
    
    const subTopics = topic.Topics;
    if (subTopics && subTopics.length > 0) {
      for (const subTopic of subTopics) { // subTopic can also be null now
        if (texts.length >= maxTopics) break;
        processTopic(subTopic); // Recursive call, processTopic handles null
      }
    }
  }

  for (const topic of topics) { // topic can be null if array elements are nullable
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

    if (result.Heading && result.Abstract && result.Abstract.trim()) {
      context += `Topic: ${result.Heading}\nSummary: ${result.Abstract}\n`;
      if (result.AbstractURL) {
        context += `Source: ${result.AbstractURL}\n`;
      }
      context += '---\n';
    } else if (result.Abstract && result.Abstract.trim()) {
        context += `Search Result Summary: ${result.Abstract}\n`;
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
