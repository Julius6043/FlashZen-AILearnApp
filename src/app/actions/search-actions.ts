// src/app/actions/search-actions.ts
'use server';

import { z } from 'zod';

const DuckDuckGoTopicSchema = z.object({
  Result: z.string().optional(),
  Icon: z.object({
    URL: z.string().optional(),
    Height: z.number().optional(),
    Width: z.number().optional(),
  }).optional(),
  FirstURL: z.string().optional(),
  Text: z.string().optional(),
});

const DuckDuckGoResponseSchema = z.object({
  AbstractText: z.string().optional(),
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

    if (result.Heading && result.AbstractText && result.AbstractText.trim()) {
      context += `Topic: ${result.Heading}\nSummary: ${result.AbstractText}\n`;
      if (result.AbstractURL) {
        context += `Source: ${result.AbstractURL}\n`;
      }
      context += '---\n';
    } else if (result.AbstractText && result.AbstractText.trim()) {
        context += `Search Result Summary: ${result.AbstractText}\n`;
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
      const relevantTopics = result.RelatedTopics
        .filter(topic => topic.Text && topic.Text.trim() && !topic.Result?.includes('Category:') && !topic.Result?.startsWith('<a href="https://duckduckgo.com/c/'))
        .slice(0, MAX_RELATED_TOPICS);

      if (relevantTopics.length > 0) {
        context += 'Related Information:\n';
        relevantTopics.forEach(topic => {
          if (topic.Text) { // Ensure topic.Text is not undefined
            context += `- ${topic.Text.replace(/<[^>]*>?/gm, '')}`; // Strip HTML tags
            if (topic.FirstURL) {
              context += ` (More: ${topic.FirstURL})\n`;
            } else {
              context += '\n';
            }
          }
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
