// NestJS dependency injection and logging
import { Injectable, Logger } from '@nestjs/common';

// Import Mastra framework instance for direct agent access
import { mastra } from '../mastra';

// Import specialized service classes for different types of queries
import { OrchestratorService } from './services/orchestrator.service';
import { IntelligentOrchestratorService } from './services/intelligent-orchestrator.service';
import { MapDataService } from './services/map-data.service';

// Import DTOs for unified chat functionality
import {
  UnifiedChatDto,
  UnifiedChatResponseDto,
  ResponseType,
  ResponsePreference,
  UnifiedChatSchema,
} from './dto/unified-chat.dto';

/**
 * PlacesService - Core business logic service for the Foursquare Places application
 *
 * This service acts as the main orchestrator that:
 * 1. Receives requests from the controller layer
 * 2. Analyzes user queries to determine intent
 * 3. Routes to appropriate specialized services
 * 4. Coordinates with Mastra AI agents
 * 5. Returns processed responses
 *
 * Service Architecture:
 * - OrchestratorService: Handles general text-based queries
 * - IntelligentOrchestratorService: Processes complex analytical queries
 * - MapDataService: Generates GeoJSON data for map visualization
 * - QueryRouterService: Analyzes query intent for intelligent routing
 */
@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);

  /**
   * Constructor - Injects all specialized services for query processing
   * @param orchestratorService - Legacy service (deprecated)
   * @param intelligentOrchestrator - Legacy service (deprecated)
   * @param mapDataService - Map data generation service
   */
  constructor(
    private readonly orchestratorService: OrchestratorService,
    private readonly intelligentOrchestrator: IntelligentOrchestratorService,
    private readonly mapDataService: MapDataService,
  ) {}

  // Search method removed - only unified chat needed

  /**
   * Unified Chat Method - Intelligent Agent Processing (MAIN FEATURE)
   *
   * This method now routes ALL queries directly to the intelligent orchestrator agent
   * for comprehensive business intelligence analysis.
   *
   * Intelligence Features:
   * - Direct agent processing with full query understanding
   * - Automatic entity extraction and classification
   * - Strategic data collection and analysis
   * - Business intelligence tailored to user needs
   * - Interactive map generation for location-based queries
   *
   * @param unifiedChatDto - Contains message, sessionId, and preferences
   * @returns Promise<UnifiedChatResponseDto> - Intelligent business intelligence response
   */
  async processUnifiedChat(
    unifiedChatDto: UnifiedChatDto,
  ): Promise<UnifiedChatResponseDto> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Processing unified chat with intelligent agent: "${unifiedChatDto.message.substring(0, 100)}..."`,
      );

      // Validate input
      const validatedInput = UnifiedChatSchema.parse(unifiedChatDto);

      // Route ALL queries directly to the intelligent orchestrator agent
      this.logger.log('Routing to intelligent orchestrator agent for comprehensive analysis');

      const agentResult = await mastra.getAgent('orchestratorAgent').generate([
        {
          role: 'user',
          content: validatedInput.message,
        },
      ]);

      // Parse the agent's response
      let responseData: any;
      let responseType: ResponseType = ResponseType.TEXT;
      let agentsUsed: string[] = ['orchestratorAgent'];
      let toolsUsed: string[] = ['planTool', 'executePlanTool', 'summarizeTool'];
      let confidence: number = 0.5;
      let intent: string = 'INTELLIGENT_ANALYSIS';
      let detectedEntities: string[] = [];

      try {
        const parsedResult = JSON.parse(agentResult.text || '{}');

        if (parsedResult.type === 'analysis') {
          responseType = ResponseType.ANALYSIS;

          // Extract data from the new simplified format
          const queryAnalysis = parsedResult.queryAnalysis || {};
          const entityExtraction = parsedResult.entityExtraction || {};
          const businessIntelligence = parsedResult.businessIntelligence || {};
          const dataRequirements = parsedResult.dataRequirements || {};

          responseData = {
            summary: businessIntelligence.marketAnalysis ||
              `${businessIntelligence.competitorAnalysis || 'Analysis completed'}. ${businessIntelligence.locationRecommendations || ''} ${businessIntelligence.strategicAdvice || ''}`,
            competitorAnalysis: businessIntelligence.competitorAnalysis || 'Competitor analysis completed',
            locationRecommendations: businessIntelligence.locationRecommendations || 'Location recommendations provided',
            strategicAdvice: businessIntelligence.strategicAdvice || 'Strategic advice provided',
            queryAnalysis: queryAnalysis,
            entityExtraction: entityExtraction,
            dataRequirements: dataRequirements,
            // Add basic map data structure
            mapData: {
              type: "FeatureCollection",
              features: [],
              bounds: null,
              center: null
            }
          };

          confidence = queryAnalysis.confidence || 0.85;
          intent = queryAnalysis.queryType || queryAnalysis.intent || 'LOCATION_PLANNING';
          detectedEntities = [
            ...(entityExtraction.locations || []),
            ...(entityExtraction.businessTypes || [])
          ];
        } else {
          responseData = agentResult.text || 'Query processed successfully';
        }
      } catch (parseError) {
        // If parsing fails, use the raw text response
        this.logger.warn('Agent response parsing failed, using raw text response');
        responseData = agentResult.text || 'Query processed successfully';
      }

      const executionTime = Date.now() - startTime;

      return {
        type: responseType,
        data: responseData,
        metadata: {
          executionTime,
          agentsUsed,
          toolsUsed,
          confidence,
          intent,
          detectedEntities,
        },
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Unified chat processing failed: ${error.message}`);

      return {
        type: ResponseType.TEXT,
        data: `I encountered an error processing your request: ${error.message}`,
        metadata: {
          executionTime: Date.now() - startTime,
          agentsUsed: [],
          toolsUsed: [],
          confidence: 0,
        },
        success: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private determineAutoResponseType(
    analysis: any,
    message: string,
  ): ResponseType {
    // Keywords that strongly indicate map visualization
    const mapKeywords = [
      'map',
      'show on map',
      'visualize',
      'plot',
      'geojson',
      'locations',
      'where are',
      'show me on',
      'display on map',
      'geographic',
      'coordinates',
    ];

    // Keywords that indicate detailed analysis needed
    const analysisKeywords = [
      'analyze',
      'analysis',
      'comprehensive',
      'detailed',
      'compare',
      'trends',
      'patterns',
      'insights',
      'statistics',
      'metrics',
      'report',
      'breakdown',
    ];

    const lowerMessage = message.toLowerCase();

    // Check for explicit map requests
    if (mapKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      return ResponseType.GEOJSON;
    }

    // Check for analysis requests
    if (analysisKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      return ResponseType.ANALYSIS;
    }

    // Use query analysis results
    switch (analysis.type) {
      case 'MAP_DATA_ONLY':
        return ResponseType.GEOJSON;
      case 'ANALYTICS':
      case 'COMPREHENSIVE':
        return ResponseType.ANALYSIS;
      default:
        return ResponseType.TEXT;
    }
  }

  private mapPreferenceToType(preference: ResponsePreference): ResponseType {
    switch (preference) {
      case ResponsePreference.GEOJSON:
        return ResponseType.GEOJSON;
      case ResponsePreference.ANALYSIS:
        return ResponseType.ANALYSIS;
      case ResponsePreference.TEXT:
      default:
        return ResponseType.TEXT;
    }
  }
}
