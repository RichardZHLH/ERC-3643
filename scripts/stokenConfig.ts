import { ethers } from 'hardhat';


const context = require('./deployed_'+hre.network.name+'.json')

const tokenAgent_address = {    // this is the corss contract address
  EthereumTestnet: '0x398940dACa3b3Ab9c66f611ad596462f45397698',
  PolygenAmoy:'0x5991A20A11A6bd359F428aA776506dF22615EFa1'
}

async function main() {
  let tx
  const [deployer, tokenIssuer, tokenAgent, tokenAdmin, claimIssuer, aliceWallet, bobWallet, charlieWallet, platformAgentWallet, anotherWallet] =
  await ethers.getSigners();
  console.log("deployer:", deployer.address)

  let tokenAddress = context.tokenAddress
  let rwaToken = await ethers.getContractAt('Token', tokenAddress)
  // console.log("sym:", await rwaToken.symbol())
  // console.log("name:", await rwaToken.name())
  // console.log("decimal:", await rwaToken.decimals())

  // tx = await rwaToken.connect(deployer).addAgent(tokenAdmin.address)
  // await tx.wait()

  
  // tx = await rwaToken.connect(deployer).addAgent(tokenAgent_address[hre.network.name])
  // await tx.wait()

  // let identityRegistry = await ethers.getContractAt('IdentityRegistry', await rwaToken.identityRegistry())
  // tx = await identityRegistry.connect(deployer).addAgent(tokenAdmin.address);
  // await tx.wait()


  // add agent for manual
  const manualAddr = '0xD88a4aC8Afb44310d185c47DD94F853CaE94Ec89'
  tx = await rwaToken.connect(deployer).addAgent(manualAddr)
  await tx.wait()
  let identityRegistry = await ethers.getContractAt('IdentityRegistry', await rwaToken.identityRegistry())
  tx = await identityRegistry.connect(deployer).addAgent(manualAddr);
  await tx.wait()
}

main()