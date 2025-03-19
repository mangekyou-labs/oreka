import React from 'react';
import { Box, Heading } from '@chakra-ui/react';
import OwnerDeployComponent from '../src/components/OwnerDeploy'; // Đảm bảo đường dẫn đúng

const OwnerDeploy: React.FC = () => {
  return (
    <OwnerDeployComponent address="0x0000000000000000000000000000000000000000" />
  );
};

export default OwnerDeploy;