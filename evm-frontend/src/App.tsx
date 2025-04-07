import React from 'react';
import { FeeProvider } from './context/FeeContext';
import Customer from './components/Customer';
import Owner from './components/Owner';

const App: React.FC = () => {
  return (
    <FeeProvider>
      <Customer />
      <Owner address="0x0000000000000000000000000000000000000000" />
    </FeeProvider>
  );
};

export default App; 