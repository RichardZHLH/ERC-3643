// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract OrderBook is ReentrancyGuard, Ownable {
    struct Order {
        address seller;
        uint256 price;       // 每单位价格 (e.g., in paymentToken)
        uint256 quantity;    // 总数量
        address sellToken;   // 卖出资产 (ERC20)
        address paymentToken; // 支付资产 (固定平台代币)
        uint256 orderId;
        uint256 status;
    }


    mapping(uint256 => Order) public orders;
    uint256 public nextOrderId = 1;
    // Order[] public orderList;  // 支持搜索迭代
    mapping(address => Order[]) public orderList;

    event OrderPlaced(uint256 indexed orderId, address indexed seller, uint256 price, uint256 quantity, address sellToken);
    event OrderFilled(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 totalPrice);
    event OrderCanceled(uint256 indexed orderId);


    // 卖家挂单：锁定sellToken
    function placeOrder(address sellToken, address paymentToken, uint256 price, uint256 quantity) external nonReentrant {
        require(sellToken != address(0), "Invalid sell token");
        require(price > 0 && quantity > 0, "Invalid price or quantity");
        require(IERC20(sellToken).transferFrom(msg.sender, address(this), quantity), "Transfer failed");

        uint256 id = nextOrderId++;
        orders[id] = Order({
            seller: msg.sender,
            price: price,
            quantity: quantity,
            sellToken: sellToken,
            paymentToken: paymentToken,
            orderId: id,
            status: 1
        });
        orderList[sellToken].push(orders[id]);

        emit OrderPlaced(id, msg.sender, price, quantity, sellToken);
    }

    // 分页搜索活跃订单：基于订单索引范围迭代
    function searchOrders(uint256 minPrice, uint256 maxPrice, address sellToken, uint256 firstIndex, uint256 endIndex) 
        external view returns (uint256[] memory)
    {
        require(firstIndex <= endIndex && firstIndex < orderList[sellToken].length, "Invalid index range");
        require(endIndex <= orderList[sellToken].length, "End index out of bounds");

        // 预分配结果数组为迭代范围大小（上限）
        uint256 iterSize = endIndex - firstIndex;
        uint256[] memory results = new uint256[](iterSize);
        uint256 count = 0;

        // 只迭代指定范围
        for (uint256 i = firstIndex; i < endIndex; i++) {
            Order storage order = orderList[sellToken][i];
            if (order.status==1 &&
                order.price >= minPrice && order.price <= maxPrice &&
                (sellToken == address(0) || order.sellToken == sellToken)) {
                results[count] = order.orderId;
                count++;
            }
        }
        
        // 截断数组到实际 count
        assembly { mstore(results, count) }
        
        return results;
    }

    // 买家成交：全额支付，全额获取
    function buyOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.status==1, "Order not active");
        require(order.seller != msg.sender, "Seller cannot buy own order");
        uint256 totalPrice = order.price * order.quantity;
        require(totalPrice > 0, "Invalid total price");

        // 买家支付到卖家

        require(IERC20(order.paymentToken).transferFrom(msg.sender, order.seller, totalPrice), "Payment failed");
        // 卖家资产释放到买家
        require(IERC20(order.sellToken).transfer(msg.sender, order.quantity), "Asset transfer failed");

        order.status = 2;

        emit OrderFilled(orderId, msg.sender, order.seller, totalPrice);
    }

    // 管理员取消挂单 (可选)
    function cancelOrder(uint256 orderId) external onlyOwner {
        Order storage order = orders[orderId];
        require(order.status==1, "Order not active");
        require(IERC20(order.sellToken).transfer(order.seller, order.quantity), "Refund failed");
        order.status = 3;
        emit OrderCanceled(orderId);
    }
}