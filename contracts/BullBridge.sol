// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "./libs/SafeBEP20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./libs/IBEP20.sol";
import "./interfaces/IBullNFT.sol";

contract BullBridge is Ownable, Pausable {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    struct Order {
        uint256 id;
        uint8 tokenId;
        address from;
        address to;
        uint256 amount;
        uint256 chainId;
        bool completed;
    }

    struct Token {
        IBEP20 token;
        uint256 minTransfer;
        mapping(uint256 => bool) enabledChains;
        mapping(uint256 => uint256) bridgeBalances;
    }

    address public operator;
    uint16 public fee = 50; // 0.5%
    mapping(uint8 => Token) tokens;
    mapping(uint256 => Order) orders;
    address public treasury;
    uint256 nextOrderId = 0;
    // NFT address to manage boosts by BullNFTs
    IBullNFT public bullNFT;
    // NFT boostId
    uint256 theBigBull = 10;
    // History of bull token transfered by the user in the bridge
    mapping(address => uint256) bullTransfered;


    event UpdatedBalance(uint8 tokenId, uint256 amount);
    event CreatedCrossTransfer(uint256 orderId, uint8 tokenId, address indexed from, address indexed to, uint256 amount, uint256 chainId);
    event CompletedOrder(uint256 chainIdOrigin, uint256 orderId);

    modifier onlyOperator() {
        require(operator == msg.sender, "operator: caller is not the operator");
        _;
    }

    modifier onlyOwnerOrOperator() {
        require(operator == msg.sender || owner() == msg.sender, "operator: caller is not the operator");
        _;
    }

    modifier nonReentrant(uint8 _id){
        require(address(tokens[_id].token) == address(0), "reentrant error");
        _;
    }

    constructor() public {
        treasury = msg.sender;
        operator = msg.sender;
    }

    function addLiquidity(uint8 _tokenId, uint256 _amount) external onlyOwner{
        require(tokens[_tokenId].token.balanceOf(msg.sender) >= _amount, "Not enough balance");
        tokens[_tokenId].token.safeTransferFrom(msg.sender, address(this), _amount);
        emit UpdatedBalance(_tokenId, tokens[_tokenId].token.balanceOf(address(this)));
    }

    function addToken(uint8 _id, IBEP20 _token, uint256 _minTransfer, uint256[] memory _chains, uint256[] memory _balances) external onlyOwner nonReentrant(_id){
        require(_chains.length == _balances.length, "Amount of chains and balances should be the same");

        tokens[_id].token = _token;
        tokens[_id].minTransfer = _minTransfer;
        uint256 amountOfChains = _chains.length;

        for(uint256 x = 0; x < amountOfChains; x++){
            tokens[_id].enabledChains[_chains[x]] = true;
            tokens[_id].bridgeBalances[_chains[x]] = _balances[x];
        }
    }

    function createCrossTransfer(uint8 _tokenId, address _to, uint256 _amount, uint256 _chainId) external whenNotPaused{
        require(address(tokens[_tokenId].token) != address(0), "Token not supported");
        require(tokens[_tokenId].enabledChains[_chainId], "Destination chain not supported");
        require(tokens[_tokenId].bridgeBalances[_chainId] >= _amount, "Insufficient liquidity in destination chain");

        if(!bullNFT.hasBoost(msg.sender, theBigBull)){
            uint256 feeAmount = _amount.mul(fee).div(10000); 
            _amount = _amount.sub(feeAmount);
            tokens[_tokenId].token.safeTransferFrom(msg.sender, treasury, feeAmount);
        }

        tokens[_tokenId].token.safeTransferFrom(msg.sender, address(this), _amount);
        emit UpdatedBalance(_tokenId, tokens[_tokenId].token.balanceOf(address(this)));

        orders[nextOrderId] = Order (
            nextOrderId,
            _tokenId,
            msg.sender,
            _to,
            _amount,
            _chainId,
            false
        );

        emit CreatedCrossTransfer(nextOrderId, _tokenId, msg.sender, _to, _amount, _chainId);
        nextOrderId++;
        if(bullTransfered[msg.sender] < uint256(100000*10**18) && _tokenId == 0){
            bullTransfered[msg.sender] = bullTransfered[msg.sender].add(_amount);
            if(
                bullTransfered[msg.sender] >= uint256(100000*10**18) &&
                address(bullNFT) != address(0) && 
                bullNFT.canMint(theBigBull) &&
                bullNFT.getAuthorizedMiner(theBigBull) == address(this)
                ){
                    bullNFT.mint(theBigBull, msg.sender);
            }
        }
    }

    function completeCrossTransfer(uint8 _tokenId, address _to, uint256 _amount, uint256 _originChain, uint256 _orderId) external onlyOperator whenNotPaused{
        require(tokens[_tokenId].token.balanceOf(address(this)) >= _amount, "Insufficient balance");

        tokens[_tokenId].token.safeTransfer(_to, _amount);

        emit UpdatedBalance(_tokenId, tokens[_tokenId].token.balanceOf(address(this)));
        emit CompletedOrder(_originChain, _orderId);
    }

    function setCompleteOrder(uint256 _id) external onlyOperator whenNotPaused {
        require(orders[_id].completed == false, "Order already completed");
        require(_id < nextOrderId, "Invalid id");
        orders[_id].completed = true;
    }

    function updateBridgeTokenBalance(uint256 _chainId, uint8 _tokenId, uint256 _amount) external onlyOperator {
        tokens[_tokenId].bridgeBalances[_chainId] = _amount;
    }

    function updatefee(uint16 _fee) external onlyOwner{
        require(_fee <= 1000, "fee can't be more than 10%");
        fee = _fee;
    }

    function pause() external onlyOwnerOrOperator whenNotPaused {
        _pause();
    }

    // --------------- Owner functions ---------------

    function unpause() external onlyOwner whenPaused {
        _unpause();
    }

    function allowChain(uint8 _tokenId, uint256 _chainId) external onlyOwner{
        tokens[_tokenId].enabledChains[_chainId] = true;
    }

    function disableChain(uint8 _tokenId, uint256 _chainId) external onlyOwner{
        tokens[_tokenId].enabledChains[_chainId] = false;
    }

    function updateOperator(address _operator) external onlyOwner{
        operator = _operator;
    }

    function updateTreasury(address _treasury) external onlyOwner{
        treasury = _treasury;
    }

    function updateBullNFTContract(address _bullNFT) external onlyOwner {
        bullNFT = IBullNFT(_bullNFT);
    }
}