import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const baseURL = 'https://areainsights.googleapis.com/v1:computeInsights';

// Enhanced location filter with better validation
const locationFilterSchema = z.object({
  circle: z.object({
    latLng: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }).optional(),
    place: z.string().describe("Place ID for center. Must start with 'places/'").optional(),
    radius: z.number().min(1).max(50000).describe('Radius in meters (1-50000)'),
  }).optional(),
  region: z.object({
    place: z.string().describe("Place ID of the region. Must start with 'places/'"),
  }).optional(),
  customArea: z.object({
    polygon: z.object({
      coordinates: z.array(z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })),
    }),
  }).optional(),
}).refine(data => 
  (data.circle && (data.circle.latLng || data.circle.place)) || data.region || data.customArea,
  { message: "At least one location filter (circle, region, or customArea) must be specified" }
);

// Enhanced type filter with business intelligence focus
const typeFilterSchema = z.object({
  includedTypes: z.array(z.string()).optional().describe('General place types (restaurant, store, etc.)'),
  excludedTypes: z.array(z.string()).optional().describe('Types to exclude'),
  includedPrimaryTypes: z.array(z.string()).optional().describe('Primary business types for focused analysis'),
  excludedPrimaryTypes: z.array(z.string()).optional().describe('Primary types to exclude'),
}).refine(data => 
  data.includedTypes?.length || data.includedPrimaryTypes?.length,
  { message: "At least one of includedTypes or includedPrimaryTypes must be specified" }
);

const ratingFilterSchema = z.object({
  minRating: z.number().min(1.0).max(5.0).optional(),
  maxRating: z.number().min(1.0).max(5.0).optional(),
});

// Business Intelligence presets for common use cases
const BUSINESS_INTELLIGENCE_PRESETS = {
  RETAIL_GENERAL: {
    includedTypes: ['store', 'shopping_mall', 'supermarket', 'department_store', 'convenience_store'],
    excludedTypes: ['gas_station', 'car_dealer'] // Exclude non-retail businesses
  },
  FOOD_SERVICE: {
    includedPrimaryTypes: ['restaurant'], // Primary focus on restaurants
    includedTypes: ['cafe', 'fast_food_restaurant', 'meal_takeaway', 'bar'],
    excludedTypes: ['lodging', 'gas_station'] // Exclude non-food businesses
  },
  PROFESSIONAL_SERVICES: {
    includedPrimaryTypes: ['lawyer', 'accounting', 'dentist', 'doctor'], // Primary professional services
    includedTypes: ['consultant', 'real_estate_agency', 'insurance_agency']
  },
  HEALTH_WELLNESS: {
    includedPrimaryTypes: ['gym', 'spa', 'beauty_salon', 'physiotherapist', 'hospital', 'pharmacy'],
    excludedTypes: ['lodging', 'gas_station', 'car_dealer']
  },
  HOSPITALITY: {
    includedPrimaryTypes: ['hotel', 'lodging'],
    includedTypes: ['bar', 'night_club', 'restaurant'],
    excludedTypes: ['gas_station', 'car_dealer']
  },
  FINANCIAL_SERVICES: {
    includedPrimaryTypes: ['bank'],
    includedTypes: ['atm', 'insurance_agency', 'accounting'],
    excludedTypes: ['gas_station', 'restaurant', 'lodging']
  },
  EDUCATION: {
    includedPrimaryTypes: ['school', 'university'],
    includedTypes: ['library', 'book_store'],
    excludedTypes: ['gas_station', 'restaurant', 'lodging']
  },
  AUTOMOTIVE: {
    includedPrimaryTypes: ['car_dealer', 'car_rental', 'car_repair', 'gas_station'],
    excludedTypes: ['restaurant', 'lodging']
  },
  HOME_SERVICES: {
    includedPrimaryTypes: ['plumber', 'electrician', 'contractor'],
    includedTypes: ['home_goods_store', 'hardware_store'],
    excludedTypes: ['restaurant', 'lodging', 'gas_station']
  },
  SOLO_PROFESSIONAL: {
    includedTypes: ['consultant', 'lawyer', 'dentist', 'doctor', 'therapist', 'coach'],
    excludedTypes: ['restaurant', 'lodging', 'gas_station', 'car_dealer']
  },
  TECH_SERVICES: {
    includedPrimaryTypes: ['software_company'],
    includedTypes: ['computer_store', 'electronics_store', 'internet_cafe'],
    excludedTypes: ['restaurant', 'lodging', 'gas_station']
  }
};

