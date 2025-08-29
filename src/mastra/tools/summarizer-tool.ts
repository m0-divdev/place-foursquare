import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Agent } from '@mastra/core/agent';

// Type-only import to avoid circular dependency
type SummarizerAgent = Agent;

interface SummarizeToolContext {
  query: string;
  data: Record<string, any>;
}

// Lazy load the agent to avoid circular dependency
const getSummarizerAgent = async (): Promise<SummarizerAgent> => {
  const { summarizerAgent } = await import('../agents/summarizer-agent.js');
  return summarizerAgent;
};

export const summarizeTool = createTool({
  id: 'summarize-results',
  description: 'Summarizes the results of a query and tool executions into a human-readable format.',
  inputSchema: z.object({
    query: z.string().describe('The original natural language query from the user.'),
    data: z.record(z.any()).describe('A JSON object containing the raw results from executed tool calls.'),
  }),
  outputSchema: z.string().describe('A concise, human-readable summary of the findings.'),
  execute: async ({ context }: { context: SummarizeToolContext }): Promise<string> => {
    const { query, data } = context;

    // Parse the data to extract meaningful information for summarization
    let summaryText = `Query: ${query}\n\n`;

    // Handle different data structures from various tools
    if (data.data_aggregation) {
      summaryText += `Data Aggregation Results:\n${JSON.stringify(data.data_aggregation, null, 2)}\n\n`;
    }

    if (data.data_collection) {
      summaryText += `Data Collection Results:\n${JSON.stringify(data.data_collection, null, 2)}\n\n`;
    }

    if (data.direct_search) {
      summaryText += `Direct Search Results:\n${JSON.stringify(data.direct_search, null, 2)}\n\n`;
    }

    if (data.planning) {
      summaryText += `Planning Results:\n${JSON.stringify(data.planning, null, 2)}\n\n`;
    }

    // Add a simple instruction for the summarizer agent
    const prompt = `Please provide a concise summary of the following data in response to the user's query:\n\n${summaryText}`;

    // Lazy load the summarizer agent to avoid circular dependency
    const summarizerAgent = await getSummarizerAgent();

    // Call the summarizer agent with the prepared prompt
    const response = await summarizerAgent.generate(prompt);

    if (!response.text) {
      throw new Error('Summarizer Agent returned an empty response.');
    }

    return response.text;
  },
});