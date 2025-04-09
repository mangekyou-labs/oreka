import {  } from '../components/Customer';
export interface PriceData {
  price: number;
  symbol: string;
  timestamp: number;
}

export class PriceService {
  private static instance: PriceService;
  private priceSubscribers: ((data: PriceData) => void)[] = [];
  private currentInterval: NodeJS.Timeout | null = null;
  
  // WebSocket support
  private webSocket: WebSocket | null = null;
  private webSocketSubscriptions: Map<string, Set<(data: PriceData) => void>> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  // Thêm hàm helper để format symbol cho APIs
  private formatSymbolForCoinbase(symbol: string): string {
    // Đảm bảo format là XXX-YYY cho Coinbase
    if (!symbol.includes('-')) {
      // Nếu format là XXXYYY (như BTCUSD)
      if (symbol.length >= 6) {
        return `${symbol.substring(0, 3)}-${symbol.substring(3)}`;
      }
      // Nếu format là XXX/YYY
      return symbol.replace('/', '-');
    }
    return symbol;
  }

  private formatSymbolForBinance(symbol: string): string {
    // Đảm bảo format là XXXYYY cho Binance (không có dấu gạch)
    return symbol.replace('-', '').replace('/', '');
  }

  public async fetchPrice(chartSymbol: string): Promise<PriceData> {
    try {
      // Format symbol cho Coinbase API
      const coinbaseSymbol = this.formatSymbolForCoinbase(chartSymbol);
      
      // Sử dụng symbol đã format để lấy giá
      const response = await fetch(`https://api.coinbase.com/v2/prices/${coinbaseSymbol}/spot`);
      const data = await response.json();
      
      return {
        price: parseFloat(data.data.amount),
        symbol: chartSymbol,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error fetching price from Coinbase:', error);
      
      // Fallback nếu API Coinbase không hoạt động
      try {
        const binanceSymbol = this.formatSymbolForBinance(chartSymbol);
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
        const data = await response.json();
        return {
          price: parseFloat(data.price),
          symbol: chartSymbol,
          timestamp: Date.now()
        };
      } catch (backupError) {
        console.error('Error fetching backup price from Binance:', backupError);
        throw error;
      }
    }
  }

  // Add WebSocket functionality
  public subscribeToWebSocketPrices(callback: (data: PriceData) => void, symbols: string[] = ['BTC-USD']): () => void {
    // Make sure all symbols are in correct format for Coinbase
    const formattedSymbols = symbols.map(symbol => this.formatSymbolForCoinbase(symbol));
    
    // Store subscription for each symbol
    formattedSymbols.forEach(symbol => {
      if (!this.webSocketSubscriptions.has(symbol)) {
        this.webSocketSubscriptions.set(symbol, new Set());
      }
      this.webSocketSubscriptions.get(symbol)?.add(callback);
    });
    
    // Initialize WebSocket if not already done
    this.initializeWebSocket(formattedSymbols);
    
    // Fetch initial prices immediately
    formattedSymbols.forEach(async (symbol) => {
      try {
        const priceData = await this.fetchPrice(symbol);
        callback(priceData);
      } catch (error) {
        console.error(`Error fetching initial price for ${symbol}:`, error);
      }
    });
    
    // Return unsubscribe function
    return () => {
      formattedSymbols.forEach(symbol => {
        const subscribers = this.webSocketSubscriptions.get(symbol);
        if (subscribers) {
          subscribers.delete(callback);
          if (subscribers.size === 0) {
            this.webSocketSubscriptions.delete(symbol);
          }
        }
      });
      
      // Close WebSocket if no more subscriptions
      if (this.webSocketSubscriptions.size === 0) {
        this.closeWebSocket();
      } else {
        // Update subscriptions
        this.updateWebSocketSubscriptions();
      }
    };
  }
  
  private initializeWebSocket(symbols: string[] = []): void {
    // Return early if WebSocket is already initialized
    if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
      this.updateWebSocketSubscriptions();
      return;
    }
    
    // Close existing WebSocket if it exists
    this.closeWebSocket();
    
    // Create new WebSocket connection
    this.webSocket = new WebSocket('wss://ws-feed.exchange.coinbase.com');
    
    this.webSocket.onopen = () => {
      console.log('Coinbase WebSocket connection established');
      this.reconnectAttempts = 0;
      this.updateWebSocketSubscriptions();
    };
    
    this.webSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle price updates from ticker messages
        if (data.type === 'ticker' && data.product_id && data.price) {
          const symbol = data.product_id;
          const subscribers = this.webSocketSubscriptions.get(symbol);
          
          if (subscribers) {
            const priceData: PriceData = {
              price: parseFloat(data.price),
              symbol: symbol,
              timestamp: Date.now()
            };
            
            // Notify all subscribers
            subscribers.forEach(callback => {
              try {
                callback(priceData);
              } catch (error) {
                console.error('Error in subscriber callback:', error);
              }
            });
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
    
    this.webSocket.onerror = (error) => {
      console.error('Coinbase WebSocket error:', error);
      this.attemptReconnect();
    };
    
    this.webSocket.onclose = (event) => {
      console.log(`Coinbase WebSocket connection closed: ${event.code} ${event.reason}`);
      this.attemptReconnect();
    };
  }
  
  private updateWebSocketSubscriptions(): void {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Get all unique symbols from subscriptions
    const symbols = Array.from(this.webSocketSubscriptions.keys());
    
    if (symbols.length === 0) {
      this.closeWebSocket();
      return;
    }
    
    // Subscribe to ticker channels for each symbol
    const subscribeMsg = {
      type: 'subscribe',
      product_ids: symbols,
      channels: ['ticker']
    };
    
    // Send subscription message
    this.webSocket.send(JSON.stringify(subscribeMsg));
    console.log('Subscribed to Coinbase WebSocket for:', symbols);
  }
  
  private closeWebSocket(): void {
    if (this.webSocket) {
      try {
        // Only attempt to unsubscribe and close if the connection is open
        if (this.webSocket.readyState === WebSocket.OPEN) {
          const symbols = Array.from(this.webSocketSubscriptions.keys());
          if (symbols.length > 0) {
            const unsubscribeMsg = {
              type: 'unsubscribe',
              product_ids: symbols,
              channels: ['ticker']
            };
            this.webSocket.send(JSON.stringify(unsubscribeMsg));
          }
          this.webSocket.close();
        }
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      } finally {
        this.webSocket = null;
      }
    }
    
    // Clear any pending reconnect
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
  
  private attemptReconnect(): void {
    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Only attempt to reconnect if we have subscriptions
    if (this.webSocketSubscriptions.size === 0) {
      return;
    }
    
    // Check if we've exceeded max reconnect attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Max WebSocket reconnect attempts (${this.maxReconnectAttempts}) reached`);
      return;
    }
    
    // Exponential backoff for reconnect
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    
    console.log(`Attempting to reconnect WebSocket in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      // Get all symbols from current subscriptions
      const symbols = Array.from(this.webSocketSubscriptions.keys());
      // Attempt to initialize the WebSocket again
      this.initializeWebSocket(symbols);
    }, delay);
  }

  public subscribeToPriceUpdates(callback: (data: PriceData) => void, symbol: string = 'BTC-USD', interval: number = 5000) {
    this.priceSubscribers.push(callback);

    if (!this.currentInterval) {
      this.currentInterval = setInterval(async () => {
        try {
          const priceData = await this.fetchPrice(symbol);
          this.priceSubscribers.forEach(subscriber => subscriber(priceData));
        } catch (error) {
          console.error('Error in price update interval:', error);
        }
      }, interval);
    }

    // Initial fetch
    this.fetchPrice(symbol).then(priceData => callback(priceData));
  }

  public unsubscribeFromPriceUpdates(callback: (data: PriceData) => void) {
    this.priceSubscribers = this.priceSubscribers.filter(sub => sub !== callback);
    
    if (this.priceSubscribers.length === 0 && this.currentInterval) {
      clearInterval(this.currentInterval);
      this.currentInterval = null;
    }
  }

  public async fetchKlines(symbol: string, interval: string = '1m', limit: number = 100): Promise<any[]> {
    try {
      // Luôn lấy dữ liệu cho 1 tuần
      const endTime = Date.now();
      const startTime = endTime - 7 * 24 * 60 * 60 * 1000; // 1 tuần trước
      const adjustedInterval = '5m'; // Khoảng thời gian phù hợp cho 1 tuần
      
      // Format symbol cho Binance API
      const binanceSymbol = this.formatSymbolForBinance(symbol);
      
      console.log(`Fetching klines for ${binanceSymbol}, interval: ${adjustedInterval}`);
      
      // Thử sử dụng API Binance trước
      try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${adjustedInterval}&startTime=${startTime}&endTime=${endTime}&limit=1000`;
        const response = await fetch(url);
        const data = await response.json();
        
        // Kiểm tra lỗi từ Binance
        if (data.code && data.msg) {
          console.error(`Binance API error: ${data.msg}`);
          throw new Error(data.msg);
        }
        
        if (!Array.isArray(data) || data.length === 0) {
          console.warn(`No data from Binance for ${binanceSymbol}, trying fallback...`);
          throw new Error("Empty data from Binance");
        }
        
        console.log(`Received ${data.length} kline points from Binance`);
        
        // Xử lý dữ liệu từ Binance
        let processedData = data.map((item: any[]) => ({
          time: parseInt(item[0]),
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5])
        }));
        
        // Đảm bảo dữ liệu được sắp xếp theo thời gian
        processedData.sort((a, b) => a.time - b.time);
        
        // Lấy mẫu nếu có quá nhiều điểm
        if (processedData.length > 300) {
          processedData = this.sampleData(processedData, 300);
        }
        
        return processedData;
      } catch (binanceError) {
        console.error("Error with Binance API, trying CoinGecko fallback:", binanceError);
        
        // Fallback sang CoinGecko nếu Binance không hoạt động
        try {
          // Chuyển đổi symbol từ BTCUSDT -> bitcoin, ETHUSDT -> ethereum
          let coinId = 'bitcoin';
          if (symbol.toLowerCase().includes('eth')) {
            coinId = 'ethereum';
          } else if (symbol.toLowerCase().includes('bnb')) {
            coinId = 'binancecoin';
          } else if (symbol.toLowerCase().includes('sol')) {
            coinId = 'solana';
          } else if (symbol.toLowerCase().includes('icp')) {
            coinId = 'internet-computer';
          } else if (symbol.toLowerCase().includes('dot')) {
            coinId = 'polkadot';
          }
          
          // Luôn lấy dữ liệu cho 7 ngày
          const days = 7;
          
          const geckoUrl = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
          const response = await fetch(geckoUrl);
          const data = await response.json();
          
          if (!data.prices || data.prices.length === 0) {
            console.error("No data from CoinGecko fallback");
            return [];
          }
          
          console.log(`Received ${data.prices.length} price points from CoinGecko`);
          
          // Xử lý dữ liệu từ CoinGecko
          let processedData = data.prices.map((item: [number, number]) => ({
            time: item[0],
            close: item[1],
            open: item[1],
            high: item[1],
            low: item[1],
            volume: 0
          }));
          
          // Đảm bảo dữ liệu được sắp xếp theo thời gian
          processedData.sort((a, b) => a.time - b.time);
          
          // Lấy mẫu nếu có quá nhiều điểm
          if (processedData.length > 300) {
            processedData = this.sampleData(processedData, 300);
          }
          
          return processedData;
        } catch (geckoError) {
          console.error("Both Binance and CoinGecko APIs failed:", geckoError);
          return [];
        }
      }
    } catch (error) {
      console.error('Error fetching klines:', error);
      return [];
    }
  }

  // Thêm hàm helper để lấy mẫu dữ liệu
  private sampleData(data: any[], targetCount: number): any[] {
    if (data.length <= targetCount) return data;
    
    // Tìm giá cao nhất và thấp nhất
    let highestPoint = data[0];
    let lowestPoint = data[0];
    
    data.forEach(point => {
      if (point.close > highestPoint.close) highestPoint = point;
      if (point.close < lowestPoint.close) lowestPoint = point;
    });
    
    const step = Math.floor(data.length / targetCount);
    const sampledData = [];
    
    // Luôn giữ điểm đầu
    sampledData.push(data[0]);
    
    for (let i = step; i < data.length - step; i += step) {
      sampledData.push(data[i]);
    }
    
    // Thêm điểm cuối
    sampledData.push(data[data.length - 1]);
    
    // Thêm điểm cao nhất và thấp nhất nếu chưa có trong mẫu
    const hasHighest = sampledData.some(p => p.time === highestPoint.time);
    const hasLowest = sampledData.some(p => p.time === lowestPoint.time);
    
    if (!hasHighest) sampledData.push(highestPoint);
    if (!hasLowest) sampledData.push(lowestPoint);
    
    // Sắp xếp lại theo thời gian
    sampledData.sort((a, b) => a.time - b.time);
    
    return sampledData;
  }
} 