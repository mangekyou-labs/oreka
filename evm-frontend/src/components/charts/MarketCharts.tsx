import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Box, Tabs, TabList, TabPanels, Tab, TabPanel, HStack, Button, Text, ButtonGroup, Flex, Skeleton, Tooltip as ChakraTooltip, VStack } from '@chakra-ui/react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine, Area, AreaChart } from 'recharts';
import { PriceService } from '../../services/PriceService';
import { format, addDays, subDays } from 'date-fns';
import { STRIKE_PRICE_MULTIPLIER } from '../../utils/constants';


interface Position {
  long: number;
  short: number;
}

interface PositionPoint {
  timestamp: number;
  longPercentage: number | null;
  shortPercentage: number | null;
  isMainPoint?: boolean;
  isCurrentPoint?: boolean;
}

interface MarketChartsProps {
  chartData: any[];
  positionHistory: PositionPoint[];
  positions: Position;
  chartSymbol?: string;
  strikePrice?: number;
  timeRange?: string;
  chartType?: 'price' | 'position';
  onTimeRangeChange?: (range: string, chartType: 'price' | 'position') => void;
  options?: {
    showPrice?: boolean;
    showPositions?: boolean;
  };
  biddingStartTime: number;
  maturityTime: number;
}

/**
 * MarketCharts Component
 * Renders interactive charts for binary option markets showing price history and position distribution
 * Supports both price trend visualization and position ratio tracking over time
 * 
 * @param chartData - Historical price data points for the trading pair
 * @param positionHistory - Time series data of long/short position distribution
 * @param positions - Current position values (long/short totals)
 * @param strikePrice - Target price threshold for the binary option
 * @param chartType - Type of chart to display ('price' or 'position')
 * @param options - Display configuration options
 * @param chartSymbol - Trading pair symbol (e.g., 'BTC/USD')
 * @param biddingStartTime - Unix timestamp when bidding phase started
 * @param maturityTime - Unix timestamp when the market matures/expires
 */
