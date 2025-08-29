import { Injectable, Logger } from '@nestjs/common';

/**
 * Simplified Query Router Service
 * Now focuses purely on routing queries to the intelligent orchestrator agent
 * All intelligence has been moved to the orchestrator-agent.ts
 */
@Injectable()
export class QueryRouterService {
  private readonly logger = new Logger(QueryRouterService.name);

  /**
   * Simplified routing - just pass queries to the intelligent orchestrator agent
   * All query analysis, entity extraction, and coordination is now handled by the agent
   */
  routeQuery(query: string): { agent: string; context: any } {
    this.logger.log(`Routing query to intelligent orchestrator: ${query.substring(0, 100)}...`);

    return {
      agent: 'orchestratorAgent',
      context: {
        originalQuery: query,
        timestamp: new Date().toISOString(),
        // All intelligence moved to orchestrator-agent.ts
      }
    };
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use routeQuery instead
   */
  analyzeQuery(query: string): any {
    this.logger.warn('QueryRouterService.analyzeQuery is deprecated. Use orchestratorAgent directly.');

    const routing = this.routeQuery(query);
    return {
      type: 'LEGACY_ROUTING',
      confidence: 0.5,
      suggestedAgents: [routing.agent],
      extractedEntities: {},
      requiresMapping: false,
      requiresSummary: false,
    };
  }
}
