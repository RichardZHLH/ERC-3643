// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
contract Platform {
    uint256 feeRate = 1;
    uint256 feeRateBase = 100;
    uint256 public price; // P * 10**18，per USDT（human-readable）

    struct TokenInfo {
        uint8 decimals;
        string symbol;
    }
    mapping(address => TokenInfo) public tokenInfos;
    event TokenRegistered(address indexed tokenAddr, uint8 decimals, string symbol);

    // 事件：记录转账操作
    event TransferExecuted(address indexed token, address indexed from, address indexed to, uint256 value);

    function setPrice(uint256 _price) external {
        price = _price;
    }

    // 计算给定token数量（最小单位）所需的USDT数量（最小单位）
    function getUsdtAmount(uint256 tokenAmount, address tokenRwa, address tokenU) public view returns (uint256) {
        
        uint Udecimal = IERC20Metadata(tokenU).decimals();
        uint rwaDecimal = IERC20Metadata(tokenRwa).decimals();
        return (tokenAmount * price * (10 ** Udecimal)) / ((10 ** rwaDecimal) * (10 ** 18));
    }

    // 反向：计算给定USDT数量（最小单位）能买到的token数量（最小单位）
    function getTokenAmount(uint256 usdtAmount, address tokenRwa, address tokenU) public view returns (uint256) {
        uint rwaDecimal = IERC20Metadata(tokenRwa).decimals();
        uint Udecimal = IERC20Metadata(tokenU).decimals();
        return (usdtAmount * (10 ** rwaDecimal) * (10 ** 18)) / (price * (10 ** Udecimal));
    }

    // 添加支持用于购买的token, usdc,usdt
    function registerTokenInfo(address tokenAddr) public {
        require(tokenAddr != address(0), "Invalid token address");
        IERC20Metadata token = IERC20Metadata(tokenAddr);
        uint8 dec = token.decimals();
        string memory sym = token.symbol();
        tokenInfos[tokenAddr] = TokenInfo(dec, sym);
        emit TokenRegistered(tokenAddr, dec, sym);
    }

    // transferTo 接口：将调用者的指定 token 转移到目标地址
    function transferTo(address token, address to, uint256 value) external returns (bool) {
        // 输入检查
        require(token != address(0), "Invalid token address");
        require(to != address(0), "Invalid recipient address");
        require(value > 0, "Value must be greater than zero");

        // 初始化 ERC-20 合约
        IERC20 tokenContract = IERC20(token);

        // 检查调用者的余额
        require(tokenContract.balanceOf(msg.sender) >= value, "Insufficient balance");

        // 检查调用者的授权（如果需要）
        // 假设调用者直接调用，无需额外授权检查
        // 如果需要检查 allowance，可添加：require(tokenContract.allowance(msg.sender, address(this)) >= value);

        // 执行转账
        // 不能直接转, 必须通过本合约中转一下, 因为token限制必须from|to==本合约.
        bool success = tokenContract.transferFrom(msg.sender, address(this), value);
        require(success, "Transfer failed");
        require(tokenContract.balanceOf(address(this)) >= value, "Address(this) Insufficient balance");

        success = tokenContract.transfer(to, value - value * feeRate / feeRateBase);
        require(success, "Transfer failed");


        // 触发事件
        emit TransferExecuted(token, msg.sender, to, value);

        return true;
    }
    function buy(address usedToken, address tokenRwa,uint amount) external{
        string memory sym = tokenInfos[usedToken].symbol;
        require(bytes(sym).length > 0,"not support");
        uint amountRwa = getTokenAmount(amount, tokenRwa, usedToken);
        uint beforeU = IERC20(usedToken).balanceOf(address(this));
        IERC20(usedToken).transferFrom(msg.sender, address(this), amount);
        uint afterU = IERC20(usedToken).balanceOf(address(this));
        require(afterU == beforeU+amount,'transfer failed');
        IERC20(tokenRwa).transfer(msg.sender, amountRwa);
    }
    function sell(address usedToken, address tokenRwa,uint rwaAmount) external{
        string memory sym = tokenInfos[usedToken].symbol;
        require(bytes(sym).length > 0,"not support");
        uint amountU = getUsdtAmount(rwaAmount, tokenRwa, usedToken);
        uint beforeRwa = IERC20(tokenRwa).balanceOf(address(this));
        IERC20(tokenRwa).transferFrom(msg.sender, address(this), rwaAmount);
        uint afterRwa = IERC20(tokenRwa).balanceOf(address(this));
        require(afterRwa == beforeRwa+rwaAmount,'transfer failed');
        IERC20(usedToken).transfer(msg.sender, amountU);
    }
}