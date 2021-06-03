// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IOraclePrice.sol";

contract FalseOracle is IOraclePrice, Ownable {
    
    uint256 price;

    function getPrice() external override view returns(uint256){
        return price;
    }

    function setPrice(uint256 _price) external onlyOwner{
        price = _price;
    }
}