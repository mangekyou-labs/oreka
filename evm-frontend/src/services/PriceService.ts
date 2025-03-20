export interface PriceData {
  price: number;
  symbol: string;
  timestamp: number;
}

export class PriceService {
  private static instance: PriceService;
  private priceSubscribers: ((data: PriceData) => void)[] = [];
  private currentInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  public async fetchPrice(symbol: string = 'BTC-USD'): Promise<PriceData> {
    try {
      // Chuyển đổi định dạng symbol từ BTCUSD sang BTC-USD nếu cần
      const formattedSymbol = symbol.includes('-') ? symbol : `${symbol.substring(0, 3)}-${symbol.substring(3)}`;
      
      // Sử dụng API Coinbase để lấy giá
      const response = await fetch(`https://api.coinbase.com/v2/prices/${formattedSymbol}/spot`);
      const data = await response.json();
      
      return {
        price: parseFloat(data.data.amount),
        symbol: symbol,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error fetching price from Coinbase:', error);
      
      // Fallback nếu API Coinbase không hoạt động
      try {
        const binanceSymbol = symbol.replace('-', '');
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
        const data = await response.json();
        return {
          price: parseFloat(data.price),
          symbol: symbol,
          timestamp: Date.now()
        };
      } catch (backupError) {
        console.error('Error fetching backup price from Binance:', backupError);
        throw error;
      }
    }
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

  public async fetchKlines(symbol: string = 'BTC-USD', interval: string = '1m', limit: number = 100): Promise<any[]> {
    try {
      // Coinbase không có API klines tương tự Binance, nên phải dùng Binance cho tính năng này
      const binanceSymbol = symbol.replace('-', '');
      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`
      );
      const data = await response.json();
      return data.map((item: any[]) => ({
        time: item[0],
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5])
      }));
    } catch (error) {
      console.error('Error fetching klines:', error);
      throw error;
    }
  }
} 