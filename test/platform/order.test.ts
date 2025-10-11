import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployFullSuiteFixture, deploySuiteWithModularCompliancesFixture } from '../fixtures/deploy-full-suite.fixture';

const USDT = '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9'
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
          suite: { token },
        } = await loadFixture(deployFullSuiteFixture);
        console.log("token:", token.address)
        let orderBook = await deployOrderBook();
        let tx = await orderBook.placeOrder(token.address, USDT, 10000, 10000);
        console.log("tx:", tx)
      });
    });
  });

});
