import React from 'react';
import { Box, Tabs, TabList, TabPanels, Tab, TabPanel } from '@chakra-ui/react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface Position {
  long: number;
  short: number;
}

interface PositionPoint {
  timestamp: number;
  longPercentage: number | null;
  shortPercentage: number | null;
  isMainPoint?: boolean;
}

interface MarketChartsProps {
  chartData: any[];
  positionHistory: PositionPoint[];
  positions: Position;
}

const MarketCharts: React.FC<MarketChartsProps> = ({ chartData, positionHistory, positions }) => {
  return (
    <Tabs variant="line" colorScheme="yellow" mb={6}>
      <TabList borderBottom="1px solid #2D3748">
        <Tab color="#FEDF56" _selected={{ color: "#FEDF56", borderColor: "#FEDF56" }}>
          Price Chart
        </Tab>
        <Tab color="#FEDF56" _selected={{ color: "#FEDF56", borderColor: "#FEDF56" }}>
          Position Chart
        </Tab>
      </TabList>
      <TabPanels>
        {/* Price Chart */}
        <TabPanel p={0} pt={4}>
          <Box h="400px" border="1px solid #2D3748" borderRadius="xl" p={4}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis 
                  dataKey="time" 
                  tickFormatter={(time) => new Date(time).toLocaleTimeString()}
                  stroke="#FEDF56"
                />
                <YAxis domain={['auto', 'auto']} stroke="#FEDF56" />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: '#000', 
                    border: '1px solid #FEDF56',
                    color: '#FEDF56'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="close" 
                  stroke="#FEDF56" 
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </TabPanel>

        {/* Position Chart */}
        <TabPanel p={0} pt={4}>
          <Box h="400px" border="1px solid #2D3748" borderRadius="xl" p={4}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={positionHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis 
                  dataKey="timestamp"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  ticks={positionHistory.filter(p => p.isMainPoint).map(p => p.timestamp)}
                  tickFormatter={(timestamp) => {
                    const date = new Date(timestamp * 1000);
                    return `${date.getHours()}:${date.getMinutes()}`;
                  }}
                  stroke="#FEDF56"
                />
                <YAxis 
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  stroke="#FEDF56"
                />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: '#000', 
                    border: '1px solid #FEDF56',
                    color: '#FEDF56'
                  }}
                  formatter={(value: number | null) => value ? [`${value.toFixed(2)}%`] : ['-']}
                  labelFormatter={(timestamp) => new Date(timestamp * 1000).toLocaleString()}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36}
                  formatter={(value, entry) => {
                    const totalEth = value === "LONG" ? positions.long : positions.short;
                    return `${value} (${totalEth.toFixed(4)} ETH)`;
                  }}
                  wrapperStyle={{
                    color: "#FEDF56"
                  }}
                />
                <Line 
                  type="monotone"
                  dataKey="longPercentage"
                  stroke="#00FF00"
                  name="LONG"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={true}
                  isAnimationActive={false}
                />
                <Line 
                  type="monotone"
                  dataKey="shortPercentage"
                  stroke="#FF0000"
                  name="SHORT"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={true}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
};

export default MarketCharts; 