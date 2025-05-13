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
  Results: z.array(DuckDuckGoTopicSchema).optional(), // For disambiguation or list results
  Type: z.string().optional(), // A (article), D (disambiguation), C (category), N (name), E (exclusive), P (redirect)
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
      console.error(`DuckDuckGo API request failed with status: ${response.status}`);
      const errorBody = await response.text();
      console.error(`Error body: ${errorBody}`);
      return `Error: Failed to fetch from DuckDuckGo (status ${response.status}).`;
    }

    const data = await response.json();
    const parsedData = DuckDuckGoResponseSchema.safeParse(data);

    if (!parsedData.success) {
      console.error('Failed to parse DuckDuckGo API response:', parsedData.error.flatten());
      return 'Error: Could not parse DuckDuckGo search results.';
    }

    const result = parsedData.data;
    let context = '';

    if (result.Heading && result.AbstractText && result.AbstractText.trim()) {
      context += `Topic: ${result.Heading}\n`;
      context += `Summary: ${result.AbstractText}\n`;
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
    } else if (result.Answer && result.Answer.trim()) {
        context += `Direct Answer: ${result.Answer}\n`;
         if (result.AnswerType) {
            context += `Answer Type: ${result.AnswerType}\n`;
        }
        context += '---\n';
    }


    const MAX_RELATED_TOPICS = 5;
    if (result.RelatedTopics && result.RelatedTopics.length > 0) {
      const relevantTopics = result.RelatedTopics
        .filter(topic => topic.Text && !topic.Result?.startsWith('<a href="https://duckduckgo.com/c/')) // Filter out category topics
        .slice(0, MAX_RELATED_TOPICS);

      if (relevantTopics.length > 0) {
        context += 'Related Information:\n';
        relevantTopics.forEach(topic => {
          if (topic.Text) {
            context += `- ${topic.Text}`;
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
    
    if (context.trim() === "") {
        return null; // No useful information extracted
    }

    return context.trim();

  } catch (error: any) {
    console.error('Error fetching or processing DuckDuckGo API:', error);
    return `Error: An unexpected error occurred while searching: ${error.message}`;
  }
}
