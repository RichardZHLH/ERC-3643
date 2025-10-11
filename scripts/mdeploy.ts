import { ethers } from 'hardhat';

import { BigNumber, Contract, Signer } from 'ethers';
import OnchainID from '@onchain-id/solidity';
import fs from 'fs'


const claimTopics = [ethers.utils.id('IS_GIRL'), ethers.utils.id('IS_BOY')];



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
  const claimIssuerSigningKey = ethers.Wallet.createRandom();
  const aliceActionKey = ethers.Wallet.createRandom();
  let tx

  // Deploy implementations
  const claimTopicsRegistryImplementation = await ethers.deployContract('ClaimTopicsRegistry', deployer);
  const trustedIssuersRegistryImplementation = await ethers.deployContract('TrustedIssuersRegistry', deployer);
  const identityRegistryStorageImplementation = await ethers.deployContract('IdentityRegistryStorage', deployer);
  const identityRegistryImplementation = await ethers.deployContract('IdentityRegistry', deployer);
  const modularComplianceImplementation = await ethers.deployContract('ModularCompliance', deployer);
  const tokenImplementation = await ethers.deployContract('Token', deployer);
  const identityImplementation = await new ethers.ContractFactory(
    OnchainID.contracts.Identity.abi,
    OnchainID.contracts.Identity.bytecode,
    deployer,
  ).deploy(deployer.address, true);
  
  const identityImplementationAuthority = await new ethers.ContractFactory(
    OnchainID.contracts.ImplementationAuthority.abi,
    OnchainID.contracts.ImplementationAuthority.bytecode,
    deployer,
  ).deploy(identityImplementation.address);

  const identityFactory = await new ethers.ContractFactory(OnchainID.contracts.Factory.abi, OnchainID.contracts.Factory.bytecode, deployer).deploy(
    identityImplementationAuthority.address,
  );
  const trexImplementationAuthority = await ethers.deployContract(
    'TREXImplementationAuthority',
    [true, ethers.constants.AddressZero, ethers.constants.AddressZero],
    deployer,
  );
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
  tx = await identityFactory.connect(deployer).addTokenFactory(trexFactory.address);
  await tx.wait()

  const claimTopicsRegistry = await ethers
    .deployContract('ClaimTopicsRegistryProxy', [trexImplementationAuthority.address], deployer)
    .then(async (proxy) => ethers.getContractAt('ClaimTopicsRegistry', proxy.address));

  const trustedIssuersRegistry = await ethers
    .deployContract('TrustedIssuersRegistryProxy', [trexImplementationAuthority.address], deployer)
    .then(async (proxy) => ethers.getContractAt('TrustedIssuersRegistry', proxy.address));

  const identityRegistryStorage = await ethers
    .deployContract('IdentityRegistryStorageProxy', [trexImplementationAuthority.address], deployer)
    .then(async (proxy) => ethers.getContractAt('IdentityRegistryStorage', proxy.address));

  const defaultCompliance = await ethers.deployContract('DefaultCompliance', deployer);
  
  const identityRegistry = await ethers
    .deployContract(
      'IdentityRegistryProxy',
      [trexImplementationAuthority.address, trustedIssuersRegistry.address, claimTopicsRegistry.address, identityRegistryStorage.address],
      deployer,
    )
    .then(async (proxy) => ethers.getContractAt('IdentityRegistry', proxy.address));
  const tokenOID = await deployIdentityProxy(identityImplementationAuthority.address, tokenIssuer.address, deployer);
  await tokenOID.deployed()

  const tokenName = 'TEST3';
  const tokenSymbol = 'TST';
  const tokenDecimals = BigNumber.from('18');
  const token = await ethers
    .deployContract(
      'TokenProxy',
      [
        trexImplementationAuthority.address,
        identityRegistry.address,
        defaultCompliance.address,
        tokenName,
        tokenSymbol,
        tokenDecimals,
        tokenOID.address,
      ],
      deployer,
    )
    .then(async (proxy) => ethers.getContractAt('Token', proxy.address));
    
  tx = await identityRegistryStorage.connect(deployer).bindIdentityRegistry(identityRegistry.address);
  await tx.wait()

  tx = await token.connect(deployer).addAgent(tokenAgent.address);
  await tx.wait()

  tx = await claimTopicsRegistry.connect(deployer).addClaimTopic(claimTopics[0]);
  await tx.wait()
  // tx = await claimTopicsRegistry.connect(deployer).addClaimTopic(claimTopics[1]);
  // await tx.wait()

  const claimIssuerContract = await ethers.deployContract('ClaimIssuer', [claimIssuer.address], claimIssuer);
  await claimIssuerContract
    .connect(claimIssuer)
    .addKey(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['address'], [claimIssuerSigningKey.address])), 3, 1);

  await trustedIssuersRegistry.connect(deployer).addTrustedIssuer(claimIssuerContract.address, claimTopics);
  
  // deploy set alice OID
  const aliceIdentity = await deployIdentityProxy(identityImplementationAuthority.address, aliceWallet.address, deployer);
  await aliceIdentity
    .connect(aliceWallet)
    .addKey(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['address'], [aliceActionKey.address])), 2, 1);
  const bobIdentity = await deployIdentityProxy(identityImplementationAuthority.address, bobWallet.address, deployer);
  const charlieIdentity = await deployIdentityProxy(identityImplementationAuthority.address, charlieWallet.address, deployer);

  await identityRegistry.connect(deployer).addAgent(tokenAgent.address);
  tx = await identityRegistry.connect(deployer).addAgent(token.address);
  await tx.wait()
  await identityRegistry
    .connect(tokenAgent)
    .batchRegisterIdentity([aliceWallet.address, bobWallet.address, charlieWallet.address], 
      [aliceIdentity.address, bobIdentity.address, charlieIdentity.address], [42, 666, 666]);

  const claimForAlice = {
    data: ethers.utils.hexlify(ethers.utils.toUtf8Bytes('This is a girl.')),
    issuer: claimIssuerContract.address,
    topic: claimTopics[0],
    scheme: 1,
    identity: aliceIdentity.address,
    signature: '',
  };
  claimForAlice.signature = await claimIssuerSigningKey.signMessage(
    ethers.utils.arrayify(
      ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(['address', 'uint256', 'bytes'], [claimForAlice.identity, claimForAlice.topic, claimForAlice.data]),
      ),
    ),
  );

  tx = await aliceIdentity
    .connect(aliceWallet)
    .addClaim(claimForAlice.topic, claimForAlice.scheme, claimForAlice.issuer, claimForAlice.signature, claimForAlice.data, '');
  await tx.wait()

  // deploy set Charlie OID
  const claimForCharlie = {
    data: ethers.utils.hexlify(ethers.utils.toUtf8Bytes('This is a boy.')),
    issuer: claimIssuerContract.address,
    topic: claimTopics[0],
    scheme: 1,
    identity: charlieIdentity.address,
    signature: '',
  };
  claimForCharlie.signature = await claimIssuerSigningKey.signMessage(
    ethers.utils.arrayify(
      ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(['address', 'uint256', 'bytes'], [claimForCharlie.identity, claimForCharlie.topic, claimForCharlie.data]),
      ),
    ),
  );

  tx = await charlieIdentity
    .connect(charlieWallet)
    .addClaim(claimForCharlie.topic, claimForCharlie.scheme, claimForCharlie.issuer, claimForCharlie.signature, claimForCharlie.data, '');
  await tx.wait()

    // deploy set xxx OID
    const claimForBob = {
      data: ethers.utils.hexlify(ethers.utils.toUtf8Bytes('This is a boy.')),
      issuer: claimIssuerContract.address,
      topic: claimTopics[1],
      scheme: 1,
      identity: bobIdentity.address,
      signature: '',
    };
    claimForBob.signature = await claimIssuerSigningKey.signMessage(
      ethers.utils.arrayify(
        ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(['address', 'uint256', 'bytes'], [claimForBob.identity, claimForBob.topic, claimForBob.data]),
        ),
      ),
    );
  
    tx = await bobIdentity
      .connect(bobWallet)
      .addClaim(claimForBob.topic, claimForBob.scheme, claimForBob.issuer, claimForBob.signature, claimForBob.data, '');
    await tx.wait()

  await token.connect(tokenAgent).mint(aliceWallet.address, 1000);
  // await token.connect(tokenAgent).mint(bobWallet.address, 500);

  await token.connect(tokenAgent).unpause();

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
    identities: {
      aliceIdentity,
      bobIdentity,
      charlieIdentity,
    },
    suite: {
      claimIssuerContract,
      claimTopicsRegistry,
      trustedIssuersRegistry,
      identityRegistryStorage,
      defaultCompliance,
      identityRegistry,
      tokenOID,
      token,
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

async function saveContractAddresses(cs) {
  console.log("cs:", cs.suite.tokenOID.address)
  let rec = {
    identities: {
      aliceIdentity: cs.identities.aliceIdentity.address,
      bobIdentity: cs.identities.bobIdentity.address,
      charlieIdentity: cs.identities.charlieIdentity.address,
    },
    suite:{
      claimIssuerContract: cs.suite.claimIssuerContract.address,
      claimTopicsRegistry: cs.suite.claimTopicsRegistry.address,
      trustedIssuersRegistry: cs.suite.trustedIssuersRegistry.address,
      identityRegistryStorage: cs.suite.identityRegistryStorage.address,
      defaultCompliance: cs.suite.defaultCompliance.address,
      identityRegistry: cs.suite.identityRegistry.address,
      tokenOID: cs.suite.tokenOID.address,
      token: cs.suite.token.address,
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
    }
  }
  fs.writeFileSync('./scripts/deployed.json', JSON.stringify(rec,null,2))
}
async function main() {
  let tx
  const context = await deployFullSuiteFixture();

  
    const complianceProxy = await ethers.deployContract('ModularComplianceProxy', [context.authorities.trexImplementationAuthority.address]);
    const compliance = await ethers.getContractAt('ModularCompliance', complianceProxy.address);
  
    const platformModule = await ethers.deployContract('PlatformModule', context.accounts.deployer);
    await platformModule.initialize()
    await compliance.addModule(platformModule.address);
    await context.suite.token.setCompliance(compliance.address);


  let allAccounts = Object.values(context.accounts).map(item=>item.address)
  console.log("allAccounts:", allAccounts)

  tx = await context.factories.trexFactory.connect(context.accounts.deployer).deployTREXSuite(
    'salt',
    {
      owner: context.accounts.deployer.address,
      name: 'Token name',
      symbol: 'SYM',
      decimals: 8,
      irs: ethers.constants.AddressZero,
      ONCHAINID: ethers.constants.AddressZero,
      irAgents: [],
      tokenAgents: [],
      complianceModules: [],
      complianceSettings: [],
    },
    {
      claimTopics: [],
      issuers: [],
      issuerClaims: [],
    },
  );
  await tx.wait()
  console.log("tx factory deployTREXSuite:", tx)

  const gateway = await ethers.deployContract('TREXGateway', [context.factories.trexFactory.address, false], context.accounts.deployer);
  console.log("gateway:", gateway.address)

  await context.factories.trexFactory.transferOwnership(gateway.address);

  console.log("gateway factory:", await gateway.getFactory())
  tx = await gateway.setFactory(context.factories.trexFactory.address);
  await tx.wait()
  console.log("gateway factory:", await gateway.getFactory())

  saveContractAddresses(context)

  console.log("trexFactory owner:", await context.factories.trexFactory.owner())
  console.log("isDeployer:", await gateway.isDeployer(context.accounts.deployer.address))
  allAccounts.map(async item=>{console.log("isDeployer:", await gateway.isDeployer(item))})
  tx = await gateway.addDeployer(context.accounts.deployer.address);
  await tx.wait()

  tx = await gateway.connect(context.accounts.deployer).deployTREXSuite(
    {
      owner: context.accounts.deployer.address,
      name: 'Token name',
      symbol: 'SYM',
      decimals: 8,
      irs: ethers.constants.AddressZero,
      ONCHAINID: ethers.constants.AddressZero,
      irAgents: [],
      tokenAgents: [],
      complianceModules: [],
      complianceSettings: [],
    },
    {
      claimTopics: [],
      issuers: [],
      issuerClaims: [],
    },
  )
  console.log("tx:", tx)

  let Platform = await ethers.getContractFactory("Platform");
  let platform = await Platform.deploy();
  console.log("platform deployed to:", platform.address);
  console.log("platformModule owner:",  await platformModule.owner(), context.accounts.deployer.address)

  await platformModule.connect(context.accounts.deployer).setPlatform(platform.address);

    // deploy set Platform OID
    let identityRegistry = context.suite.identityRegistry
    let deployer = context.accounts.deployer
    const platformIdentity = await deployIdentityProxy(context.authorities.identityImplementationAuthority.address, context.accounts.platformAgentWallet.address, context.accounts.deployer);
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
      .connect(context.accounts.platformAgentWallet)
      .addClaim(claimForPlatform.topic, claimForPlatform.scheme, claimForPlatform.issuer, claimForPlatform.signature, claimForPlatform.data, '');
    await tx.wait()

    // test
    await context.suite.token.connect(context.accounts.tokenAgent).mint(platform.address, 1000);

    // don't allow transfer from token. must from platform
    // tx = await context.suite.token.connect(context.accounts.aliceWallet).transfer(context.accounts.charlieWallet.address, 100);
    // await tx.wait()

    let token = context.suite.token
    console.log("token balance of charlie:", await token.balanceOf(context.accounts.charlieWallet.address))
    await token.connect(context.accounts.aliceWallet).approve(platform.address, 100)
    await platform.connect(context.accounts.aliceWallet).transferTo(context.suite.token.address, context.accounts.charlieWallet.address,100)
    console.log("token balance2 of charlie:", await token.balanceOf(context.accounts.charlieWallet.address))

    console.log("Finished")


    
}

main()

