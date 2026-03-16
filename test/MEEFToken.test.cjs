const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("MEEF Token", function () {
  let token, owner, addr1, addr2, treasury;

  beforeEach(async function () {
    [owner, addr1, addr2, treasury] = await ethers.getSigners();
    const MEEFToken = await ethers.getContractFactory("MEEFToken");
    token = await upgrades.deployProxy(MEEFToken, [owner.address, treasury.address], {
      initializer: "initialize", kind: "uups"
    });
    await token.waitForDeployment();
  });

  describe("Baslatma", function () {
    it("Dogru isim ve sembol", async function () {
      expect(await token.name()).to.equal("MEEF");
      expect(await token.symbol()).to.equal("MEEF");
    });

    it("Toplam arz 1 milyar", async function () {
      expect(await token.totalSupply()).to.equal(ethers.parseEther("1000000000"));
    });

    it("Tum tokenlar sahibinde", async function () {
      expect(await token.balanceOf(owner.address)).to.equal(ethers.parseEther("1000000000"));
    });

    it("Sahip ve treasury whitelist'te", async function () {
      expect(await token.isWhitelisted(owner.address)).to.equal(true);
      expect(await token.isWhitelisted(treasury.address)).to.equal(true);
    });

    it("Versiyon 1.0.0", async function () {
      expect(await token.version()).to.equal("1.0.0");
    });
  });

  describe("Whitelist Transfer (kuralsiz)", function () {
    it("Whitelist adresten transfer kesintisiz", async function () {
      const amount = ethers.parseEther("1000");
      await token.transfer(addr1.address, amount);
      expect(await token.balanceOf(addr1.address)).to.equal(amount);
    });
  });

  describe("Islem Vergisi (%3)", function () {
    it("Normal transferde %3 vergi kesilir", async function () {
      await token.transfer(addr1.address, ethers.parseEther("10000"));
      await ethers.provider.send("evm_increaseTime", [8 * 86400]);
      await ethers.provider.send("evm_mine");
      const balanceBefore = await token.balanceOf(treasury.address);
      await token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"));
      const balanceAfter = await token.balanceOf(treasury.address);
      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("3"));
    });
  });

  describe("Erken Satis Cezasi (%15)", function () {
    it("7 gun icinde satista %15+%3 kesilir", async function () {
      await token.transfer(addr1.address, ethers.parseEther("10000"));
      const treasuryBefore = await token.balanceOf(treasury.address);
      await token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"));
      const treasuryAfter = await token.balanceOf(treasury.address);
      expect(treasuryAfter - treasuryBefore).to.equal(ethers.parseEther("18"));
    });
  });

  describe("Anti-Whale (%1 limit)", function () {
    it("Cuzdan %1 ustu alamaz", async function () {
      const overLimit = ethers.parseEther("10000001");
      await expect(
        token.transfer(addr1.address, overLimit)
      ).to.be.revertedWithCustomError(token, "WalletCapExceeded");
    });
  });

  describe("Gunluk Satis Limiti (%10)", function () {
    it("Gunluk %10 ustu satilamaz", async function () {
      await token.transfer(addr1.address, ethers.parseEther("10000"));
      await token.connect(addr1).transfer(addr2.address, ethers.parseEther("900"));
      await expect(
        token.connect(addr1).transfer(addr2.address, ethers.parseEther("200"))
      ).to.be.revertedWithCustomError(token, "DailySellLimitExceeded");
    });
  });

  describe("Blacklist", function () {
    it("Kara listedeki adres gonderemez", async function () {
      await token.transfer(addr1.address, ethers.parseEther("1000"));
      await token.blacklist(addr1.address);
      await expect(
        token.connect(addr1).transfer(addr2.address, ethers.parseEther("10"))
      ).to.be.revertedWithCustomError(token, "BlacklistedAddress");
    });
  });

  describe("Pause", function () {
    it("Pause durumunda transfer yapilamaz", async function () {
      await token.pause();
      await expect(
        token.transfer(addr1.address, ethers.parseEther("100"))
      ).to.be.reverted;
    });
  });

  describe("Mint", function () {
    it("Sahip yeni token basabilir", async function () {
      await token.mint(addr1.address, ethers.parseEther("5000"));
      expect(await token.balanceOf(addr1.address)).to.equal(ethers.parseEther("5000"));
    });
  });

  describe("Burn", function () {
    it("Token yakilabilir", async function () {
      await token.burn(ethers.parseEther("1000"));
      expect(await token.balanceOf(owner.address)).to.equal(ethers.parseEther("999999000"));
    });
  });
});
