import React from 'react';
import { useRouter } from 'next/router';
import Customer from '../../src/components/Customer';

const CustomerPage = () => {
  const router = useRouter();
  const { address } = router.query;

  return <Customer contractAddress={address as string} />;
};

export default CustomerPage; 