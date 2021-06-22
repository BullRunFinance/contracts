// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./libs/IBEP20.sol";

interface IMasterChef {
    struct UserInfo {
        uint256 amount;        
        uint256 rewardDebt;  
        uint256 rewardLockedUp;  
        uint256 nextHarvestUntil; 
        uint256 strength; 
        uint256 nftId; 
        uint256 lastHarvest; 
    }

    function userInfo(uint256 pid, address user) external view returns (UserInfo memory);
}

contract BullVoteProxy {
    using SafeMath for uint256;

    // Bull Token
    address public immutable bull;
    // Master Chef
    address public immutable masterChef;
    uint256 public immutable bullPoolPid;
    // Trading Pairs
    address public immutable bullBNB;
    uint256 public immutable bullBNBFarmPid;
    address public immutable bullBUSD ;
    uint256 public immutable bullBUSDFarmPid;

    constructor (
        address _bull,
        address _masterChef,
        uint256 _bullPoolPid,
        address _bullBNB,
        uint256 _bullBNBFarmPid,
        address _bullBUSD,
        uint256 _bullBUSDFarmPid
    ) {
        bull = _bull;
        masterChef = _masterChef;
        bullPoolPid = _bullPoolPid;
        bullBNB = _bullBNB;
        bullBNBFarmPid = _bullBNBFarmPid;
        bullBUSD = _bullBUSD;
        bullBUSDFarmPid = _bullBUSDFarmPid;
    }

    function decimals() external pure returns (uint8) {
        return uint8(18);
    }

    function name() external pure returns (string memory) {
        return "BullToken Vote Proxy";
    }

    function symbol() external pure returns (string memory) {
        return "BULL-VOTE";
    }

    function totalSupply() external view returns (uint256) {
        return IBEP20(bull).totalSupply();
    }

    function balanceOf(address _voter) external view returns (uint256) {
        uint256 balance;

        // bull in wallet
        balance = balance.add(IBEP20(bull).balanceOf(_voter));
        // bull in bull pool
        balance = balance.add(IMasterChef(masterChef).userInfo(bullPoolPid, _voter).amount);
        // bull in BULL-BNB liquidity pool
        balance = balance.add(balanceInLiquidityPoolAndFarm(bullBNB, bullBNBFarmPid, _voter));
        // bull in BULL-BUSD liquidity pool
        balance = balance.add(balanceInLiquidityPoolAndFarm(bullBUSD, bullBUSDFarmPid, _voter));

        return balance;
    }

    function balanceInLiquidityPoolAndFarm(address pair, uint256 pid, address _voter) private view returns (uint256) {
        uint256 lpTotalSupply = IBEP20(pair).totalSupply();
        uint256 voterLpBalance = IBEP20(pair).balanceOf(_voter).add(IMasterChef(masterChef).userInfo(pid, _voter).amount);
        uint256 bullInLp = IBEP20(bull).balanceOf(pair);

        if (lpTotalSupply > 0) {
            return voterLpBalance.mul(1e8).div(lpTotalSupply).mul(bullInLp).div(1e8);
        }

        return 0;
    }
}