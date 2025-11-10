import { ethers } from 'hardhat';
import OnchainID from '@onchain-id/solidity';
import { Contract, Signer } from 'ethers';


const context = require('./deployed_'+hre.network.name+'.json')
// console.log("context:", context)

// deployed token via screateToken.ts

// const tokenAgent = {    // this is the corss contract address
//   EthereumTestnet: '0x398940dACa3b3Ab9c66f611ad596462f45397698',
//   PolygenAmoy:'0x5991A20A11A6bd359F428aA776506dF22615EFa1'
// }

const crossTos = {    // this is the token receive address
  EthereumTestnet: '0xe6372Ea3059119c9D03d5bB599e371B3bFB224b9',
  PolygenAmoy:'0x4115fb587533e37114A77fb2bE6B44d7983A6d35'
}


const commonAddress = "0xEf73Eaa714dC9a58B0990c40a01F4C0573599959"

const commonIdentity = {
  EthereumTestnet: '0xd477e702B3EbB30aFEcC689DbA1b8B1D85aF35bE',
  PolygenAmoy:'0x89Dc28Eb0fb6a181357a78B723d8d3BB659752C7'
} 

export async function deployIdentityProxy(implementationAuthority: Contract['address'], managementKey: string, signer: Signer) {
  const identity = await new ethers.ContractFactory(OnchainID.contracts.IdentityProxy.abi, OnchainID.contracts.IdentityProxy.bytecode, signer).deploy(
    implementationAuthority,
    managementKey,
  );
  await identity.deployTransaction.wait()
  await identity.deployed()
  return ethers.getContractAt('Identity', identity.address, signer);
}

async function main() {
  let tx
  const crossTo = crossTos[hre.network.name]
  const [deployer, tokenIssuer, tokenAgent, tokenAdmin, claimIssuer, aliceWallet, bobWallet, charlieWallet, platformAgentWallet, anotherWallet] =
  await ethers.getSigners();
  console.log("tokenAdmin:", tokenAdmin.address)

  let rwaToken = await ethers.getContractAt('Token', context.tokenAddress)

  // const commonIdentity = await deployIdentityProxy(context.authorities.identityImplementationAuthority, commonAddress, deployer) // tokenAdderss priv is holded by crossagent
  // console.log("commonIdentity:", commonIdentity.address)
  // return


  // 1. check if the cross target address has OID. If not, agent will create one for it
  let idResistry = await ethers.getContractAt('IdentityRegistry', await rwaToken.identityRegistry())
  let hasId = await idResistry.contains(crossTo)
  console.log("hasId:", hasId)

  if(!hasId) {
    // if the crossTo has NO ID, deploy one for it.
    // const crosstoIdentity = await deployIdentityProxy(context.authorities.identityImplementationAuthority, crossTo, tokenAdmin) // tokenAdderss priv is holded by crossagent
    tx = await idResistry.connect(tokenAdmin).registerIdentity(crossTo, commonIdentity[hre.network.name], 666) // 666 is country
    await tx.wait()
  }

}

main()