const MarketCharts: React.FC<MarketChartsProps> = ({
  chartData,
  positionHistory,
  positions,
  strikePrice,
  chartType = 'price',
  options = { showPrice: true, showPositions: true },
  chartSymbol,
  biddingStartTime,
  maturityTime
}) => {
  const [currentTime, setCurrentTime] = useState<number>(Math.floor(Date.now() / 1000));
  const [isLoadingChart, setIsLoadingChart] = useState<boolean>(true);
  const [effectiveChartSymbol, setEffectiveChartSymbol] = useState<string>(chartSymbol || '');
  const initialLoadRef = useRef<boolean>(true);
  const priceServiceRef = useRef(PriceService.getInstance());
  const [hoverData, setHoverData] = useState<any>(null);
  const [enhancedPositionData, setEnhancedPositionData] = useState<PositionPoint[]>([]);
  const positionHistoryRef = useRef<PositionPoint[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [diffString, setDiffString] = useState<string>('');
  const [percentDiff, setPercentDiff] = useState<number>(0);

  useEffect(() => {
    const cachedData = localStorage.getItem('contractData');
    if (cachedData) {
      try {
        const parsedData = JSON.parse(cachedData);
        if (parsedData.tradingPair) {
          const formattedSymbol = parsedData.tradingPair.replace('/', '-');
          setEffectiveChartSymbol(formattedSymbol);
        }
      } catch (error) {
        console.error("Error parsing cached contract data:", error);
      }
    }

    setTimeout(() => {
      initialLoadRef.current = false;
      setIsLoadingChart(false);
    }, 500);
  }, []);

  useEffect(() => {
    if (chartSymbol) {
      setEffectiveChartSymbol(chartSymbol);
    }
  }, [chartSymbol]);

  // Update current time at regular intervals for real-time position tracking
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(Math.floor(Date.now() / 1000));
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };

    animationFrameRef.current = requestAnimationFrame(updateTime);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  /**
   * Process and filter position history data based on current time
   * Creates a smooth visualization of position changes over time
   */
  useEffect(() => {
    if (!positionHistory || !biddingStartTime || !maturityTime) {
      return;
    }

    const throttledUpdate = () => {
      if (positionHistory.length > 0) {
        // Filter position history to only show data up to current time
        positionHistoryRef.current = positionHistory.filter(point =>
          point.timestamp <= currentTime
        );
      }

      // Generate enhanced data with interpolated points for smoother charts
      const enhancedData = generateEnhancedPositionData(
        positionHistoryRef.current,
        biddingStartTime,
        maturityTime,
        currentTime,
        positions
      );

      setEnhancedPositionData(enhancedData);
    };

    throttledUpdate();

    // Update position visualization every 500ms
    intervalRef.current = setInterval(throttledUpdate, 500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [positionHistory, biddingStartTime, maturityTime, currentTime, positions]);

  /**
   * Optimize price chart data by filtering to relevant time period
   * Only shows the last week of data for better visualization
   */
  const optimizedPriceData = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];

    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Filter to last week and sort chronologically
    let filteredData = chartData.filter(item => item.time >= oneWeekAgo);
    filteredData.sort((a, b) => a.time - b.time);

    return filteredData;
  }, [chartData]);

  /**
   * Prepare position history data for rendering
   * Ensures data is properly sorted by timestamp
   */
  const optimizedPositionData = useMemo(() => {
    if (!positionHistory || positionHistory.length === 0) return [];

    let filteredData = [...positionHistory];
    filteredData.sort((a, b) => a.timestamp - b.timestamp);

    return filteredData;
  }, [positionHistory]);

  /**
   * Generate tick marks for price chart x-axis
   * Creates evenly spaced ticks for the last 7 days
   */
  const getPriceChartTicks = () => {
    const today = new Date();
    const ticks = [];

    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      ticks.push(date.getTime());
    }

    return ticks;
  };

  /**
   * Generate tick marks for position chart x-axis
   * Distributes ticks evenly between bidding start and maturity time
   */
  const getPositionChartTicks = () => {
    if (!biddingStartTime || !maturityTime) return [];

    // Calculate time interval between ticks
    const duration = maturityTime - biddingStartTime;
    const interval = Math.max(Math.floor(duration / 5), 1);

    const ticks = [];
    ticks.push(biddingStartTime);

    // Add intermediate ticks
    let current = biddingStartTime + interval;
    while (current < maturityTime) {
      ticks.push(current);
      current += interval;
    }

    // Ensure maturity time is always included
    ticks.push(maturityTime);
    return ticks;
  };

  /**
   * Format price chart x-axis tick labels as dates
   */
  const formatPriceXAxisTick = (timestamp: number) => {
    return format(new Date(timestamp), 'dd/MM');
  };

  /**
   * Format position chart x-axis tick labels as date/time
   */
  const formatPositionXAxisTick = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return format(date, 'HH:mm dd/MM');
  };

  /**
   * Custom renderer for position chart data points
   * Highlights current position with special styling
   */
  const renderPositionDot = useCallback(({ cx, cy, payload, dataKey }: any) => {
    if (payload.isCurrentPoint) {
      const color = dataKey === 'longPercentage' ? '#00D7B5' : '#FF6384';
      const size = 6;

      return (
        <svg x={cx - size} y={cy - size} width={size * 2} height={size * 2}>
          <circle cx={size} cy={size} r={size} fill={color} />
          <circle cx={size} cy={size} r={size - 1} fill={color} stroke="#fff" strokeWidth={1} />
        </svg>
      );
    }

    return null;
  }, []);

  /**
   * Custom tooltip component for position chart
   * Shows timestamp and position percentages
   */
  const PositionChartTooltip = useCallback(({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const time = format(new Date(label * 1000), 'HH:mm:ss dd/MM/yyyy');
      const longPercentage = payload[0].value;
      const shortPercentage = payload[1].value;

      return (
        <Box bg="rgba(0,0,0,0.8)" p={2} borderRadius="md" boxShadow="md">
          <Text color="gray.300" fontSize="sm">{time}</Text>
          <HStack spacing={4} mt={1}>
            <HStack>
              <Box w={2} h={2} borderRadius="full" bg="#00D7B5" />
              <Text color="#00D7B5" fontWeight="bold">{`LONG: ${longPercentage}%`}</Text>
            </HStack>
            <HStack>
              <Box w={2} h={2} borderRadius="full" bg="#FF6384" />
              <Text color="#FF6384" fontWeight="bold">{`SHORT: ${shortPercentage}%`}</Text>
            </HStack>
          </HStack>
        </Box>
      );
    }

    return null;
  }, []);

  /**
   * Handle mouse movement over chart to update hover data
   */
  const handleMouseMove = (e: any) => {
    if (e && e.activePayload && e.activePayload.length) {
      setHoverData(e.activePayload[0].payload);
    }
  };

  /**
   * Reset hover data when mouse leaves chart area
   */
  const handleMouseLeave = () => {
    setHoverData(null);
  };

  /**
   * Render additional information for the hovered data point
   * Shows price difference from strike price
   */
  const renderHoverInfo = () => {
    if (!hoverData) return null;

    const date = new Date(hoverData.time);

    const percentDiff = strikePrice > 0
      ? ((hoverData.close - strikePrice) / strikePrice * 100).toFixed(2)
      : 0;

    const diffString = strikePrice > 0
      ? `(${hoverData.close > strikePrice ? '+' : ''}${percentDiff}%)`
      : '';

  };

  const generateEnhancedPositionData = useCallback((
    originalData: PositionPoint[],
    biddingStart: number,
    maturityEnd: number,
    current: number,
    currentPositions: Position
  ): PositionPoint[] => {
    if (current < biddingStart) {
      return [{
        timestamp: biddingStart,
        longPercentage: 50,
        shortPercentage: 50,
        isMainPoint: false
      }];
    }

    let result: PositionPoint[] = [];

    result.push({
      timestamp: biddingStart,
      longPercentage: 50,
      shortPercentage: 50,
      isMainPoint: false
    });

    if (originalData && originalData.length > 0) {
      const filteredPoints = originalData
        .filter(point => Math.abs(point.timestamp - biddingStart) > 10)
        .map(point => ({
          ...point,
          isMainPoint: false,
          isCurrentPoint: false
        }));

      result = [...result, ...filteredPoints];
    }

    let currentLongPercentage = 50;
    let currentShortPercentage = 50;

    if (currentPositions && (currentPositions.long > 0 || currentPositions.short > 0)) {
      const total = currentPositions.long + currentPositions.short;
      currentLongPercentage = total > 0 ? Math.round((currentPositions.long / total) * 100) : 50;
      currentShortPercentage = total > 0 ? Math.round((currentPositions.short / total) * 100) : 50;
    }

    if (current > biddingStart && current <= maturityEnd) {
      result.push({
        timestamp: current,
        longPercentage: currentLongPercentage,
        shortPercentage: currentShortPercentage,
        isMainPoint: true,
        isCurrentPoint: true
      });
    }

    result.sort((a, b) => a.timestamp - b.timestamp);

    return result;
  }, []);

  const renderPositionChart = () => {
    let longPercentage = 50;
    let shortPercentage = 50;

    if (positions && (positions.long > 0 || positions.short > 0)) {
      const total = positions.long + positions.short;
      longPercentage = total > 0 ? Math.round((positions.long / total) * 100) : 50;
      shortPercentage = total > 0 ? Math.round((positions.short / total) * 100) : 50;
    }

    return (
      <Box p={4} bg="##0A0B0E" borderRadius="md" boxShadow="lg">
        <Flex justify="space-between" mb={4}>
          <Text fontSize="xl" fontWeight="bold" color="white">Position Chart</Text>
          <HStack spacing={6}>
            <HStack spacing={1}>
              <Box w={3} h={3} borderRadius="full" bg="#00D7B5" />
              <Text color="#00D7B5" fontWeight="bold">LONG: {longPercentage}%</Text>
            </HStack>
            <HStack spacing={1}>
              <Box w={3} h={3} borderRadius="full" bg="#FF6384" />
              <Text color="#FF6384" fontWeight="bold">SHORT: {shortPercentage}%</Text>
            </HStack>
          </HStack>
        </Flex>

        {enhancedPositionData.length === 0 ? (
          <Flex height="300px" justify="center" align="center" color="gray.500">
            <Text>No position data available</Text>
          </Flex>
        ) : (
          <ResponsiveContainer width="100%" height={500}>
            <LineChart
              data={enhancedPositionData}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />

              <XAxis
                dataKey="timestamp"
                tickFormatter={formatPositionXAxisTick}
                ticks={getPositionChartTicks()}
                domain={[biddingStartTime, maturityTime]}
                type="number"
                tick={{ fill: '#999', fontSize: 12 }}
                axisLine={{ stroke: '#333' }}
              />

              <YAxis
                domain={[0, 100]}
                tickCount={5}
                tickFormatter={(value) => `${value}%`}
                tick={{ fill: '#999', fontSize: 12 }}
                axisLine={{ stroke: '#333' }}
              />

              <Tooltip content={<PositionChartTooltip />} />

              <Line
                type="monotone"
                dataKey="longPercentage"
                stroke="#00D7B5"
                strokeWidth={2}
                dot={renderPositionDot}
                activeDot={{ r: 8, stroke: '#00D7B5', strokeWidth: 2, fill: '#00D7B5' }}
                isAnimationActive={false}
                name="LONG"
              />

              <Line
                type="monotone"
                dataKey="shortPercentage"
                stroke="#FF6384"
                strokeWidth={2}
                dot={renderPositionDot}
                activeDot={{ r: 8, stroke: '#FF6384', strokeWidth: 2, fill: '#FF6384' }}
                isAnimationActive={false}
                name="SHORT"
              />
              
              
            </LineChart>
          </ResponsiveContainer>
        )}
      </Box>
    );
  }

  useEffect(() => {
    if (optimizedPriceData.length > 1) {
      const currentPrice = optimizedPriceData[optimizedPriceData.length - 1].close;
      const previousPrice = optimizedPriceData[optimizedPriceData.length - 2].close;
      const difference = (hoverData?.close - strikePrice);
      setDiffString(`${difference.toFixed(2)} USD`);
      setPercentDiff(difference / strikePrice * 100);
    }
  }, [hoverData]);

  /**
   * Update percentage difference when price data or strike price changes
   */
  useEffect(() => {
    if (optimizedPriceData.length > 0 && strikePrice > 0) {
        const currentPrice = optimizedPriceData[optimizedPriceData.length - 1].close;
        const difference = currentPrice - strikePrice;
        const percentageDifference = (difference / strikePrice) * 100;
        setPercentDiff(percentageDifference);
    }
  }, [optimizedPriceData, strikePrice]);

  // Ensure strike price is properly formatted for display
  // Convert from string or large integer to decimal value if needed
  const displayStrikePrice = typeof strikePrice === 'string' 
    ? parseFloat(strikePrice) 
    : typeof strikePrice === 'number' 
      ? strikePrice 
      : parseFloat(strikePrice.toString()) / STRIKE_PRICE_MULTIPLIER;

  // Render price chart if chartType is 'price'
  if (chartType === 'price') {
    // const lineColor = strikePrice > 0 && optimizedPriceData.length > 0 && optimizedPriceData[optimizedPriceData.length - 1]?.close > strikePrice ? "#FF6384" : "#00D7B5";
    const lineColor = "#3ABEFF";
    return (
      <Box p={4} bg="#0A0B0E" borderRadius="md" boxShadow="lg">
        {/* Price display and statistics header */}
        <Flex justify="space-between" align="center" mb={4} direction="column">
          <Flex w="100%" justify="space-between" align="center" mb={2}>
            <VStack align="flex-start" fontSize="xl">
              <Text color="white" fontSize="4xl" fontWeight="bold">
                ${hoverData?.close ? hoverData.close.toFixed(2) : '0.00'}
              </Text>
              <Text 
                color={percentDiff >= 0 ? "#00D7B5" : "#FF6384"} 
                fontSize="lg"
              >
                {diffString} ({percentDiff >= 0 ? "+" : ""}{percentDiff.toFixed(2)}%)
              </Text>
            </VStack>

            <Flex justify="space-between" align="center">
              {!isLoadingChart && optimizedPriceData.length > 0 ? (
                // Platform branding/logo
                <Text 
                    fontSize="5xl" 
                    fontWeight="bold" 
                    bgGradient="linear(to-r, #4a63c8, #5a73d8, #6a83e8)" 
                    bgClip="text"
                    letterSpacing="wider"
                    textShadow="0 0 10px rgba(74, 99, 200, 0.7), 0 0 20px rgba(74, 99, 200, 0.5)"
                    fontFamily="'Orbitron', sans-serif"
                  >
                    OREKA
                  </Text>
              ) : (
                <Skeleton height="32px" width="120px" />
              )}
            </Flex>
          </Flex>

          <Box w="100%" h="24px">
            {renderHoverInfo()}
          </Box>
        </Flex>

        {/* Loading skeleton or actual chart */}
        {isLoadingChart && initialLoadRef.current ? (
          <Flex
            justify="center"
            align="center"
            height="400px"
            width="100%"
            direction="column"
          >
            <Skeleton height="500px" width="100%" borderRadius="md" />
          </Flex>
        ) : (
          <ResponsiveContainer width="100%" height={409}>
            <LineChart
              data={optimizedPriceData}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              {/* Background grid lines */}
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />

              {/* X-axis configuration */}
              <XAxis
                dataKey="time"
                type="number"
                domain={['dataMin', 'dataMax']}
                ticks={getPriceChartTicks()}
                tickFormatter={formatPriceXAxisTick}
                stroke="#666"
                tick={{ fill: 'white', fontSize: 15 }}
                axisLine={{ stroke: '#333' }}
              />

              {/* Y-axis configuration */}
              <YAxis
                domain={['auto', 'auto']}
                stroke="#666"
                tick={{ fill: 'white', fontSize: 15 }}
                axisLine={{ stroke: '#333' }}
              />

              {/* Price data line */}
              <Line
                type="monotone"
                dataKey="close"
                stroke={lineColor}
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
                activeDot={{ r: 6, stroke: lineColor, strokeWidth: 2, fill: lineColor }}
              />

              {/* Strike price reference line */}
              {strikePrice > 0 && (
                <ReferenceLine
                  y={displayStrikePrice}
                  stroke="#FEDF56"
                  strokeDasharray="3 3"
                  label={{
                    value: `${displayStrikePrice}`,
                    position: 'left',
                    fill: '#FEDF56',
                    fontSize: 12
                  }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </Box>
    );
  } else {
    // Render position distribution chart if chartType is not 'price'
    return renderPositionChart();
  }
};

export default MarketCharts; 