import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import {deployFullSuiteFixture} from './deploy-full-suite.fixture'
import OnchainID from '@onchain-id/solidity';
import { BigNumber, Contract, Signer } from 'ethers';


// const claimTopics = [ethers.utils.id('IS_GIRL'), ethers.utils.id('IS_BOY')];
const claimTopics = [ethers.utils.id('CLAIM_TOPIC')];

export async function deployIdentityProxy(implementationAuthority: Contract['address'], managementKey: string, signer: Signer) {
  const identity = await new ethers.ContractFactory(OnchainID.contracts.IdentityProxy.abi, OnchainID.contracts.IdentityProxy.bytecode, signer).deploy(
    implementationAuthority,
    managementKey,
  );
  await identity.deployTransaction.wait()
  await identity.deployed()
  return ethers.getContractAt('Identity', identity.address, signer);
}

// eslint-disable-next-line import/prefer-default-export
export async function deployPlatformFixture() {

  const context = await loadFixture(deployFullSuiteFixture);
  let platformAgentWallet = context.accounts.davidWallet;
  let deployer = context.accounts.deployer;
  let aliceWallet = context.accounts.aliceWallet;

  // const orderBook = await ethers.deployContract('OrderBook', deployer);
  // await orderBook.deployed()
  const feeToken = await ethers.deployContract('TestERC20', ['FeeToken', 'FT']);
  await feeToken.deployed()
  const platform = await ethers.deployContract('Platform', deployer);
  await platform.deployed()
  let tx

      // deploy set Platform OID
      let identityRegistry = context.suite.identityRegistry
      const platformIdentity = await deployIdentityProxy(context.authorities.identityImplementationAuthority.address, platformAgentWallet.address, context.accounts.deployer);
      await identityRegistry
        .connect(context.accounts.tokenAgent)
        .registerIdentity(platform.address, platformIdentity.address, 666);
    
      const claimForPlatform = {
        data: ethers.utils.hexlify(ethers.utils.toUtf8Bytes('This is a girl.')),
        issuer: context.suite.claimIssuerContract.address,
        topic: claimTopics[0],
        scheme: 1,
        identity: platformIdentity.address,
        signature: '',
      };
      claimForPlatform.signature = await context.accounts.claimIssuerSigningKey.signMessage(
        ethers.utils.arrayify(
          ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(['address', 'uint256', 'bytes'], [claimForPlatform.identity, claimForPlatform.topic, claimForPlatform.data]),
          ),
        ),
      );
    
      // tx = await platformIdentity.connect(context.accounts.platformAgentWallet)
      // .addKey(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['address'], [context.accounts.platformAgentWallet.address])), 3, 1);
      tx = await platformIdentity
        .connect(platformAgentWallet)
        .addClaim(claimForPlatform.topic, claimForPlatform.scheme, claimForPlatform.issuer, claimForPlatform.signature, claimForPlatform.data, '');
      await tx.wait()
  
      // test
      await context.suite.token.connect(context.accounts.tokenAgent).mint(platform.address, 1000);
      await context.suite.token.connect(context.accounts.tokenAgent).mint(aliceWallet.address, 1000);


  let platContext = Object.assign({},context) as any
  platContext.platform = {
    feeToken,platform,
  }

  return platContext;
}
