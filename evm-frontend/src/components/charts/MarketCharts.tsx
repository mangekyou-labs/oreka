import React, { useEffect, useState } from 'react';
import { Box, Tabs, TabList, TabPanels, Tab, TabPanel, HStack, Button, Text } from '@chakra-ui/react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from 'recharts';
import { PriceService } from '../../services/PriceService';

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
  timeRange = '1w',
  chartType = 'price',
  onTimeRangeChange,
  options = { showPrice: true, showPositions: true },
  chartSymbol,
  biddingStartTime,
  maturityTime
}) => {
  const [chartDataState, setChartData] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const fetchPriceHistory = async () => {
      try {
        if (!chartSymbol) {
          console.warn("No chartSymbol provided to MarketCharts");
          return;
        }

        const priceService = PriceService.getInstance();
        const klines = await priceService.fetchKlines(chartSymbol, '1m', 100, timeRange);
        setChartData(klines);
      } catch (error) {
        console.error("Error fetching price history:", error);
      }
    };

    fetchPriceHistory();
    const interval = setInterval(fetchPriceHistory, 60000);
    return () => clearInterval(interval);
  }, [chartSymbol, timeRange]);

  // Cập nhật thời gian hiện tại mỗi giây
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter data based on time range
  const getFilteredData = (data: any[], range: string) => {
    if (!data || data.length === 0) return [];

    const now = Date.now();
    let filterTime: number;

    switch (range) {
      case '1d':
        filterTime = now - 24 * 60 * 60 * 1000; // 1 day
        break;
      case '1w':
        filterTime = now - 7 * 24 * 60 * 60 * 1000; // 1 week
        break;
      case '1m':
        filterTime = now - 30 * 24 * 60 * 60 * 1000; // 1 month
        break;
      case 'all':
      default:
        return data;
    }

    return data.filter(item => item.time > filterTime || item.timestamp > filterTime / 1000);
  };

  const filteredChartData = getFilteredData(chartDataState, timeRange);
  const filteredPositionHistory = getFilteredData(positionHistory, timeRange);

  // Cải thiện hàm tạo mốc thời gian cố định
  const getFixedPositionTicks = () => {
    if (!biddingStartTime || !maturityTime) return [];

    const ticks = [];
    const timeRange = maturityTime - biddingStartTime;
    const interval = timeRange / 8;

    for (let i = 0; i <= 8; i++) {
      ticks.push(biddingStartTime + Math.floor(interval * i));
    }

    return ticks;
  };

  // Cải thiện hàm định dạng thời gian
  const formatXAxisTick = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return `${date.toLocaleString('default', { month: 'short' })} ${date.getDate()}`;
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const timestamp = new Date(label * 1000);
      const longValue = payload.find((p: any) => p.dataKey === 'longPercentage')?.value;
      const shortValue = payload.find((p: any) => p.dataKey === 'shortPercentage')?.value;

      return (
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: '10px',
          border: '1px solid #FEDF56',
          borderRadius: '4px',
          color: '#FEDF56'
        }}>
          <p>{timestamp.toLocaleString()}</p>
          <p style={{ color: '#00D7B5' }}>LONG: {longValue ? `${longValue.toFixed(2)}%` : '-'}</p>
          <p style={{ color: '#FF6384' }}>SHORT: {shortValue ? `${shortValue.toFixed(2)}%` : '-'}</p>
        </div>
      );
    }
    return null;
  };

  if (chartType === 'price') {
    return (
      <Box h="520px" border="1px solid #2D3748" borderRadius="xl" p={4}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filteredChartData}>
            <CartesianGrid strokeDasharray="2 2" stroke="#333" />
            <XAxis
              dataKey="time"
              tickFormatter={(time) => new Date(time).toLocaleTimeString()}
              stroke="#F0FFFF"
              tick={{ fontSize: 12 }}
              ticks={getFixedPositionTicks()} // Chỉ hiển thị 8 cột mốc thời gian
            />
            <YAxis domain={['auto', 'auto']} stroke="#F0FFFF" />
            {strikePrice && (
              <ReferenceLine
                y={strikePrice}
                stroke="#FEDF56"
                strokeDasharray="2 2"
                label={{
                  value: `Strike: ${strikePrice}`,
                  position: 'right',
                  fill: '#FEDF56'
                }}
              />
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: '#000',
                border: '1px solid #FEDF56',
                color: '#FF7F50'
              }}
              formatter={(value: number) => [`${value.toFixed(2)} USD`, 'Price']}
              labelFormatter={(time) => new Date(time).toLocaleString()}
            />
            <Line
              type="monotone"
              dataKey="close"
              stroke="#FF7F50"
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    );
  } else {
    // Tạo dữ liệu hiện tại để hiển thị theo thời gian thực
    const createCurrentTimeData = () => {
      // Đảm bảo có dữ liệu đầu tiên tại biddingStartTime
      const initialData: PositionPoint[] = [{
        timestamp: biddingStartTime,
        longPercentage: 50,
        shortPercentage: 50,
        isMainPoint: true
      }];

      // Lọc dữ liệu position history đến thời điểm hiện tại
      let filteredData = positionHistory
        .filter(p =>
          p.longPercentage !== null &&
          p.shortPercentage !== null &&
          p.timestamp <= currentTime
        )
        .sort((a, b) => a.timestamp - b.timestamp);

      // Nếu không có dữ liệu nào, chỉ sử dụng điểm ban đầu
      if (filteredData.length === 0) {
        return initialData;
      }

      // Nếu không có điểm đầu tiên tại biddingStartTime, thêm vào
      if (filteredData[0].timestamp > biddingStartTime) {
        filteredData = [...initialData, ...filteredData];
      }

      // Thêm điểm hiện tại nếu chưa có
      const lastPoint = filteredData[filteredData.length - 1];
      if (currentTime > lastPoint.timestamp && currentTime < maturityTime) {
        const total = positions.long + positions.short;
        const longPercentage = total > 0 ? (positions.long / total) * 100 : 50;
        const shortPercentage = total > 0 ? (positions.short / total) * 100 : 50;

        filteredData.push({
          timestamp: currentTime,
          longPercentage,
          shortPercentage,
          isMainPoint: true,
          isCurrentPoint: true
        });
      }

      return filteredData;
    };

    // Lấy dữ liệu hiện tại cho biểu đồ
    const currentPositionData = createCurrentTimeData();

    // Lấy các mốc thời gian cố định
    const fixedTicks = getFixedPositionTicks();

    // Render custom dots cho line
    const renderDot = (props: any) => {
      const { cx, cy, payload } = props;
      const dotColor = payload.dataKey === 'longPercentage' ? '#00D7B5' : '#FF6384'; // Màu tương ứng với đường
      if (payload.isCurrentPoint) {
        return (
          <circle cx={cx} cy={cy} r={8} stroke={dotColor} strokeWidth={2} fill={dotColor} />
        );
      }
      return null;
    };

    return (
      <Box h="520px" border="1px solid #2D3748" borderRadius="xl" p={4} width="100%">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={currentPositionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={[biddingStartTime, maturityTime]}
              ticks={fixedTicks}
              scale="time"
              tickFormatter={formatXAxisTick}
              stroke="rgba(254, 223, 86, 0.7)"
              tick={{ fill: 'rgba(254, 223, 86, 0.7)', fontSize: 12 }}
              axisLine={{ stroke: '#333' }}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(value) => `${value.toFixed(1)}%`}
              stroke="rgba(254, 223, 86, 0.7)"
              tick={{ fill: 'rgba(254, 223, 86, 0.7)', fontSize: 12 }}
              axisLine={{ stroke: '#333' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value, entry) => {
                const totalEth = value === "LONG" ? positions.long : positions.short;
                return `${value} (${totalEth.toFixed(4)} ETH)`;
              }}
              wrapperStyle={{
                color: "#FEDF56",
                opacity: 0.8,
                fontSize: '12px'
              }}
            />
            <ReferenceLine y={50} stroke="#FEDF56" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="longPercentage"
              stroke="#00D7B5"
              name="LONG"
              strokeWidth={2}
              dot={renderDot}
              activeDot={{ r: 6, stroke: '#00D7B5', strokeWidth: 2, fill: '#00D7B5' }}
              connectNulls={true}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="shortPercentage"
              stroke="#FF6384"
              name="SHORT"
              strokeWidth={2}
              dot={renderDot}
              activeDot={{ r: 6, stroke: '#FF6384', strokeWidth: 2, fill: '#FF6384' }}
              connectNulls={true}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    );
  }
};

export default MarketCharts; 