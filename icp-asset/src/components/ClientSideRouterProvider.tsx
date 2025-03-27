import React from 'react';
import { BrowserRouter } from 'react-router-dom';

interface ClientSideRouterProviderProps {
    children: React.ReactNode;
}

const ClientSideRouterProvider = ({ children }: ClientSideRouterProviderProps) => {
    return <BrowserRouter>{children}</BrowserRouter>;
};

export default ClientSideRouterProvider; 