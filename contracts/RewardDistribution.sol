
// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./libs/SafeBEP20.sol";
import "./libs/IBEP20.sol";

    /**
        @dev This contract is intended to be handled by a masterchef contract. 
        Here you can deposit funds that will be distributed among the users of the masterchef.
        In this case the purpose is to deposit part of the fees to deliver them to the users of certain native pools.
     */

contract RewardDistribution is Ownable {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    // Info of each user.
    struct UserInfo {
        uint256 amount;     // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        /** 
         * We do some fancy math here. Basically, any point in time, the amount of rewards
         * entitled to a user but is pending to be distributed is:
         *
         *   pending reward = (user.amount * pool.accRewardPerShare) - user.rewardDebt
         *
         * Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
         *   1. The pool's `accRewardPerShare` (and `lastRewardBlock`) gets updated.
         *   2. User receives the pending reward sent to his/her address.
         *   3. User's `amount` gets updated.
         *   4. User's `rewardDebt` gets updated.
         */
    }

    // Info of each pool.
    struct PoolInfo {
        IBEP20 lpToken;           // Address of LP token contract.
        uint256 allocPoint;       // How many allocation points assigned to this pool. Rewards to distribute per block.
        uint256 lastRewardBlock;  // Last block number that Rewards distribution occurs.
        uint256 accRewardTokenPerShare; // Accumulated Rewards per share, times 1e30. See below.
    }

    // Info of each pool.
    mapping(uint256 => PoolInfo) public poolInfo;
    // Pids of pools added from masterchef
    uint256[] public poolPids;
    // Info of each user that stakes LP tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    // Total allocation poitns. Must be the sum of all allocation points in all pools.
    uint256 private totalAllocPoint = 0;
    // The block number when Reward distribution starts.
    uint256 public startBlock;
    // Reward tokens distributed per block
    uint256 public rewardPerBlock;
    // Last block when distribution rewards ends
    uint256 public endBlockRewards;
    // Reward token from fees to Liquidity providers
    IBEP20 public rewardToken;
    // Rewards already assigned to be distributed
    uint256 public assignedRewards;
    // Masterchef
    address public masterchef;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event DepositRewards(uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyRewardWithdraw(address indexed user, uint256 amount);
    event Harvest(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(IBEP20 _rewardToken, address _masterchef, uint256 _endBlockRewards) public {
        rewardToken = _rewardToken;
        masterchef = _masterchef;
        endBlockRewards = _endBlockRewards;
    }
    
    modifier onlyMasterchef(){
        require(msg.sender == masterchef, "You are not the masterchef");
        _;
    }

    modifier onlyOwnerOrMasterchef(){
        require(msg.sender == masterchef || msg.sender == owner());
        _;
    }

    mapping(uint256 => bool) public poolExistence;
    modifier nonDuplicated(uint256 _pid) {
        require(poolExistence[_pid] == false, "nonDuplicated: duplicated");
        _;
    }

    /// @dev Add a new lp to the pool. Can only be called by the owner.
    function add(IBEP20 _lpToken, bool _withUpdate, uint256 _pid) public onlyOwnerOrMasterchef nonDuplicated(_pid) {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(100);
        poolExistence[_pid] = true;
        poolPids.push(_pid);
        poolInfo[_pid] = (PoolInfo({
            lpToken: _lpToken,
            allocPoint: 100,
            lastRewardBlock: lastRewardBlock,
            accRewardTokenPerShare: 0
        }));
    }

    /// @dev Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        if (_to <= endBlockRewards) {
            return _to.sub(_from);
        } else if (_from >= endBlockRewards) {
            return 0;
        } else {
            return endBlockRewards.sub(_from);
        }
    }

    /// @return Returns the pending Reward of the _user.
    function pendingReward(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accRewardTokenPerShare = pool.accRewardTokenPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(masterchef));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 tokenReward = multiplier.mul(rewardPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accRewardTokenPerShare = accRewardTokenPerShare.add(tokenReward.mul(1e30).div(lpSupply));
        }
        return user.amount.mul(accRewardTokenPerShare).div(1e30).sub(user.rewardDebt);
    }

    /// @dev Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(masterchef));
        if (lpSupply == 0 || rewardPerBlock == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 tokenReward = multiplier.mul(rewardPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
        pool.accRewardTokenPerShare = pool.accRewardTokenPerShare.add(tokenReward.mul(1e30).div(lpSupply));
        assignedRewards = assignedRewards.add(tokenReward);
        pool.lastRewardBlock = block.number;
    }

    /// @dev Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolPids.length;
        for (uint256 pid = 0; pid < length; pid++) {
            updatePool(poolPids[pid]);
        }
    }
    
    /// @param _to address to send reward token to
    /// @param _amount value of reward token to transfer
    function safeTransferReward(address _to, uint256 _amount) internal {
        rewardToken.safeTransfer(_to, _amount);
    }

    /// Increment balance into the contract to calculate and earn rewards
    /// It assumes that there is no fee involved. It it's, the masterchef should send the amount after fees.
    /// @param _amount The amount to increment the balance
    /// @param _pid Pool identifier
    function incrementBalance(uint256 _pid,uint256 _amount, address _user) public onlyMasterchef{
        require(poolExistence[_pid], "pool not found");
        require(_amount > 0, "IncrementBalance error: amount should be more than zero.");
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        updatePool(_pid);
        user.amount = user.amount.add(_amount);
        user.rewardDebt = user.amount.mul(pool.accRewardTokenPerShare).div(1e30);
        emit Deposit(_user, _pid, _amount);
    }

    /// Reduce balance into the contract
    /// @param _amount The amount to reduce the balance
    /// @param _pid Pool identifier
    function reduceBalance(uint256 _pid, uint256 _amount, address _user) public onlyMasterchef{
        require(_amount > 0, "ReduceBalance error: amount should be more than zero.");
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        updatePool(_pid);
        if(user.amount < _amount){
            _amount = user.amount;
        }
        if(_amount == 0){
            return;
        }
        user.amount = user.amount.sub(_amount);
        user.rewardDebt = user.amount.mul(pool.accRewardTokenPerShare).div(1e30);
        emit Withdraw(_user, _pid, _amount);
    }

    /// Wthdraw rewards
    /// Separated logic of any other withdraw() or reduceBalance() function to be more adaptable to the masterchef condition, as harvest intervals
    /// @param _pid Pool identifier
    function harvest(uint256 _pid, address _user) public onlyMasterchef{
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.accRewardTokenPerShare).div(1e30).sub(user.rewardDebt);
        if(pending > 0) {
            uint256 currentRewardBalance = rewardBalance();
            if(currentRewardBalance > 0) {
                if(pending > currentRewardBalance) {
                    pending = currentRewardBalance;
                }
                require(assignedRewards >= pending, "Ups harvest");
                assignedRewards = assignedRewards.sub(pending);
                safeTransferReward(_user, pending);
                user.rewardDebt = user.amount.mul(pool.accRewardTokenPerShare).div(1e30);
                emit Harvest(_user, _pid, pending);
            }
        }
    }

    /// Obtain the reward balance of this contract.
    /// @return Returns reward balance of this contract.
    function rewardBalance() public view returns (uint256) {
        return rewardToken.balanceOf(address(this));
    }

    /* Owner Functions */

    /// @dev Deposit new reward to be distrivuted.
    function depositRewards(uint256 _newRewards) external onlyOwner{
        rewardToken.safeTransferFrom(msg.sender, address(this), _newRewards);
        massUpdatePools();
        updateRewardPerBlock();
        emit DepositRewards(_newRewards);
    }

    /// @dev Calculate the reward per block according to the available reward and the end block rewards.
    function updateRewardPerBlock() internal{
        uint256 rewardsAvailable = rewardToken.balanceOf(address(this)).sub(assignedRewards);
        require(block.number < endBlockRewards, "Rewards distribution finished");
        rewardPerBlock = rewardsAvailable.div(endBlockRewards.sub(block.number));
    }

    /// @dev Update last block to distribute rewards.
    function updateEndBlockRewards(uint256 _endBlockReward) external onlyOwner{
        massUpdatePools();
        endBlockRewards = _endBlockReward;
        updateRewardPerBlock();
    }

    function updateMasterchef(address _masterchef) external onlyOwner{
        masterchef = _masterchef;
    }

    /** @dev Withdraw reward tokens to owner. Function in case something goes wrong.
      * Only affects reawrd tokens here, not users funds in the masterchef.
      */
    function emergencyWithdrawRewards(uint256 _amount) external onlyOwner{
        require(_amount <= rewardBalance(), 'not enough rewards');
        safeTransferReward(msg.sender, rewardToken.balanceOf(address(this)));
        rewardPerBlock = 0;
        emit EmergencyRewardWithdraw(msg.sender, _amount);
    }
}