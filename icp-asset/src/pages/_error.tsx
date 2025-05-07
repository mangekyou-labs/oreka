import { NextPage } from 'next';
import Head from 'next/head';

interface ErrorProps {
    statusCode?: number;
}

const ErrorPage: NextPage<ErrorProps> = ({ statusCode }) => {
    return (
        <>
            <Head>
                <title>Error | Oreka</title>
            </Head>
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                flexDirection: 'column',
                padding: '20px',
                textAlign: 'center'
            }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
                    {statusCode ? `An error ${statusCode} occurred on server` : 'An error occurred on client'}
                </h1>
                <p>Please try again or contact support if the problem persists.</p>
            </div>
        </>
    );
};

ErrorPage.getInitialProps = ({ res, err }) => {
    const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
    return { statusCode };
};

export default ErrorPage; 