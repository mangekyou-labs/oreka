export const determineMarketResult = (
    finalPrice: number,
    strikePrice: number
  ): 'LONG' | 'SHORT' => {
    return finalPrice < strikePrice ? 'SHORT' : 'LONG';
  };
  