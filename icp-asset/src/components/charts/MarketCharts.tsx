import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Box, Tabs, TabList, TabPanels, Tab, TabPanel, HStack, Button, Text, ButtonGroup, Flex, Skeleton, Tooltip as ChakraTooltip } from '@chakra-ui/react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine, AreaChart, Area } from 'recharts';
import { PriceService } from '../../service/price-service';
import { format, subDays } from 'date-fns';

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
    chartData?: any[];
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
 */
const MarketCharts: React.FC<MarketChartsProps> = ({
    chartData = [],
    positionHistory,
    positions,
    strikePrice = 0,
    chartType = 'price',
    options = { showPrice: true, showPositions: true },
    chartSymbol = 'ETH-USD',
    biddingStartTime,
    maturityTime
}) => {
    const [currentTime, setCurrentTime] = useState<number>(Math.floor(Date.now() / 1000));
    const [isLoadingChart, setIsLoadingChart] = useState<boolean>(true);
    const [localChartData, setLocalChartData] = useState<any[]>([]);
    const [effectiveChartSymbol, setEffectiveChartSymbol] = useState<string>(chartSymbol || 'ETH-USD');
    const [hoverData, setHoverData] = useState<any>(null);
    const [enhancedPositionData, setEnhancedPositionData] = useState<PositionPoint[]>([]);
    const initialLoadRef = useRef<boolean>(true);
    const priceServiceRef = useRef(PriceService.getInstance());
    const positionHistoryRef = useRef<PositionPoint[]>([]);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Set default bidding start time if not provided
    const effectiveBiddingStartTime = useMemo(() => {
        if (!biddingStartTime || biddingStartTime <= 0) {
            // Default to 24 hours ago if not provided
            console.log("Using default bidding start time");
            return Math.floor(Date.now() / 1000) - 86400;
        }
        console.log("Using actual bidding start time:", biddingStartTime);
        return biddingStartTime;
    }, [biddingStartTime]);

    // Set default maturity time if not provided
    const effectiveMaturityTime = useMemo(() => {
        if (!maturityTime || maturityTime <= 0) {
            // Default to 24 hours from now if not provided
            console.log("Using default maturity time");
            return Math.floor(Date.now() / 1000) + 86400;
        }
        console.log("Using actual maturity time:", maturityTime);
        return maturityTime;
    }, [maturityTime]);

    // Initialize chart data
    useEffect(() => {
        const loadChartData = async () => {
            try {
                if (chartType === 'price' && effectiveChartSymbol) {
                    const service = priceServiceRef.current;
                    const data = await service.fetchKlines(effectiveChartSymbol, '1d', 30);
                    setLocalChartData(data);
                }
            } catch (error) {
                console.error("Error loading chart data:", error);
            } finally {
                setIsLoadingChart(false);
            }
        };

        loadChartData();

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [chartType, effectiveChartSymbol]);

    // Effect to update current time at regular intervals for real-time position tracking
    useEffect(() => {
        const updateTime = () => {
            const now = Math.floor(Date.now() / 1000);
            if (now <= effectiveMaturityTime) {
                setCurrentTime(now);
                animationFrameRef.current = requestAnimationFrame(updateTime);
            }
        };

        animationFrameRef.current = requestAnimationFrame(updateTime);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [effectiveMaturityTime]);

    // Process and filter position history data based on current time
    useEffect(() => {
        if (!positionHistory || !effectiveBiddingStartTime || !effectiveMaturityTime) {
            return;
        }

        // Throttled update function to prevent excessive re-renders
        const throttledUpdate = () => {
            if (positionHistory.length > 0) {
                console.log("Position history from props:", positionHistory.length, "points");
                // Filter position history to only show data up to current time
                positionHistoryRef.current = positionHistory.filter(point =>
                    point.timestamp <= currentTime
                );
                console.log("Filtered to", positionHistoryRef.current.length, "points up to current time");
            } else {
                console.log("No position history data available from props");
                positionHistoryRef.current = [];
            }

            // Generate enhanced data with interpolated points for smoother charts
            const enhancedData = generateEnhancedPositionData(
                positionHistoryRef.current,
                effectiveBiddingStartTime,
                effectiveMaturityTime,
                currentTime,
                positions
            );

            console.log("Enhanced data points generated:", enhancedData.length);
            console.log("First point:", enhancedData[0]);
            console.log("Last point:", enhancedData[enhancedData.length - 1]);

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
    }, [positionHistory, effectiveBiddingStartTime, effectiveMaturityTime, currentTime, positions]);

    // Update chart symbol if needed
    useEffect(() => {
        if (chartSymbol) {
            setEffectiveChartSymbol(chartSymbol);
        }
    }, [chartSymbol]);

    // Generate tick marks for price chart x-axis
    const getPriceChartTicks = () => {
        const today = new Date();
        const ticks = [];

        for (let i = 6; i >= 0; i--) {
            const date = subDays(today, i);
            ticks.push(date.getTime());
        }

        return ticks;
    };

    // Generate tick marks for position chart x-axis
    const getPositionChartTicks = () => {
        if (!effectiveBiddingStartTime || !effectiveMaturityTime) return [];

        // Calculate time interval between ticks
        const duration = effectiveMaturityTime - effectiveBiddingStartTime;
        const interval = Math.max(Math.floor(duration / 3), 1); // Use just 4 ticks (start, 2 middle points, end)
        const ticks = [];

        // Create more widely spaced ticks
        for (let i = 0; i <= 3; i++) {
            ticks.push(effectiveBiddingStartTime + (i * interval));
        }

        return ticks;
    };

    // Format price chart x-axis tick labels as dates
    const formatPriceXAxisTick = (timestamp: number) => {
        return format(new Date(timestamp), 'dd/MM');
    };

    // Format position chart x-axis tick labels as dates
    const formatPositionXAxisTick = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return format(date, 'HH:mm dd/MM');
    };

    // Generate enhanced position data for smoother chart visualization
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

        // Add initial point at bidding start
        result.push({
            timestamp: biddingStart,
            longPercentage: 50,
            shortPercentage: 50,
            isMainPoint: false
        });

        // Check if we have actual position history data
        if (originalData && originalData.length > 0) {
            console.log("Using actual position history data:", originalData.length, "points");

            // Process the original data points - ensure they're sorted by timestamp
            const sortedPoints = [...originalData].sort((a, b) => a.timestamp - b.timestamp);

            // Map the data points with proper formatting
            const processedPoints = sortedPoints.map(point => ({
                timestamp: point.timestamp,
                longPercentage: point.longPercentage,
                shortPercentage: point.shortPercentage,
                isMainPoint: true,
                isCurrentPoint: false
            }));

            // Add all history points to the result
            result = [...result, ...processedPoints];
        } else {
            // Create intermediate points for a more realistic chart when using fallback data
            console.log("No position history data, creating synthetic time points");

            // Calculate current percentages based on total positions
            let longPercentage = 50;
            let shortPercentage = 50;

            if (currentPositions && (currentPositions.long > 0 || currentPositions.short > 0)) {
                const total = currentPositions.long + currentPositions.short;
                longPercentage = total > 0 ? Math.round((currentPositions.long / total) * 100) : 50;
                shortPercentage = total > 0 ? Math.round((currentPositions.short / total) * 100) : 50;
            }

            // Calculate several intermediate points (creating a transition effect)
            const numPoints = 5; // Create 5 intermediate points
            const startTime = biddingStart;
            const endTime = current;
            const timeInterval = (endTime - startTime) / (numPoints + 1);

            // Create gradually changing percentages from 50/50 to current ratio
            for (let i = 1; i <= numPoints; i++) {
                const pointTime = startTime + timeInterval * i;
                // Linear interpolation between 50% and the current percentage
                const progressRatio = i / (numPoints + 1);
                const interpolatedLongPercentage = Math.round(50 + (longPercentage - 50) * progressRatio);
                const interpolatedShortPercentage = Math.round(50 + (shortPercentage - 50) * progressRatio);

                result.push({
                    timestamp: pointTime,
                    longPercentage: interpolatedLongPercentage,
                    shortPercentage: interpolatedShortPercentage,
                    isMainPoint: true
                });
            }
        }

        // Add current point with current percentages if not already represented in the history
        let currentLongPercentage = 50;
        let currentShortPercentage = 50;

        if (currentPositions && (currentPositions.long > 0 || currentPositions.short > 0)) {
            const total = currentPositions.long + currentPositions.short;
            currentLongPercentage = total > 0 ? Math.round((currentPositions.long / total) * 100) : 50;
            currentShortPercentage = total > 0 ? Math.round((currentPositions.short / total) * 100) : 50;
        }

        // Only add current point if the last timestamp in result is not near the current time
        const lastPoint = result[result.length - 1];
        const shouldAddCurrentPoint = !lastPoint || Math.abs(lastPoint.timestamp - current) > 60;

        if (shouldAddCurrentPoint && current > biddingStart && current <= maturityEnd) {
            result.push({
                timestamp: current,
                longPercentage: currentLongPercentage,
                shortPercentage: currentShortPercentage,
                isMainPoint: true,
                isCurrentPoint: true
            });
        }

        // Add projection point if needed
        if (current < maturityEnd) {
            result.push({
                timestamp: maturityEnd,
                longPercentage: currentLongPercentage,
                shortPercentage: currentShortPercentage,
                isMainPoint: true,
                isCurrentPoint: false
            });
        }

        // Sort the points by timestamp
        result.sort((a, b) => a.timestamp - b.timestamp);

        console.log("Generated", result.length, "enhanced position data points");
        return result;
    }, []);

    // Custom tooltip for price chart
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <Box
                    bg="gray.800"
                    p={2}
                    borderRadius="md"
                    border="1px solid"
                    borderColor="gray.700"
                >
                    <Text color="gray.200">
                        {format(new Date(label), 'MMM dd, yyyy HH:mm')}
                    </Text>
                    <Text color="#FEDF56" fontWeight="bold">
                        ${payload[0].value.toFixed(2)}
                    </Text>
                </Box>
            );
        }

        return null;
    };

    // Custom tooltip for position chart
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

    // Handle mouse movement over chart to update hover data
    const handleMouseMove = (e: any) => {
        if (e && e.activePayload && e.activePayload.length) {
            setHoverData(e.activePayload[0].payload);
        }
    };

    // Handle mouse leave from chart
    const handleMouseLeave = () => {
        setHoverData(null);
    };

    // Custom dot renderer for position chart
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

    // Optimize price chart data
    const optimizedPriceData = useMemo(() => {
        if (localChartData.length === 0) return [];

        return localChartData.sort((a, b) => a.time - b.time);
    }, [localChartData]);

    // Render price chart
    const renderPriceChart = () => {
        return (
            <Box height="350px" position="relative">
                {isLoadingChart ? (
                    <Skeleton height="100%" width="100%" borderRadius="md" />
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={optimizedPriceData}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={handleMouseLeave}
                        >
                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                            <XAxis
                                dataKey="time"
                                domain={['auto', 'auto']}
                                name="Time"
                                tickFormatter={formatPriceXAxisTick}
                                ticks={getPriceChartTicks()}
                                type="number"
                                stroke="#666"
                            />
                            <YAxis
                                domain={['auto', 'auto']}
                                tickFormatter={(value) => `$${value.toFixed(0)}`}
                                stroke="#666"
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <ReferenceLine
                                y={strikePrice}
                                stroke="#FEDF56"
                                strokeDasharray="3 3"
                                label={{
                                    value: `Strike: $${strikePrice}`,
                                    fill: '#FEDF56',
                                    fontSize: 12,
                                    position: 'right'
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="close"
                                stroke="#00ff87"
                                strokeWidth={2}
                                dot={false}
                                animationDuration={500}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </Box>
        );
    };

    // Render position chart
    const renderPositionChart = () => {
        let longPercentage = 50;
        let shortPercentage = 50;

        if (positions && (positions.long > 0 || positions.short > 0)) {
            const total = positions.long + positions.short;
            longPercentage = total > 0 ? Math.round((positions.long / total) * 100) : 50;
            shortPercentage = total > 0 ? Math.round((positions.short / total) * 100) : 50;
        }

        return (
            <Box height="350px" position="relative">
                {enhancedPositionData.length === 0 ? (
                    <Flex
                        height="100%"
                        alignItems="center"
                        justifyContent="center"
                        bg="gray.800"
                        borderRadius="md"
                        color="gray.400"
                    >
                        <Text>Position data not available</Text>
                    </Flex>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={enhancedPositionData}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={handleMouseLeave}
                        >
                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                            <XAxis
                                dataKey="timestamp"
                                domain={[effectiveBiddingStartTime, effectiveMaturityTime]}
                                name="Time"
                                tickFormatter={formatPositionXAxisTick}
                                ticks={getPositionChartTicks()}
                                type="number"
                                stroke="#666"
                            />
                            <YAxis
                                domain={[0, 100]}
                                tickCount={5}
                                tickFormatter={(value) => `${value}%`}
                                stroke="#666"
                            />
                            <Tooltip content={<PositionChartTooltip />} />
                            <Line
                                type="monotone"
                                dataKey="longPercentage"
                                stroke="#00D7B5"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 6, stroke: '#00D7B5', strokeWidth: 2 }}
                                name="LONG"
                            />
                            <Line
                                type="monotone"
                                dataKey="shortPercentage"
                                stroke="#FF6384"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 6, stroke: '#FF6384', strokeWidth: 2 }}
                                name="SHORT"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </Box>
        );
    };

    // Main render
    return (
        <Box
            bg="gray.800"
            p={4}
            borderRadius="xl"
            borderWidth={1}
            borderColor="gray.700"
            position="relative"
        >
            {/* Debug overlay for position data */}
            {chartType === 'position' && (
                <Box
                    position="absolute"
                    top="5px"
                    right="5px"
                    zIndex={10}
                    bg="rgba(0,0,0,0.7)"
                    p={2}
                    borderRadius="md"
                    border="1px solid"
                    borderColor="gray.600"
                    fontSize="xs"
                    color="white"
                    maxWidth="300px"
                    maxHeight="100px"
                    overflow="auto"
                    display="block" // Make visible for debugging
                >
                    <Text fontWeight="bold" mb={1}>Position History Data:</Text>
                    <Text>{positionHistory.length} original points, {enhancedPositionData.length} enhanced points</Text>
                    <Text>Current Long: {positions.long}, Short: {positions.short}</Text>
                </Box>
            )}

            {chartType === 'price' ? renderPriceChart() : renderPositionChart()}
        </Box>
    );
};

export default MarketCharts; 