export const getGooglePlacesInsightsTool = createTool({
  id: 'get-google-places-insights',
  description: `Universal Business Intelligence Tool using Google Places Insights API. Analyzes market opportunities, competition, and strategic locations for ANY business type.

  Designed for:
  - Retail marketers seeking market opportunities
  - Solo professionals finding underserved markets
  - Entrepreneurs analyzing location suitability
  - Business consultants conducting competitive analysis
  - Real estate professionals evaluating commercial viability

  Capabilities:
  - Market density analysis across all business types
  - Competition assessment with strategic recommendations
  - Location intelligence for business planning
  - Industry-specific market insights
  - Strategic opportunity identification`,

  inputSchema: z.object({
    insights: z.array(z.enum(['INSIGHT_COUNT', 'INSIGHT_PLACES'])).describe('INSIGHT_COUNT for market analysis, INSIGHT_PLACES for detailed competitor lists'),

    filter: z.object({
      locationFilter: locationFilterSchema,
      typeFilter: typeFilterSchema,
      operatingStatus: z.array(z.enum([
        'OPERATING_STATUS_UNSPECIFIED',
        'OPERATING_STATUS_OPERATIONAL',
        'OPERATING_STATUS_TEMPORARILY_CLOSED',
        'OPERATING_STATUS_PERMANENTLY_CLOSED'
      ])).optional().default(['OPERATING_STATUS_OPERATIONAL']),
      priceLevels: z.array(z.enum([
        'PRICE_LEVEL_UNSPECIFIED',
        'PRICE_LEVEL_FREE',
        'PRICE_LEVEL_INEXPENSIVE',
        'PRICE_LEVEL_MODERATE',
        'PRICE_LEVEL_EXPENSIVE',
        'PRICE_LEVEL_VERY_EXPENSIVE'
      ])).optional(),
      ratingFilter: ratingFilterSchema.optional(),
    }),

    // Enhanced Business Intelligence Context
    analysisType: z.enum([
      'MARKET_DENSITY',
      'COMPETITOR_ANALYSIS',
      'LOCATION_SUITABILITY',
      'PRICE_ANALYSIS',
      'CUSTOM'
    ]).optional().default('MARKET_DENSITY').describe('Type of business analysis to perform'),

    businessContext: z.object({
      industry: z.enum([
        'RETAIL_GENERAL',
        'FOOD_SERVICE',
        'PROFESSIONAL_SERVICES',
        'HEALTH_WELLNESS',
        'HOSPITALITY',
        'FINANCIAL_SERVICES',
        'EDUCATION',
        'AUTOMOTIVE',
        'HOME_SERVICES',
        'SOLO_PROFESSIONAL',
        'TECH_SERVICES',
        'CUSTOM'
      ]).optional().default('RETAIL_GENERAL').describe('Target industry for analysis'),

      targetCustomers: z.string().optional().describe('Target customer demographics or segments'),
      businessModel: z.enum([
        'B2B', 'B2C', 'FRANCHISE', 'SOLO_PRACTICE', 'CORPORATE', 'STARTUP', 'FREELANCE'
      ]).optional().describe('Business model type'),

      strategicGoals: z.array(z.enum([
        'MARKET_ENTRY', 'EXPANSION', 'COMPETITION_ANALYSIS', 'LOCATION_SELECTION',
        'PRICE_OPTIMIZATION', 'CUSTOMER_ACQUISITION', 'MARKET_SHARE_GROWTH'
      ])).optional().describe('Strategic objectives'),

      budgetRange: z.enum([
        'LOW', 'MEDIUM', 'HIGH', 'PREMIUM', 'ULTRA_PREMIUM'
      ]).optional().describe('Target price range for business decisions'),
    }).optional(),
  }),

  outputSchema: z.object({
    count: z.string().optional().describe('Number of places matching the filter'),
    places: z.array(z.string()).optional().describe('Place IDs matching the filter'),

    businessIntelligence: z.object({
      marketDensity: z.string().optional().describe('Market density assessment'),
      competitionLevel: z.enum(['LOW', 'MODERATE', 'HIGH', 'SATURATED']).optional(),
      recommendations: z.array(z.string()).optional().describe('Strategic business recommendations'),
      riskFactors: z.array(z.string()).optional().describe('Potential risks identified'),
      opportunities: z.array(z.string()).optional().describe('Identified market opportunities'),
      strategicInsights: z.array(z.string()).optional().describe('Industry-specific strategic insights'),
    }).optional(),

    metadata: z.object({
      analysisType: z.string(),
      industry: z.string().optional(),
      searchRadius: z.number().optional(),
      filterCriteria: z.record(z.any()),
      timestamp: z.string(),
      strategicContext: z.record(z.any()).optional(),
    }),

    // Enhanced outputs for different user types
    retailMarketerInsights: z.object({
      targetAudienceDensity: z.string().optional(),
      competitivePositioning: z.string().optional(),
      marketingRecommendations: z.array(z.string()).optional(),
    }).optional(),

    soloProfessionalInsights: z.object({
      marketGapAnalysis: z.string().optional(),
      clientAcquisitionPotential: z.string().optional(),
      serviceDifferentiation: z.array(z.string()).optional(),
    }).optional(),
  }),
  
  execute: async ({ context }) => {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Google API key not found. Please set the GOOGLE_API_KEY environment variable.');
    }

    // Apply business intelligence presets if applicable
    let enhancedFilter = { ...context.filter };
    if (context.businessContext?.industry && context.businessContext.industry !== 'CUSTOM') {
      const preset = BUSINESS_INTELLIGENCE_PRESETS[context.businessContext.industry as keyof typeof BUSINESS_INTELLIGENCE_PRESETS];
      if (preset) {
        // Properly merge typeFilter to avoid undefined issues
        const existingTypeFilter = enhancedFilter.typeFilter || {};
        enhancedFilter.typeFilter = {
          ...existingTypeFilter,
          ...preset
        };
      }
    }

    // Implement automatic radius adjustment to avoid API limits
    const baseURL = 'https://areainsights.googleapis.com/v1:computeInsights';
    let currentFilter = { ...enhancedFilter };
    let attempts = 0;
    const maxAttempts = 3;
    let data: any = null;

    while (attempts < maxAttempts) {
      const requestBody = {
        insights: context.insights,
        filter: currentFilter
      };

      try {
        const response = await fetch(baseURL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorBody = await response.text();

          // Handle 429 error by reducing radius
          if (response.status === 429 && errorBody.includes('maximum number of allowed places')) {
            attempts++;

            // Reduce radius by 75% each attempt (more aggressive reduction)
            const currentRadius = currentFilter.locationFilter?.circle?.radius || 1000;
            const newRadius = Math.floor(currentRadius * 0.25); // 75% reduction

            // Allow minimum radius of 50 meters
            if (newRadius < 50) {
              // If radius becomes too small, try alternative approach
              console.warn(`Minimum radius reached. Trying alternative filtering strategy...`);
              
              // Validate and fix primary types to ensure Google Places API compatibility
              let correctedPreset = { ...currentFilter.typeFilter } as any;

              // Fix fast_food to fast_food_restaurant in includedTypes
              if (correctedPreset.includedTypes) {
                correctedPreset.includedTypes = correctedPreset.includedTypes.map((type: string) => {
                  if (type === 'fast_food') return 'fast_food_restaurant';
                  return type;
                });
              }

              // Ensure primary types are valid Google Places API types
              if (correctedPreset.includedPrimaryTypes) {
                correctedPreset.includedPrimaryTypes = correctedPreset.includedPrimaryTypes.filter((type: string) => {
                  // Only allow known valid Google Places API primary types
                  const validPrimaryTypes = ['restaurant', 'store', 'hotel', 'bank', 'school', 'gym', 'spa', 'beauty_salon', 'lawyer', 'accounting', 'dentist', 'doctor', 'car_dealer', 'car_rental', 'car_repair', 'gas_station', 'plumber', 'electrician', 'contractor', 'software_company'];
                  return validPrimaryTypes.includes(type);
                });
              }

              currentFilter = {
                ...currentFilter,
                locationFilter: {
                  ...currentFilter.locationFilter,
                  circle: {
                    ...currentFilter.locationFilter?.circle,
                    radius: newRadius
                  }
                }
              };

              console.warn(`API limit exceeded. Reducing search radius from ${currentRadius}m to ${newRadius}m (attempt ${attempts}/${maxAttempts})`);
            } else {
              currentFilter = {
                ...currentFilter,
                locationFilter: {
                  ...currentFilter.locationFilter,
                  circle: {
                    ...currentFilter.locationFilter?.circle,
                    radius: newRadius
                  }
                }
              };

              console.warn(`API limit exceeded. Reducing search radius from ${currentRadius}m to ${newRadius}m (attempt ${attempts}/${maxAttempts})`);
            }
            continue;
          }

          throw new Error(`Google Places Insights API request failed with status ${response.status}: ${errorBody}`);
        }

        // Success - get data and break out of retry loop
        data = await response.json();
        break;

      } catch (error) {
        if (attempts >= maxAttempts || !error.message?.includes('maximum number of allowed places')) {
          throw error;
        }
        attempts++;
      }
    }

    if (!data) {
      throw new Error('Failed to get data from Google Places API after all retry attempts');
    }
    
    // Parse API response correctly based on documentation
    let result: any = {
      metadata: {
        analysisType: context.analysisType || 'CUSTOM',
        filterCriteria: enhancedFilter,
        timestamp: new Date().toISOString(),
      }
    };

    // Handle count insights
    if (data.count !== undefined) {
      result.count = data.count;
    }

    // Handle place insights - correct parsing based on API docs
    if (data.placeInsights && Array.isArray(data.placeInsights)) {
      result.places = data.placeInsights.map((insight: any) => insight.place);
    }

    // Add business intelligence analysis
    if (context.analysisType && context.analysisType !== 'CUSTOM') {
      const count = parseInt(data.count || '0');
      const radius = enhancedFilter.locationFilter?.circle?.radius || 1000;
      
      result.businessIntelligence = generateBusinessIntelligence(
        count, 
        radius, 
        context.analysisType, 
        context.businessContext
      );
      
      if (enhancedFilter.locationFilter?.circle?.radius) {
        result.metadata.searchRadius = enhancedFilter.locationFilter.circle.radius;
      }
    }

    // Add industry-specific insights
    if (context.businessContext?.industry) {
      result.metadata.industry = context.businessContext.industry;
      result.metadata.strategicContext = context.businessContext;

      if (context.businessContext.industry === 'RETAIL_GENERAL' || context.businessContext.industry === 'FOOD_SERVICE') {
        result.retailMarketerInsights = generateRetailInsights(data, context);
      } else if (context.businessContext.industry === 'SOLO_PROFESSIONAL' || context.businessContext.industry === 'PROFESSIONAL_SERVICES') {
        result.soloProfessionalInsights = generateSoloProfessionalInsights(data, context);
      }
    }

    return result;
  },
});

