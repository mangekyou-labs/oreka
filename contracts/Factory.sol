// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Factory {
    event Deployed(address indexed owner, address indexed contractAddress, uint index);

    // Mapping để lưu trữ địa chỉ hợp đồng theo địa chỉ owner
    mapping(address => address[]) public ownerContracts;
    
    function deploy(address contractAddress) public {
        require(contractAddress != address(0), "Invalid contract address");

        // Lưu địa chỉ hợp đồng vào mapping với chỉ mục
        ownerContracts[msg.sender].push(contractAddress);
        
        // Phát sự kiện khi deploy thành công
        emit Deployed(msg.sender, contractAddress, ownerContracts[msg.sender].length - 1);
    }

    function getContractsByOwner(address owner) public view returns (address[] memory) {
        return ownerContracts[owner];
    }
}