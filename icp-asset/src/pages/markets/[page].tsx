import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { AuthClient } from '@dfinity/auth-client';
import Image from 'next/image';
import { Spinner } from '@chakra-ui/react';
import ListAddressOwner from '../../components/ListAddressOwner';

export default function MarketsPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [principal, setPrincipal] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const { page } = router.query;

    useEffect(() => {
        checkAuthentication();
    }, []);

    async function checkAuthentication() {
        try {
            const authClient = await AuthClient.create();
            const authenticated = await authClient.isAuthenticated();

            if (authenticated) {
                const identity = authClient.getIdentity();
                const principal = identity.getPrincipal().toString();
                setPrincipal(principal);
                setIsAuthenticated(true);
            }

            setIsAuthReady(true);
            setIsLoading(false);
        } catch (error) {
            console.error('Authentication check failed:', error);
            setIsAuthReady(true);
            setIsLoading(false);
        }
    }

    async function login() {
        const authClient = await AuthClient.create();

        const isProduction = process.env.NODE_ENV === 'production';

        authClient.login({
            identityProvider: isProduction
                ? process.env.NEXT_PUBLIC_II_URL || "https://identity.ic0.app"
                : `http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943`,
            onSuccess: async () => {
                const identity = authClient.getIdentity();
                const principal = identity.getPrincipal().toString();
                setPrincipal(principal);
                setIsAuthenticated(true);
            },
        });
    }

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Spinner className="h-12 w-12" />
            </div>
        );
    }

    if (!isAuthReady) {
        return (
            <div className="flex h-screen items-center justify-center">
                <p>Loading authentication...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4">
                <h1 className="text-2xl font-bold">Welcome to Oreka Markets</h1>
                <p>Please log in to view available markets</p>
                <button
                    onClick={login}
                    className="flex items-center gap-2 rounded bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-white hover:from-blue-600 hover:to-purple-700"
                >
                    <span>Login with Internet Identity</span>
                    <Image src="/ii-logo.svg" width={24} height={24} alt="Internet Identity Logo" />
                </button>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <ListAddressOwner ownerAddress={principal} page={page ? Number(page) : 1} />
        </div>
    );
} 