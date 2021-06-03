//SPDX-License-Identifier: Unlicense

pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../libs/IBEP20.sol";
import "../libs/SafeBEP20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract BullRun is Ownable {
    using SafeBEP20 for IBEP20;
    using SafeMath for uint256;

    struct PoolInfo{
        IBEP20 token;
        uint256 fee;
        uint256 nextRoundAmount;
        uint256 lastBidTime;
        address lastBidder;
        address previousWinner;
        uint256 delay;
    }
    
    PoolInfo[] public poolInfo;
    address public feeAddress;
    mapping(IBEP20 => bool) public poolExistence;

    event OnBid(address indexed author, uint256 pid, uint256 amount);
    event OnWin(address indexed author, uint256 pid, uint256 amount);

    uint256 public collapseDelay = 960; //16 minutes

    modifier notContract() {
        require(!_isContract(msg.sender), "contract not allowed");
        require(msg.sender == tx.origin, "proxy contract not allowed");
        _;
    }

    modifier nonDuplicated(IBEP20 _token) {
        require(poolExistence[_token] == false, "nonDuplicated: duplicated");
        _;
    }

    constructor(
        address _feeAddress
    ) public {
        feeAddress = _feeAddress;
    }

    function add(IBEP20 _token, uint256 _fee) public onlyOwner nonDuplicated(_token){
        require(_fee <= 1000, "fee can't be more than 10%");
        poolExistence[_token] = true;
        poolInfo.push(PoolInfo({
            token : _token,
            fee : _fee,
            nextRoundAmount : 0,
            lastBidTime : 0,
            lastBidder : address(0x0000000000000000000000000000000000000000),
            previousWinner : address(0x0000000000000000000000000000000000000000),
            delay : collapseDelay
        }));
    }

    function set(uint256 _pid, uint256 _fee) public onlyOwner {
        require(_fee <= 1000, "fee can't be more than 10%");
        poolInfo[_pid].fee = _fee;
    }

    function participate(uint256 amount, uint256 pid) public notContract {
        if(hasWinner(pid)){
            claimReward(pid);
        }
        PoolInfo storage pool = poolInfo[pid];

        uint256 currentBalance = pool.token.balanceOf(address(this));
        require(amount >= currentBalance.div(20), "min 5% bid");

        pool.token.safeTransferFrom(msg.sender, address(this), amount);
        emit OnBid(msg.sender, pid, amount);
        if(pool.delay > 60){
            pool.delay = pool.delay.sub(60);
        }
        pool.lastBidTime = block.timestamp;
        pool.lastBidder = msg.sender;
    }

    function hasWinner(uint256 pid) public view returns (bool) {
        PoolInfo storage pool = poolInfo[pid];
        return pool.lastBidTime != 0 && block.timestamp - pool.lastBidTime >= pool.delay;
    }

    function claimReward(uint256 pid) public notContract {
        require(hasWinner(pid), "any prize pending");
        PoolInfo storage pool = poolInfo[pid];
        uint256 totalBalance = pool.token.balanceOf(address(this));

        uint256 feeAmount = totalBalance.mul(pool.fee).div(10000);
        uint256 nextRoundAmount = totalBalance.div(10);
        uint256 winAmount = totalBalance - feeAmount - nextRoundAmount;
        
        pool.lastBidTime = 0;
        pool.previousWinner = pool.lastBidder;
        pool.delay = collapseDelay;
        pool.token.safeTransfer(feeAddress, feeAmount);
        pool.token.safeTransfer(pool.lastBidder, winAmount);
        pool.lastBidder = address(0x0000000000000000000000000000000000000000);
        emit OnWin(pool.lastBidder, pid, winAmount);
    }

    function setCollapseDelay(uint256 delay) public onlyOwner {
        require(delay >= 60, "must be at least one minute");
        collapseDelay = delay;
    }

    function minBet(uint256 _pid) public view returns(uint256){
        PoolInfo storage pool = poolInfo[_pid];
        uint256 currentBalance = pool.token.balanceOf(address(this));
        if(hasWinner(_pid)){
            return currentBalance.div(10).div(20);
        }
        return currentBalance.div(20);
    }

    function _isContract(address addr) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }
}