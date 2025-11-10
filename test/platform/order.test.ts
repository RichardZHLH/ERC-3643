import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import {deployPlatformFixture} from '../fixtures/deploy-platform.fixture'

async function deployOrderBook() {
  const [deployer, tokenIssuer, tokenAgent, tokenAdmin, claimIssuer, aliceWallet, bobWallet, charlieWallet, davidWallet, anotherWallet] =
    await ethers.getSigners();

  // Deploy implementations
  const orderBook = await ethers.deployContract('OrderBook', deployer);
  await orderBook.deployed()
  return orderBook
}

describe('platform - OrderBook', () => {
  describe('.placeOrder()', () => {
    describe('when the caller is the owner', () => {
      it('should add order', async () => {
        const {
          accounts: { aliceWallet },
          suite: { token },
          platform: { platform, feeToken },
        } = await loadFixture(deployPlatformFixture);
        console.log("platform:", token.address, feeToken.address)
        await token.connect(aliceWallet).approve(platform.address, 10)
        let tx = await platform.connect(aliceWallet).placeOrder(token.address, feeToken.address, 10, 10);
        console.log("tx:", tx)
      });
    });
  });

});