// Business intelligence analysis function
function generateBusinessIntelligence(
  count: number, 
  radius: number, 
  analysisType: string, 
  businessContext?: any
): any {
  const density = count / (Math.PI * Math.pow(radius / 1000, 2)); // businesses per km²
  
  let competitionLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'SATURATED';
  let recommendations: string[] = [];
  let riskFactors: string[] = [];
  let opportunities: string[] = [];
  let strategicInsights: string[] = [];

  // Determine competition level based on density
  if (density < 1) {
    competitionLevel = 'LOW';
    recommendations.push('Market opportunity exists with low competition');
    recommendations.push('Consider being a market pioneer in this area');
    opportunities.push('First-mover advantage in underserved market');
  } else if (density < 5) {
    competitionLevel = 'MODERATE';
    recommendations.push('Balanced market with room for differentiation');
    recommendations.push('Focus on unique value proposition');
    strategicInsights.push('Market has healthy competition - focus on service quality');
  } else if (density < 15) {
    competitionLevel = 'HIGH';
    recommendations.push('Highly competitive market - strong differentiation required');
    riskFactors.push('High competition may impact market share');
    strategicInsights.push('Consider niche positioning or superior customer experience');
  } else {
    competitionLevel = 'SATURATED';
    recommendations.push('Market appears saturated - consider alternative locations');
    riskFactors.push('Market saturation may limit growth potential');
    riskFactors.push('High customer acquisition costs likely');
    opportunities.push('Consider consolidation or acquisition opportunities');
  }

  // Industry-specific insights
  if (businessContext?.industry) {
    const industry = businessContext.industry;
    
    if (industry === 'RETAIL_GENERAL' || industry === 'FOOD_SERVICE') {
      strategicInsights.push('Consider seasonal demand patterns for inventory planning');
      if (competitionLevel === 'HIGH') {
        recommendations.push('Focus on loyalty programs and customer retention');
      }
    } else if (industry === 'SOLO_PROFESSIONAL' || industry === 'PROFESSIONAL_SERVICES') {
      strategicInsights.push('Build personal brand and professional network');
      if (competitionLevel === 'LOW') {
        opportunities.push('Potential for premium pricing in underserved market');
      }
    } else if (industry === 'TECH_SERVICES') {
      strategicInsights.push('Consider digital marketing and online presence');
      recommendations.push('Focus on technology adoption and innovation');
    }
  }

  // Analysis type specific insights
  switch (analysisType) {
    case 'MARKET_DENSITY':
      recommendations.push(`Market density: ${density.toFixed(2)} businesses per km²`);
      break;
    case 'COMPETITOR_ANALYSIS':
      recommendations.push(`${count} direct competitors identified in ${radius}m radius`);
      if (count > 10) {
        riskFactors.push('High number of competitors may indicate market saturation');
      }
      break;
    case 'LOCATION_SUITABILITY':
      if (competitionLevel === 'LOW') {
        recommendations.push('Location shows good potential for new business entry');
      } else if (competitionLevel === 'SATURATED') {
        recommendations.push('Consider alternative locations with less competition');
      }
      break;
  }

  return {
    marketDensity: `${density.toFixed(2)} businesses per km² (${count} total in ${radius}m radius)`,
    competitionLevel,
    recommendations,
    riskFactors: riskFactors.length > 0 ? riskFactors : undefined,
    opportunities: opportunities.length > 0 ? opportunities : undefined,
    strategicInsights: strategicInsights.length > 0 ? strategicInsights : undefined,
  };
}

// Retail marketer specific insights
function generateRetailInsights(data: any, context: any): any {
  const count = parseInt(data.count || '0');
  
  return {
    targetAudienceDensity: count > 0 ? `High customer density area (${count} similar businesses)` : 'Low customer density area',
    competitivePositioning: count > 10 ? 'Highly competitive - focus on differentiation' : 'Low competition - opportunity for market capture',
    marketingRecommendations: [
      'Develop targeted local marketing campaigns',
      'Consider partnerships with complementary businesses',
      'Build customer loyalty programs',
      'Leverage social media for local engagement'
    ]
  };
}

// Solo professional specific insights
function generateSoloProfessionalInsights(data: any, context: any): any {
  const count = parseInt(data.count || '0');
  
  return {
    marketGapAnalysis: count < 3 ? 'Significant market gap - high opportunity' : 'Established market with moderate competition',
    clientAcquisitionPotential: count < 5 ? 'High potential for new client acquisition' : 'Focus on client retention and referrals',
    serviceDifferentiation: [
      'Develop specialized service offerings',
      'Build personal brand and credibility',
      'Create referral networks',
      'Offer premium consultation services'
    ]
  };
}
