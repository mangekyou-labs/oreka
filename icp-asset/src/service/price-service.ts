export interface PriceData {
    price: number;
    symbol: string;
    timestamp: number;
}

export class PriceService {
    private static instance: PriceService;
    private priceSubscribers: ((data: PriceData) => void)[] = [];
    private currentInterval: NodeJS.Timeout | null = null;

    private constructor() { }

    public static getInstance(): PriceService {
        if (!PriceService.instance) {
            PriceService.instance = new PriceService();
        }
        return PriceService.instance;
    }

    // Helper function to format symbol for APIs
    private formatSymbolForCoinbase(symbol: string): string {
        // Ensure format is XXX-YYY for Coinbase
        if (!symbol.includes('-')) {
            // If format is XXXYYY (like BTCUSD)
            if (symbol.length >= 6) {
                return `${symbol.substring(0, 3)}-${symbol.substring(3)}`;
            }
            // If format is XXX/YYY
            return symbol.replace('/', '-');
        }
        return symbol;
    }

    private formatSymbolForBinance(symbol: string): string {
        // Ensure format is XXXYYY for Binance (no dash)
        return symbol.replace('-', '').replace('/', '');
    }

    public async fetchPrice(chartSymbol: string): Promise<PriceData> {
        try {
            // Format symbol for Coinbase API
            const coinbaseSymbol = this.formatSymbolForCoinbase(chartSymbol);

            // Use formatted symbol to get price
            const response = await fetch(`https://api.coinbase.com/v2/prices/${coinbaseSymbol}/spot`);
            const data = await response.json();

            return {
                price: parseFloat(data.data.amount),
                symbol: chartSymbol,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Error fetching price from Coinbase:', error);

            // Fallback if Coinbase API doesn't work
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

                // Return mock data as last resort
                return {
                    price: this.getMockPrice(chartSymbol),
                    symbol: chartSymbol,
                    timestamp: Date.now()
                };
            }
        }
    }

    // Generate mock price for development/testing
    private getMockPrice(symbol: string): number {
        const basePrices: Record<string, number> = {
            'BTC-USD': 60000,
            'ETH-USD': 3000,
            'ICP-USD': 10,
            'BTC/USD': 60000,
            'ETH/USD': 3000,
            'ICP/USD': 10,
            'BTCUSD': 60000,
            'ETHUSD': 3000,
            'ICPUSD': 10
        };

        const basePrice = basePrices[symbol] || 100;
        // Add some random variation
        const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
        return basePrice * (1 + variation);
    }

    public subscribeToPriceUpdates(callback: (data: PriceData) => void, symbol: string = 'BTC-USD', interval: number = 5000) {
        this.priceSubscribers.push(callback);

        // Fetch price immediately
        this.fetchPrice(symbol).then(data => callback(data)).catch(console.error);

        // Set up interval for regular updates
        if (!this.currentInterval) {
            this.currentInterval = setInterval(async () => {
                try {
                    const data = await this.fetchPrice(symbol);
                    this.priceSubscribers.forEach(subscriber => subscriber(data));
                } catch (error) {
                    console.error('Error updating price:', error);
                }
            }, interval);
        }

        // Return unsubscribe function
        return () => this.unsubscribeFromPriceUpdates(callback);
    }

    public unsubscribeFromPriceUpdates(callback: (data: PriceData) => void) {
        this.priceSubscribers = this.priceSubscribers.filter(subscriber => subscriber !== callback);

        if (this.priceSubscribers.length === 0 && this.currentInterval) {
            clearInterval(this.currentInterval);
            this.currentInterval = null;
        }
    }

    public async fetchKlines(symbol: string, interval: string = '1d', limit: number = 100): Promise<any[]> {
        try {
            // Use Binance API for historical data
            const binanceSymbol = this.formatSymbolForBinance(symbol);

            const response = await fetch(
                `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`
            );

            const data = await response.json();

            if (Array.isArray(data)) {
                // Format the data to a more usable structure
                return data.map(entry => ({
                    time: entry[0], // Open time
                    open: parseFloat(entry[1]),
                    high: parseFloat(entry[2]),
                    low: parseFloat(entry[3]),
                    close: parseFloat(entry[4]),
                    volume: parseFloat(entry[5]),
                    closeTime: entry[6]
                }));
            }
            return this.getMockKlines(symbol, limit);
        } catch (error) {
            console.error('Error fetching klines data from Binance:', error);
            return this.getMockKlines(symbol, limit);
        }
    }

    // Generate mock historical price data
    private getMockKlines(symbol: string, limit: number): any[] {
        const basePrice = this.getMockBasePrice(symbol);
        const result = [];

        // Generate data points over the last 'limit' days
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;

        for (let i = limit - 1; i >= 0; i--) {
            const time = now - (i * oneDayMs);

            // Generate some random price movement
            const randomFactor = 0.02; // 2% max daily movement
            const dailyChange = (Math.random() - 0.5) * 2 * randomFactor;

            // Calculate daily prices
            const dayClose = basePrice * (1 + (i - limit / 2) * 0.001 + dailyChange); // Add a slight trend
            const dayOpen = dayClose * (1 + (Math.random() - 0.5) * 0.01);
            const dayHigh = Math.max(dayOpen, dayClose) * (1 + Math.random() * 0.01);
            const dayLow = Math.min(dayOpen, dayClose) * (1 - Math.random() * 0.01);

            result.push({
                time: time,
                open: dayOpen,
                high: dayHigh,
                low: dayLow,
                close: dayClose,
                volume: basePrice * 100 * (1 + Math.random()),
                closeTime: time + oneDayMs - 1
            });
        }

        return result;
    }

    private getMockBasePrice(symbol: string): number {
        const basePrices: Record<string, number> = {
            'BTC-USD': 60000,
            'ETH-USD': 3000,
            'ICP-USD': 10,
            'BTC/USD': 60000,
            'ETH/USD': 3000,
            'ICP/USD': 10,
            'BTCUSD': 60000,
            'ETHUSD': 3000,
            'ICPUSD': 10
        };

        return basePrices[symbol] || 100;
    }
} 