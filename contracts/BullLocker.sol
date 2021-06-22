// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "./libs/IBEP20.sol";
import "./libs/SafeBEP20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev BullLocker contract locks the liquidity (LP tokens) which are added by the automatic liquidity acquisition
 * function in BullToken.
 *
 * The owner of BullLocker will be transferred to the timelock once the contract deployed.
 *
 * Q: Why don't we just burn the liquidity or lock the liquidity on other platforms?
 * A: If there is an upgrade on some AMM that Bull user, we can migrate the liquidity to the new version exchange. 
 *
 */
contract BullLocker is Ownable {
    using SafeBEP20 for IBEP20;

    event Unlocked(address indexed token, address indexed recipient, uint256 amount);

    function unlock(IBEP20 _token, address _recipient) external onlyOwner{
        require(_recipient != address(0), "BullLocker::unlock: ZERO address.");

        uint256 amount = _token.balanceOf(address(this));
        _token.safeTransfer(_recipient, amount);
        emit Unlocked(address(_token), _recipient, amount);
    }
}