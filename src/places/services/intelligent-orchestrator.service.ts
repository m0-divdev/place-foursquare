import { Injectable, Logger } from '@nestjs/common';
import { QueryRouterService } from './query-router.service';
import { AgentCoordinationService } from './agent-coordination.service';
import { ToolProxyService } from './tool-proxy.service';

export interface IntelligentQueryRequest {
  query: string;
  sessionId?: string;
  preferences?: {
    includeRawData?: boolean;
    maxExecutionTime?: number;
    cacheStrategy?: 'aggressive' | 'normal' | 'minimal';
    responseFormat?: 'summary' | 'detailed' | 'geojson' | 'hybrid';
  };
  context?: {
    userLocation?: { lat: number; lon: number };
    previousQueries?: string[];
    domainFocus?: 'places' | 'events' | 'analytics' | 'navigation';
  };
}

export interface IntelligentQueryResponse {
  analysis: any; // Simplified - was QueryAnalysis
  executionResult: any; // Simplified - was ExecutionResult
  optimizations: {
    cacheHits: number;
    parallelExecutions: number;
    totalExecutionTime: number;
    agentsUsed: string[];
  };
  recommendations?: {
    relatedQueries: string[];
    suggestedActions: string[];
  };
}

@Injectable()
export class IntelligentOrchestratorService {
  private readonly logger = new Logger(IntelligentOrchestratorService.name);

  constructor(
    private readonly queryRouter: QueryRouterService,
    private readonly agentCoordination: AgentCoordinationService,
    private readonly toolProxy: ToolProxyService,
  ) {}

  async processIntelligentQuery(
    request: IntelligentQueryRequest,
  ): Promise<IntelligentQueryResponse> {
    const startTime = Date.now();

    this.logger.log(`Processing intelligent query: "${request.query}"`);

    try {
      // 1. Analyze and route the query
      const analysis = this.queryRouter.analyzeQuery(request.query);

      // 2. Apply user preferences and context
      this.applyUserContext(analysis, request.context);

      // 3. Optimize execution strategy based on preferences
      await this.optimizeExecution(analysis, request.preferences);

      // 4. Execute coordinated multi-agent workflow
      const executionResult =
        await this.agentCoordination.executeIntelligentQuery(
          request.query,
          request.sessionId,
        );

      // 5. Generate recommendations
      const recommendations = await this.generateRecommendations(
        request,
        analysis,
        executionResult,
      );

      // 6. Compile optimization metrics
      const optimizations = {
        cacheHits: this.getCacheHitCount(),
        parallelExecutions: this.getParallelExecutionCount(executionResult),
        totalExecutionTime: Date.now() - startTime,
        agentsUsed: analysis.suggestedAgents,
      };

      return {
        analysis,
        executionResult,
        optimizations,
        recommendations,
      };
    } catch (error) {
      this.logger.error(
        `Intelligent query processing failed: ${error.message}`,
      );
      throw error;
    }
  }

  async processStreamingQuery(
    request: IntelligentQueryRequest,
    onProgress: (update: Partial<IntelligentQueryResponse>) => void,
  ): Promise<IntelligentQueryResponse> {
    const analysis = this.queryRouter.analyzeQuery(request.query);

    // Send initial analysis
    onProgress({ analysis });

    // Apply optimizations
    await this.optimizeExecution(analysis, request.preferences);

    // Execute with progress updates
    const executionResult = await this.executeWithProgress(
      request.query,
      analysis,
      request.sessionId,
      onProgress,
    );

    const recommendations = await this.generateRecommendations(
      request,
      analysis,
      executionResult,
    );

    const optimizations = {
      cacheHits: this.getCacheHitCount(),
      parallelExecutions: this.getParallelExecutionCount(executionResult),
      totalExecutionTime: executionResult.executionTime,
      agentsUsed: analysis.suggestedAgents,
    };

    const finalResponse = {
      analysis,
      executionResult,
      optimizations,
      recommendations,
    };

    // Send final update
    onProgress(finalResponse);

    return finalResponse;
  }

  private applyUserContext(
    analysis: any,
    context?: IntelligentQueryRequest['context'],
  ): void {
    if (!context) return;

    // Enhance analysis with user location
    if (context.userLocation && !analysis.extractedEntities?.locations?.length) {
      analysis.extractedEntities = analysis.extractedEntities || {};
      analysis.extractedEntities.locations = [
        `${context.userLocation.lat},${context.userLocation.lon}`,
      ];
    }

    // Adjust confidence based on domain focus
    if (context.domainFocus) {
      switch (context.domainFocus) {
        case 'places':
          if (
            analysis.type?.includes('SEARCH') ||
            analysis.type?.includes('COMPREHENSIVE')
          ) {
            analysis.confidence = Math.min((analysis.confidence || 0.8) + 0.1, 1.0);
          }
          break;
        case 'analytics':
          if (analysis.type === 'ANALYTICS') {
            analysis.confidence = Math.min((analysis.confidence || 0.8) + 0.2, 1.0);
          }
          break;
      }
    }
  }

