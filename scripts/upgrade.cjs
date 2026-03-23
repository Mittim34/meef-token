const { ethers, upgrades } = require("hardhat");

const PROXY_ADDRESS = "0x4273E52536dae638fe2D07601432C08B559D0f23";

async function main() {
  console.log("MEEF Token V2 Upgrade Basliyor...");

  const [deployer] = await ethers.getSigners();
  console.log("Upgrade eden:", deployer.address);

  const MEEFTokenV2 = await ethers.getContractFactory("MEEFTokenV2");

  console.log("Upgrade ediliyor...");
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, MEEFTokenV2, {
    kind: "uups",
    call: { fn: "initializeV2" }
  });

  await upgraded.waitForDeployment();

  const implAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);

  console.log("MEEF TOKEN V2 BASARIYLA UPGRADE EDILDI!");
  console.log("Proxy Adresi (ayni):", PROXY_ADDRESS);
  console.log("Yeni Implementation:", implAddress);
  console.log("Vergi orani: %1 (degistirilebilir)");
  console.log("Versiyon:", await upgraded.version());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Upgrade hatasi:", error);
    process.exit(1);
  });
