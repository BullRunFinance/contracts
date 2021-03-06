// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "./interfaces/IBullNFT.sol";
import "./libs/BEP20.sol";
import "./BullGovernance.sol";

/** 
 *   @dev Main token of the protocol. Auto liquidity and burn. 
 *   In each transaction it charges a fee (by default 5%) for the formation of new LP tokens and to burn a part of bull.
 */

// BullToken with Governance.
contract BullToken is BEP20, BullGovernance {
    using SafeMath for uint256;

    // Transfer tax rate in basis points. (default 5%)
    uint16 public transferTaxRate = 500;
    // Burn rate % of transfer tax. (default 20% x 5% = 1% of total amount).
    uint16 public burnRate = 20;
    // Max transfer tax rate: 10%.
    uint16 public constant MAXIMUM_TRANSFER_TAX_RATE = 1000;
    // Burn address
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // Max balance amount rate in basis points. (default is 0.5% of total supply)
    uint16 public maxBalanceAmountRate = 50;
    // Addresses that excluded from antiWhale
    mapping(address => bool) private _excludedFromAntiWhale;
    // Addresses that excluded from antiWhale
    mapping(address => bool) private _excludedFromTax;
    // Automatic swap and liquify enabled
    bool public swapAndLiquifyEnabled = false;
    // Min amount to liquify. (default 500 BULLs)
    uint256 public minAmountToLiquify = 500 ether;
    // The swap router, modifiable
    IUniswapV2Router02 public bullFinanceRouter;
    // LP Locker
    address public lpLocker;
    // The trading pair
    address public bullFinancePair;
    // In swap and liquify
    bool private _inSwapAndLiquify;
    // The operator can only update the transfer tax rate
    address public operator;
    // NFT address to manage boosts by BullNFTs
    IBullNFT public bullNFT;
    // NFT boostIds
    uint256 constant goldenBull = 1;
    uint256 constant silverBull = 2;
    uint256 constant bronzeBull = 3;

    // Events
    event OperatorTransferred(address indexed previousOperator, address indexed newOperator);
    event TransferTaxRateUpdated(address indexed operator, uint256 previousRate, uint256 newRate);
    event BurnRateUpdated(address indexed operator, uint256 previousRate, uint256 newRate);
    event maxBalanceAmountRateUpdated(address indexed operator, uint256 previousRate, uint256 newRate);
    event SwapAndLiquifyEnabledUpdated(address indexed operator, bool enabled);
    event MinAmountToLiquifyUpdated(address indexed operator, uint256 previousAmount, uint256 newAmount);
    event BullFinanceRouterUpdated(address indexed operator, address indexed router, address indexed pair);
    event SwapAndLiquify(uint256 tokensSwapped, uint256 ethReceived, uint256 tokensIntoLiqudity);

    modifier onlyOperator() {
        require(operator == msg.sender, "operator: caller is not the operator");
        _;
    }

    modifier antiWhale(address sender, address recipient, uint256 amount) {
        if (maxBalanceAmount() > 0) {
            if (
                _excludedFromAntiWhale[recipient] == false && sender != owner()
            ) {
                require(balanceOf(recipient).add(amount) <= maxBalanceAmount(), "BULL::antiWhale: Transfer would exceed the maxBalanceAmount of the recipient");
            }
        }
        _;
    }

    modifier lockTheSwap {
        _inSwapAndLiquify = true;
        _;
        _inSwapAndLiquify = false;
    }

    modifier transferTaxFree {
        uint16 _transferTaxRate = transferTaxRate;
        transferTaxRate = 0;
        _;
        transferTaxRate = _transferTaxRate;
    }

    constructor() BEP20("BullRun Token", "BULL") BullGovernance(address(this)) {
        operator = _msgSender();
        lpLocker = _msgSender();
        emit OperatorTransferred(address(0), operator);

        _excludedFromAntiWhale[msg.sender] = true;
        _excludedFromAntiWhale[address(0)] = true;
        _excludedFromAntiWhale[address(this)] = true;
        _excludedFromAntiWhale[BURN_ADDRESS] = true;
        _excludedFromTax[msg.sender] = true;
    }

    /// @dev Creates `_amount` token to `_to`. Must only be called by the owner (MasterChef).
    function mint(address _to, uint256 _amount) external onlyOwner {
        _mint(_to, _amount);
        _moveDelegates(address(0), _delegates[_to], _amount);
    }

    function getTransferTax(address _sender, address _recipient) public view returns(uint256){
        uint256 userTransferTaxRate = transferTaxRate;
        // if the NFT contract are defined and the sender o receiver has some of this nfts, it has a discount in transfer tax
        if(address(bullNFT) != address(0)){
            if(bullNFT.hasBoost(_sender, goldenBull) || bullNFT.hasBoost(_recipient, goldenBull)){
                userTransferTaxRate = userTransferTaxRate.sub(userTransferTaxRate.mul(bullNFT.getBonus(goldenBull)).div(10000));
            }else if(bullNFT.hasBoost(_sender, silverBull) || bullNFT.hasBoost(_recipient, silverBull)){
                userTransferTaxRate = userTransferTaxRate.sub(userTransferTaxRate.mul(bullNFT.getBonus(silverBull)).div(10000));
            }else if(bullNFT.hasBoost(_sender, bronzeBull) || bullNFT.hasBoost(_recipient, bronzeBull)){
                userTransferTaxRate = userTransferTaxRate.sub(userTransferTaxRate.mul(bullNFT.getBonus(bronzeBull)).div(10000));
            }
        }
        return userTransferTaxRate;
    }

    /// @dev overrides transfer function to meet tokenomics of BULL
    function _transfer(address sender, address recipient, uint256 amount) internal virtual override antiWhale(sender, recipient, amount) {
        // swap and liquify
        if (
            swapAndLiquifyEnabled
            && !_inSwapAndLiquify
            && address(bullFinanceRouter) != address(0)
            && bullFinancePair != address(0)
            && sender != bullFinancePair
            && sender != owner()
        ) {
            swapAndLiquify();
        }

        if (recipient == BURN_ADDRESS || transferTaxRate == 0 || _excludedFromTax[sender] || _excludedFromTax[recipient]) {
            super._transfer(sender, recipient, amount);
        } else {
            uint256 userTransferTaxRate = getTransferTax(sender, recipient);

            // default tax is 5% of every transfer
            uint256 taxAmount = amount.mul(userTransferTaxRate).div(10000);
            uint256 burnAmount = taxAmount.mul(burnRate).div(100);
            uint256 liquidityAmount = taxAmount.sub(burnAmount);

            // default 95% of transfer sent to recipient
            uint256 sendAmount = amount.sub(taxAmount);

            super._transfer(sender, BURN_ADDRESS, burnAmount);
            super._transfer(sender, address(this), liquidityAmount);
            super._transfer(sender, recipient, sendAmount);
            amount = sendAmount;
        }
    }

    /// @dev Swap and liquify
    function swapAndLiquify() private lockTheSwap transferTaxFree {
        uint256 contractTokenBalance = balanceOf(address(this));
        uint256 maxBalanceAmount = maxBalanceAmount();
        contractTokenBalance = contractTokenBalance > maxBalanceAmount ? maxBalanceAmount : contractTokenBalance;

        if (contractTokenBalance >= minAmountToLiquify) {
            // only min amount to liquify
            uint256 liquifyAmount = minAmountToLiquify;

            // split the liquify amount into halves
            uint256 half = liquifyAmount.div(2);
            uint256 otherHalf = liquifyAmount.sub(half);

            // capture the contract's current ETH balance.
            // this is so that we can capture exactly the amount of ETH that the
            // swap creates, and not make the liquidity event include any ETH that
            // has been manually sent to the contract
            uint256 initialBalance = address(this).balance;

            // swap tokens for ETH
            swapTokensForEth(half);

            // how much ETH did we just swap into?
            uint256 newBalance = address(this).balance.sub(initialBalance);

            // add liquidity
            addLiquidity(otherHalf, newBalance);

            emit SwapAndLiquify(half, newBalance, otherHalf);
        }
    }

    /// @dev Swap tokens for eth
    function swapTokensForEth(uint256 tokenAmount) private {
        // generate the bullFinance pair path of token -> weth
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = bullFinanceRouter.WETH();

        _approve(address(this), address(bullFinanceRouter), tokenAmount);

        // make the swap
        bullFinanceRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0, // accept any amount of ETH
            path,
            address(this),
            block.timestamp
        );
    }

    /// @dev Add liquidity
    function addLiquidity(uint256 tokenAmount, uint256 ethAmount) private {
        // approve token transfer to cover all possible scenarios
        _approve(address(this), address(bullFinanceRouter), tokenAmount);

        // add the liquidity
        bullFinanceRouter.addLiquidityETH{value: ethAmount}(
            address(this),
            tokenAmount,
            0, // slippage is unavoidable
            0, // slippage is unavoidable
            lpLocker,
            block.timestamp
        );
    }

    /**
     * @dev Returns the max transfer amount.
     */
    function maxBalanceAmount() public view returns (uint256) {
        return totalSupply().mul(maxBalanceAmountRate).div(10000);
    }

    /**
     * @dev Returns the address is excluded from antiWhale or not.
     */
    function isExcludedFromAntiWhale(address _account) external view returns (bool) {
        return _excludedFromAntiWhale[_account];
    }

    /**
     * @dev Returns the address is excluded from tax or not.
     */
    function isExcludedFromTax(address _account) external view returns (bool) {
        return _excludedFromTax[_account];
    }

    // To receive BNB from bullFinanceRouter when swapping
    receive() external payable {}

    /**
     * @dev Update the transfer tax rate.
     * Can only be called by the current operator.
     */
    function updateTransferTaxRate(uint16 _transferTaxRate) external onlyOperator {
        require(_transferTaxRate <= MAXIMUM_TRANSFER_TAX_RATE, "BULL::updateTransferTaxRate: Transfer tax rate must not exceed the maximum rate.");
        emit TransferTaxRateUpdated(msg.sender, transferTaxRate, _transferTaxRate);
        transferTaxRate = _transferTaxRate;
    }

    /**
     * @dev Update the burn rate.
     * Can only be called by the current operator.
     */
    function updateBurnRate(uint16 _burnRate) external onlyOperator {
        require(_burnRate <= 100, "BULL::updateBurnRate: Burn rate must not exceed the maximum rate.");
        emit BurnRateUpdated(msg.sender, burnRate, _burnRate);
        burnRate = _burnRate;
    }

    /**
     * @dev Update the max balance amount rate.
     * Can only be called by the current operator.
     */
    function updatemaxBalanceAmountRate(uint16 _maxBalanceAmountRate) external onlyOperator {
        require(_maxBalanceAmountRate <= 10000, "BULL::updatemaxBalanceAmountRate: Max transfer amount rate must not exceed the maximum rate.");
        emit maxBalanceAmountRateUpdated(msg.sender, maxBalanceAmountRate, _maxBalanceAmountRate);
        maxBalanceAmountRate = _maxBalanceAmountRate;
    }

    /**
     * @dev Update the min amount to liquify.
     * Can only be called by the current operator.
     */
    function updateMinAmountToLiquify(uint256 _minAmount) external onlyOperator {
        emit MinAmountToLiquifyUpdated(msg.sender, minAmountToLiquify, _minAmount);
        minAmountToLiquify = _minAmount;
    }

    /**
     * @dev Exclude or include an address from antiWhale.
     * Can only be called by the current operator.
     */
    function setExcludedFromAntiWhale(address _account, bool _excluded) external onlyOperator {
        _excludedFromAntiWhale[_account] = _excluded;
    }

    /**
     * @dev Exclude or include an address from tax.
     * Can only be called by the current operator.
     */
    function setExcludedFromTax(address _account, bool _excluded) external onlyOperator {
        _excludedFromTax[_account] = _excluded;
    }

    /**
     * @dev Update the swapAndLiquifyEnabled.
     * Can only be called by the current operator.
     */
    function updateSwapAndLiquifyEnabled(bool _enabled) external onlyOperator {
        emit SwapAndLiquifyEnabledUpdated(msg.sender, _enabled);
        swapAndLiquifyEnabled = _enabled;
    }

    /**
     * @dev Update the swap router.
     * Can only be called by the current operator.
     */
    function updateBullFinanceRouter(address _router) external onlyOperator {
        bullFinanceRouter = IUniswapV2Router02(_router);
        bullFinancePair = IUniswapV2Factory(bullFinanceRouter.factory()).getPair(address(this), bullFinanceRouter.WETH());
        require(bullFinancePair != address(0), "BULL::updateBullFinanceRouter: Invalid pair address.");
        emit BullFinanceRouterUpdated(msg.sender, address(bullFinanceRouter), bullFinancePair);
    }

    /**
     * @dev Update the NFT contract.
     * Can only be called by the current operator.
     */
    function updateBullNFTContract(address _bullNFT) external onlyOperator {
        bullNFT = IBullNFT(_bullNFT);
    }

    /**
     * @dev Update the lpLocker.
     * Can only be called by the current operator.
     */
    function updateLpLocker(address _lpLocker) external onlyOperator {
        lpLocker = _lpLocker;
    }

    /**
     * @dev Transfers operator of the contract to a new account (`newOperator`).
     * Can only be called by the current operator.
     */
    function transferOperator(address newOperator) public onlyOperator {
        require(newOperator != address(0), "BULL::transferOperator: new operator is the zero address");
        emit OperatorTransferred(operator, newOperator);
        operator = newOperator;
    }
}
