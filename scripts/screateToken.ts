import { ethers } from 'hardhat';
import fs from 'fs'


const context = require('./deployed_'+hre.network.name+'.json')



async function main() {
  let tx
  const [deployer, tokenIssuer, tokenAgent, tokenAdmin, claimIssuer, aliceWallet, bobWallet, charlieWallet, platformAgentWallet, anotherWallet] =
  await ethers.getSigners();
  console.log("deployer:", deployer.address)

  let tfac = await ethers.getContractAt('TREXFactory', context.factories.trexFactory)
  console.log("tfac owner:", await tfac.owner())

  // 按照gateway合约的方式, salt根据deployer和token_name计算. 同一个名字不能由同一个地址重复部署.
  let salt = "0xxxx111111111111111111111111111119"
  tx = await tfac.connect(deployer).deployTREXSuite(salt,
    {
      owner: deployer.address,
      name: 'SYMTN',
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
  let rec = await tx.wait()
  // console.log("rec:", rec)

  let tokenAddress = ""
  rec.events?.map(item=>{
    if(item.event && item.event =='TREXSuiteDeployed') {
      tokenAddress = item.args[0]
    }
  })
  console.log("tokenAddress:", tokenAddress)
  context.tokenAddress = tokenAddress

  fs.writeFileSync('./scripts/deployed_'+hre.network.name+'.json', JSON.stringify(context,null,2))

}

main()