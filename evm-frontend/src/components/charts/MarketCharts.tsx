import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Box, Tabs, TabList, TabPanels, Tab, TabPanel, HStack, Button, Text, ButtonGroup, Flex, Skeleton, Tooltip as ChakraTooltip, VStack } from '@chakra-ui/react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine, Area, AreaChart } from 'recharts';
import { PriceService } from '../../services/PriceService';
import { format, addDays, subDays } from 'date-fns';


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
  const [chartDataState, setChartData] = useState<any[]>([]);
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

  useEffect(() => {
    if (!positionHistory || !biddingStartTime || !maturityTime) {
      return;
    }

    const throttledUpdate = () => {
      if (positionHistory.length > 0) {
        positionHistoryRef.current = positionHistory.filter(point =>
          point.timestamp <= currentTime
        );
      }

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

    intervalRef.current = setInterval(throttledUpdate, 500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [positionHistory, biddingStartTime, maturityTime, currentTime, positions]);

  const optimizedPriceData = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];

    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    let filteredData = chartData.filter(item => item.time >= oneWeekAgo);

    filteredData.sort((a, b) => a.time - b.time);

    return filteredData;
  }, [chartData]);

  const optimizedPositionData = useMemo(() => {
    if (!positionHistory || positionHistory.length === 0) return [];

    let filteredData = [...positionHistory];

    filteredData.sort((a, b) => a.timestamp - b.timestamp);

    return filteredData;
  }, [positionHistory]);

  const getPriceChartTicks = () => {
    const today = new Date();
    const ticks = [];

    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      ticks.push(date.getTime());
    }

    return ticks;
  };

  const getPositionChartTicks = () => {
    if (!biddingStartTime || !maturityTime) return [];

    const duration = maturityTime - biddingStartTime;
    const interval = Math.max(Math.floor(duration / 5), 1);

    const ticks = [];
    ticks.push(biddingStartTime);

    let current = biddingStartTime + interval;
    while (current < maturityTime) {
      ticks.push(current);
      current += interval;
    }

    ticks.push(maturityTime);
    return ticks;
  };

  const formatPriceXAxisTick = (timestamp: number) => {
    return format(new Date(timestamp), 'dd/MM');
  };

  const formatPositionXAxisTick = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return format(date, 'HH:mm dd/MM');
  };

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

  const handleMouseMove = (e: any) => {
    if (e && e.activePayload && e.activePayload.length) {
      setHoverData(e.activePayload[0].payload);
    }
  };

  const handleMouseLeave = () => {
    setHoverData(null);
  };

  const renderHoverInfo = () => {
    if (!hoverData) return null;

    const date = new Date(hoverData.time);

    const percentDiff = strikePrice > 0
      ? ((hoverData.close - strikePrice) / strikePrice * 100).toFixed(2)
      : 0;

    const diffString = strikePrice > 0
      ? `(${hoverData.close > strikePrice ? '+' : ''}${percentDiff}%)`
      : '';

    // return (
    //   <VStack align="flex-start">
    //     <Text color="white" fontSize="lg">
    //       {/* {format(date, 'dd MMM yyyy HH:mm')} - Price: ${hoverData.close.toFixed(2)} {diffString} */}
    //       ${hoverData.close.toFixed(2)}

    //     </Text>
    //     <Text color="white" fontSize="sm">
    //       {diffString}
    //     </Text>
    //   </VStack>
    // );
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
      const difference = Math.abs(hoverData?.close - strikePrice);
      setDiffString(`${difference.toFixed(2)} USD`);
      setPercentDiff(difference / strikePrice * 100);
    }
  }, [hoverData]);

  useEffect(() => {
    if (optimizedPriceData.length > 0 && strikePrice > 0) {
        const currentPrice = optimizedPriceData[optimizedPriceData.length - 1].close;
        const difference = currentPrice - strikePrice;
        const percentageDifference = (difference / strikePrice) * 100;
        setPercentDiff(percentageDifference);
    }
  }, [optimizedPriceData, strikePrice]);

  if (chartType === 'price') {
    const lineColor = strikePrice > 0 && optimizedPriceData.length > 0 && optimizedPriceData[optimizedPriceData.length - 1]?.close > strikePrice ? "#FF8C00" : "#FF6384";

    return (
      <Box p={4} bg="#0A0B0E" borderRadius="md" boxShadow="lg">
        <Flex justify="space-between" align="center" mb={4} direction="column">
          <Flex w="100%" justify="space-between" align="center" mb={2}>
            <VStack align="flex-start" fontSize="xl">
              <Text color="white" fontSize="4xl">
                ${hoverData?.close ? hoverData.close.toFixed(2) : '0.00'}
              </Text>
              <Text color="white" fontSize="lg">
                {diffString} ({percentDiff.toFixed(2)}%)
              </Text>
            </VStack>

            <Flex justify="space-between" align="center">
              {!isLoadingChart && optimizedPriceData.length > 0 ? (
                <Text fontSize="2xl" fontWeight="bold" color={lineColor}>
                  ${optimizedPriceData[optimizedPriceData.length - 1]?.close.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
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
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />

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

              <YAxis
                domain={['auto', 'auto']}
                stroke="#666"
                tick={{ fill: 'white', fontSize: 15 }}
                axisLine={{ stroke: '#333' }}
              />

              <Line
                type="monotone"
                dataKey="close"
                stroke={lineColor}
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
                activeDot={{ r: 6, stroke: lineColor, strokeWidth: 2, fill: lineColor }}
              />

              {strikePrice > 0 && (
                <ReferenceLine
                  y={strikePrice}
                  stroke="#FEDF56"
                  strokeDasharray="3 3"
                  label={{
                    value: `${strikePrice}`,
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
    return renderPositionChart();
  }
};

export default MarketCharts; 