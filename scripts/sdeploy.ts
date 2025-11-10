import { ethers } from 'hardhat';

import { Contract, Signer } from 'ethers';
import OnchainID from '@onchain-id/solidity';
import fs from 'fs'





export async function deployIdentityProxy(implementationAuthority: Contract['address'], managementKey: string, signer: Signer) {
  const identity = await new ethers.ContractFactory(OnchainID.contracts.IdentityProxy.abi, OnchainID.contracts.IdentityProxy.bytecode, signer).deploy(
    implementationAuthority,
    managementKey,
  );
  await identity.deployTransaction.wait()
  await identity.deployed()
  return ethers.getContractAt('Identity', identity.address, signer);
}


export async function deployFullSuiteFixture() {
  const [deployer, tokenIssuer, tokenAgent, tokenAdmin, claimIssuer, aliceWallet, bobWallet, charlieWallet, platformAgentWallet, anotherWallet] =
    await ethers.getSigners();
  console.log("deployer:", deployer.address)
  const claimIssuerSigningKey = ethers.Wallet.createRandom();
  const aliceActionKey = ethers.Wallet.createRandom();
  let tx

  // Deploy implementations
  const claimTopicsRegistryImplementation = await ethers.deployContract('ClaimTopicsRegistry', deployer);
  await claimTopicsRegistryImplementation.deployed()
  const trustedIssuersRegistryImplementation = await ethers.deployContract('TrustedIssuersRegistry', deployer);
  await trustedIssuersRegistryImplementation.deployed()
  const identityRegistryStorageImplementation = await ethers.deployContract('IdentityRegistryStorage', deployer);
  await identityRegistryStorageImplementation.deployed()
  const identityRegistryImplementation = await ethers.deployContract('IdentityRegistry', deployer);
  await identityRegistryImplementation.deployed()
  const modularComplianceImplementation = await ethers.deployContract('ModularCompliance', deployer);
  await modularComplianceImplementation.deployed()
  const tokenImplementation = await ethers.deployContract('Token', deployer);
  await tokenImplementation.deployed()
  const identityImplementation = await new ethers.ContractFactory(
    OnchainID.contracts.Identity.abi,
    OnchainID.contracts.Identity.bytecode,
    deployer,
  ).deploy(deployer.address, true);
  await identityImplementation.deployed()

  const identityImplementationAuthority = await new ethers.ContractFactory(
    OnchainID.contracts.ImplementationAuthority.abi,
    OnchainID.contracts.ImplementationAuthority.bytecode,
    deployer,
  ).deploy(identityImplementation.address);
  await identityImplementationAuthority.deployed()

  const identityFactory = await new ethers.ContractFactory(OnchainID.contracts.Factory.abi, OnchainID.contracts.Factory.bytecode, deployer).deploy(
    identityImplementationAuthority.address,
  );
  await identityFactory.deployed()
  const trexImplementationAuthority = await ethers.deployContract(
    'TREXImplementationAuthority',
    [true, ethers.constants.AddressZero, ethers.constants.AddressZero],
    deployer,
  );
  await trexImplementationAuthority.deployed()
  const versionStruct = {
    major: 4,
    minor: 0,
    patch: 0,
  };
  const contractsStruct = {
    tokenImplementation: tokenImplementation.address,
    ctrImplementation: claimTopicsRegistryImplementation.address,
    irImplementation: identityRegistryImplementation.address,
    irsImplementation: identityRegistryStorageImplementation.address,
    tirImplementation: trustedIssuersRegistryImplementation.address,
    mcImplementation: modularComplianceImplementation.address,
  };
  tx = await trexImplementationAuthority.connect(deployer).addAndUseTREXVersion(versionStruct, contractsStruct);
  await tx.wait()
  const trexFactory = await ethers.deployContract('TREXFactory', [trexImplementationAuthority.address, identityFactory.address], deployer);
  await trexFactory.deployed()
  tx = await identityFactory.connect(deployer).addTokenFactory(trexFactory.address);
  await tx.wait()
  const claimTopicsRegistry = await ethers
    .deployContract('ClaimTopicsRegistryProxy', [trexImplementationAuthority.address], deployer)
    .then(async (proxy)=>proxy.deployed())
    .then(async (proxy) => ethers.getContractAt('ClaimTopicsRegistry', proxy.address));

  const trustedIssuersRegistry = await ethers
    .deployContract('TrustedIssuersRegistryProxy', [trexImplementationAuthority.address], deployer)
    .then(async (proxy)=>proxy.deployed())
    .then(async (proxy) => ethers.getContractAt('TrustedIssuersRegistry', proxy.address));

  const identityRegistryStorage = await ethers
    .deployContract('IdentityRegistryStorageProxy', [trexImplementationAuthority.address], deployer)
    .then(async (proxy)=>proxy.deployed())
    .then(async (proxy) => ethers.getContractAt('IdentityRegistryStorage', proxy.address));

  const defaultCompliance = await ethers.deployContract('DefaultCompliance', deployer);
  await defaultCompliance.deployed()
  const identityRegistry = await ethers
    .deployContract(
      'IdentityRegistryProxy',
      [trexImplementationAuthority.address, trustedIssuersRegistry.address, claimTopicsRegistry.address, identityRegistryStorage.address],
      deployer,
    )
    .then(async (proxy)=>proxy.deployed())
    .then(async (proxy) => ethers.getContractAt('IdentityRegistry', proxy.address));
    
  tx = await identityRegistryStorage.connect(deployer).bindIdentityRegistry(identityRegistry.address);
  await tx.wait()

  return {
    accounts: {
      deployer,
      tokenIssuer,
      tokenAgent,
      tokenAdmin,
      claimIssuer,
      claimIssuerSigningKey,
      aliceActionKey,
      aliceWallet,
      bobWallet,
      charlieWallet,
      platformAgentWallet,
      anotherWallet,
    },
    suite: {
      claimIssuerContract:{},
      claimTopicsRegistry,
      trustedIssuersRegistry,
      identityRegistryStorage,
      defaultCompliance,
      identityRegistry,
    },
    authorities: {
      trexImplementationAuthority,
      identityImplementationAuthority,
    },
    factories: {
      trexFactory,
      identityFactory,
    },
    implementations: {
      identityImplementation,
      claimTopicsRegistryImplementation,
      trustedIssuersRegistryImplementation,
      identityRegistryStorageImplementation,
      identityRegistryImplementation,
      modularComplianceImplementation,
      tokenImplementation,
    },
  };
}

