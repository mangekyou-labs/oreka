import React, { createContext, useState, ReactNode } from 'react';

interface FeeContextType {
  feePercentage: string;
  setFeePercentage: (value: string) => void;
}

export const FeeContext = createContext<FeeContextType | undefined>(undefined);

export const FeeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [feePercentage, setFeePercentage] = useState('10'); // Default value

  return (
    <FeeContext.Provider value={{ feePercentage, setFeePercentage }}>
      {children}
    </FeeContext.Provider>
  );
}; 