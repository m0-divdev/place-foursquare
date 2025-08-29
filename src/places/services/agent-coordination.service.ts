import { Injectable, Logger } from '@nestjs/common';
import { mastra } from '../../mastra';

/**
 * Simplified Agent Coordination Service
 * Now focuses purely on coordinating agent execution
 * All intelligence has been moved to orchestrator-agent.ts
 */
@Injectable()
export class AgentCoordinationService {
  private readonly logger = new Logger(AgentCoordinationService.name);

  /**
   * Simplified coordination - just execute the intelligent orchestrator agent
   * All query analysis, tool selection, and coordination is now handled by the agent
   */
  async executeIntelligentQuery(
    query: string,
    sessionId?: string,
  ): Promise<any> {
    const startTime = Date.now();

    try {
      this.logger.log(`Executing intelligent query: ${query.substring(0, 100)}...`);

      // Get the intelligent orchestrator agent
      const orchestratorAgent = mastra.getAgent('orchestratorAgent');
      if (!orchestratorAgent) {
        throw new Error('Orchestrator agent not found');
      }

      // Execute the intelligent agent - it handles everything internally
      const result = await orchestratorAgent.generate([
        {
          role: 'user',
          content: query,
        },
      ]);

      const executionTime = Date.now() - startTime;
      this.logger.log(`Intelligent query completed in ${executionTime}ms`);

      return {
        result,
        executionTime,
        agent: 'orchestratorAgent',
        success: true,
      };

    } catch (error) {
      this.logger.error(`Intelligent query failed: ${error.message}`);

      return {
        result: null,
        executionTime: Date.now() - startTime,
        agent: 'orchestratorAgent',
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Simple agent execution helper
   */
  private async executePhase(
    agentName: string,
    query: string,
    context: any = {},
  ): Promise<any> {
    const agent = mastra.getAgent(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }

    const prompt = this.buildSimplePrompt(query, context);
    return await agent.generate([{ role: 'user', content: prompt }]);
  }

  /**
   * Simple prompt builder for basic agent calls
   */
  private buildSimplePrompt(query: string, context: any = {}): string {
    let prompt = `Query: ${query}\n\n`;

    if (Object.keys(context).length > 0) {
      prompt += `Context:\n${JSON.stringify(context, null, 2)}\n\n`;
    }

    prompt += 'Please process this query and provide a helpful response.';

    return prompt;
  }
}