async function saveContractAddresses(cs:any) {
  let rec = {
    suite:{
      claimIssuerContract: cs.suite.claimIssuerContract.address,
      claimTopicsRegistry: cs.suite.claimTopicsRegistry.address,
      trustedIssuersRegistry: cs.suite.trustedIssuersRegistry.address,
      identityRegistryStorage: cs.suite.identityRegistryStorage.address,
      defaultCompliance: cs.suite.defaultCompliance.address,
      identityRegistry: cs.suite.identityRegistry.address,
    },
    authorities:{
      trexImplementationAuthority: cs.authorities.trexImplementationAuthority.address,
      identityImplementationAuthority: cs.authorities.identityImplementationAuthority.address,
    },
    factories:{
      trexFactory: cs.factories.trexFactory.address,
      identityFactory: cs.factories.identityFactory.address,
    },
    implementations:{
      identityImplementation: cs.implementations.identityImplementation.address,
      claimTopicsRegistryImplementation: cs.implementations.claimTopicsRegistryImplementation.address,
      trustedIssuersRegistryImplementation: cs.implementations.trustedIssuersRegistryImplementation.address,
      identityRegistryStorageImplementation: cs.implementations.identityRegistryStorageImplementation.address,
      identityRegistryImplementation: cs.implementations.identityRegistryImplementation.address,
      modularComplianceImplementation: cs.implementations.modularComplianceImplementation.address,
      tokenImplementation: cs.implementations.tokenImplementation.address,
    },
  }
  fs.writeFileSync('./scripts/deployed_'+hre.network.name+'.json', JSON.stringify(rec,null,2))
}
async function main() {
  const context = await deployFullSuiteFixture();
  saveContractAddresses(context)
}

main()

