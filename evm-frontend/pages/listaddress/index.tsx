import { useEffect } from 'react';
import { useRouter } from 'next/router';

const ListAddressIndex = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace('/listaddress/1');
  }, []);

  return null;
};

export default ListAddressIndex;