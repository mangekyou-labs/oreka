import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

interface ClientSideRouterProviderProps {
    children: React.ReactNode;
}

const ClientSideRouterProvider = ({ children }: ClientSideRouterProviderProps) => {
    return (
        <BrowserRouter>
            {children}
        </BrowserRouter>
    );
};

export default ClientSideRouterProvider; 