const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("==================================================");
  console.log("  MEEF Token Deploy Basliyor...");
  console.log("==================================================");

  const [deployer] = await ethers.getSigners();
  console.log("\nDeploy eden adres:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Bakiye:", ethers.formatEther(balance), "BNB\n");

  const MEEFToken = await ethers.getContractFactory("MEEFToken");

  console.log("UUPS Proxy ile deploy ediliyor...");
  const token = await upgrades.deployProxy(
    MEEFToken,
    [deployer.address, deployer.address],
    { initializer: "initialize", kind: "uups" }
  );

  await token.waitForDeployment();

  const proxyAddress = await token.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\n==================================================");
  console.log("  MEEF TOKEN BASARIYLA DEPLOY EDILDI!");
  console.log("==================================================");
  console.log("\nProxy Adresi (MetaMask'a bunu ekle):");
  console.log("  ", proxyAddress);
  console.log("\nImplementation Adresi:");
  console.log("  ", implAddress);
  console.log("\nToken Bilgileri:");
  console.log("  Ad: MEEF");
  console.log("  Sembol: MEEF");
  console.log("  Toplam Arz: 1,000,000,000 MEEF");
  console.log("  Islem Vergisi: %3");
  console.log("  Erken Satis Cezasi: %15 (ilk 7 gun)");
  console.log("  Anti-Whale: %1 cuzdan limiti");
  console.log("  Gunluk Satis Limiti: %10");
  console.log("  Sahip:", deployer.address);
  console.log("\n==================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deploy hatasi:", error);
    process.exit(1);
  });
