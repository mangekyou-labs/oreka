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

  public async fetchKlines(symbol: string = 'BTCUSDT', interval: string = '1m', limit: number = 100, timeRange: string = '1d'): Promise<any[]> {
    try {
      // Adjust limit based on time range
      let adjustedLimit = limit;
      switch(timeRange) {
        case '1d':
          adjustedLimit = 24 * 60; // 1 day in minutes
          break;
        case '1w':
          adjustedLimit = 7 * 24 * 12; // 1 week in 5-minute intervals
          interval = '5m';
          break;
        case '1m':
          adjustedLimit = 30 * 24 * 4; // 1 month in 15-minute intervals
          interval = '15m';
          break;
        case 'all':
          adjustedLimit = 200; // Maximum reasonable amount
          interval = '1h';
          break;
      }
      
      // Cap at 1000 which is Binance's limit
      adjustedLimit = Math.min(adjustedLimit, 1000);
      
      // Format symbol cho Binance API
      const binanceSymbol = this.formatSymbolForBinance(symbol);
      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${adjustedLimit}`
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