  private async optimizeExecution(
    analysis: any,
    preferences?: IntelligentQueryRequest['preferences'],
  ): Promise<void> {
    if (!preferences) return;

    // Pre-warm cache for common tools based on extracted entities
    if (
      preferences.cacheStrategy === 'aggressive' &&
      analysis.extractedEntities?.locations
    ) {
      await this.preWarmCache(analysis.extractedEntities);
    }

    // Clean cache if minimal strategy
    if (preferences.cacheStrategy === 'minimal') {
      this.toolProxy.cleanExpiredEntries();
    }
  }

  private async preWarmCache(
    entities: any,
  ): Promise<void> {
    const preWarmTasks: Promise<any>[] = [];

    // Pre-warm location-based tools
    if (entities.locations) {
      for (const location of entities.locations) {
        if (location.includes(',')) {
          const [lat, lon] = location.split(',').map(Number);
          if (!isNaN(lat) && !isNaN(lon)) {
            preWarmTasks.push(
              this.toolProxy.getWeather({ lat, lon }).catch(() => {}),
              this.toolProxy
                .searchEvents({ lat, lon, radius: 1000 })
                .catch(() => {}),
            );
          }
        }
      }
    }

    // Execute pre-warming in background
    if (preWarmTasks.length > 0) {
      Promise.all(preWarmTasks).catch(() => {
        // Ignore pre-warming failures
      });
    }
  }

  private async executeWithProgress(
    query: string,
    analysis: any,
    sessionId?: string,
    onProgress?: (update: Partial<IntelligentQueryResponse>) => void,
  ): Promise<any> {
    // This would integrate with the agent coordination service
    // to provide real-time progress updates
    return this.agentCoordination.executeIntelligentQuery(query, sessionId);
  }

  private async generateRecommendations(
    request: IntelligentQueryRequest,
    analysis: any,
    result: any,
  ): Promise<IntelligentQueryResponse['recommendations']> {
    const relatedQueries: string[] = [];
    const suggestedActions: string[] = [];

    // Generate related queries based on entities
    if (analysis.extractedEntities.locations) {
      relatedQueries.push(
        `What are the popular events in ${analysis.extractedEntities.locations[0]}?`,
        `Show me restaurants near ${analysis.extractedEntities.locations[0]} on a map`,
      );
    }

    if (analysis.extractedEntities.categories) {
      relatedQueries.push(
        `Find ${analysis.extractedEntities.categories[0]} with good foot traffic`,
        `Compare ${analysis.extractedEntities.categories[0]} ratings across different areas`,
      );
    }

    // Generate suggested actions based on results
    if (result.success && result.finalOutput) {
      if (analysis.requiresMapping && !result.finalOutput.mapData) {
        suggestedActions.push('Generate map visualization of these results');
      }

      if (!analysis.requiresSummary && result.finalOutput.rawData) {
        suggestedActions.push('Get a summary of these findings');
      }
    }

    return {
      relatedQueries: relatedQueries.slice(0, 3), // Limit to 3
      suggestedActions: suggestedActions.slice(0, 2), // Limit to 2
    };
  }

  private getCacheHitCount(): number {
    const stats = this.toolProxy.getCacheStats();
    return stats.size;
  }

  private getParallelExecutionCount(result: any): number {
    // Count parallel phases from execution result
    if (!result || typeof result !== 'object') return 0;

    // Check if result has any phase information
    if (result.phaseResults && typeof result.phaseResults === 'object') {
      const phases = Array.from(result.phaseResults.keys());
      return phases.filter((phase: string) =>
        phase && typeof phase === 'string' && (
          phase.includes('parallel') ||
          phase.includes('map_generation') ||
          phase.includes('summarization')
        )
      ).length;
    }

    return 0;
  }

  // Utility methods for direct tool access
  async getToolResult(toolName: string, params: any): Promise<any> {
    const methodMap: { [key: string]: keyof ToolProxyService } = {
      searchPoiTool: 'searchPoi',
      tomtomFuzzySearchTool: 'fuzzySearch',
      getPlaceByIdTool: 'getPlaceById',
      getWeatherTool: 'getWeather',
      searchEventsTool: 'searchEvents',
      getFootTrafficTool: 'getFootTraffic',
    };

    const method = methodMap[toolName];
    if (method && typeof (this.toolProxy as any)[method] === 'function') {
      const result = await (this.toolProxy as any)[method](params);
      return result.data;
    }

    throw new Error(`Tool ${toolName} not available via proxy`);
  }

  // Cache management
  clearAllCaches(): void {
    this.toolProxy.clearCache();
    this.logger.log('All caches cleared');
  }

  getCacheStatistics(): any {
    return {
      toolCache: this.toolProxy.getCacheStats(),
      cleanupRecommended: this.toolProxy.getCacheStats().size > 100,
    };
  }
}
