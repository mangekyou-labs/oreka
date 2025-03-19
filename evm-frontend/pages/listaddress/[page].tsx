import { useRouter } from 'next/router';
import ListAddressOwner from '../../src/components/ListAddressOwner';


interface ListAddressOwnerProps {
    ownerAddress: string;
    page: number;  // Add this line to include the page prop
    // ... other props if any ...
}
const ListAddressPage = () => {
    const router = useRouter();
    const { page } = router.query;  // Lấy thông tin trang từ URL
    if (!page) {
        return <div>Loading...</div>;
    }

    // Nếu page không xác định, hãy điều hướng đến trang đầu tiên
    //const pageNumber = parseInt(page as string) || 1;
    const pageNumber = parseInt(router.query.page as string, 10);
    const finalPage = isNaN(pageNumber) ? 1 : pageNumber;
    return (
        <div>
            <ListAddressOwner ownerAddress="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" page={finalPage} />
        </div>
    );
};

export default ListAddressPage;