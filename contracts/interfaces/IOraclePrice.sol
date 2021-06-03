// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.0;

interface IOraclePrice{
    function getPrice() external view returns(uint256);
}