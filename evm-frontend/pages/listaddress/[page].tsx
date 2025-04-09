import { useRouter } from 'next/router';
import ListAddressOwner from '../../src/components/ListAddressOwner';
import { useAuth } from '../../src/context/AuthContext';
import { useEffect, useState } from 'react';

const ListAddressPage = () => {
    const router = useRouter();
    const { page } = router.query;
    const { isConnected, walletAddress, connectWallet } = useAuth();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const autoConnect = async () => {
            if (!isConnected) {
                try {
                    await connectWallet();
                } catch (error) {
                    console.error("Auto connect failed:", error);
                } finally {
                    setIsLoading(false);
                }
            } else {
                setIsLoading(false);
            }
        };
        autoConnect();
    }, []);

    if (isLoading || !page) {
        return <div>Loading...</div>;
    }

    const pageNumber = parseInt(router.query.page as string, 10);
    const finalPage = isNaN(pageNumber) ? 1 : pageNumber;

    // Truyền walletAddress vào component để hiển thị các hợp đồng của người dùng hiện tại
    return (
        <div>
            <ListAddressOwner ownerAddress={walletAddress} page={finalPage} />
        </div>
    );
};

export default ListAddressPage;