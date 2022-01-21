import { ethers, network } from "hardhat";
import { MultiRewardDistribution, WrapERC20 } from "../typechain-types";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { getBigNumber } from "../utils";
import { constants } from "ethers";

const WMEMO_ADDRESS = "0x0da67235dD5787D67955420C84ca1cEcd4E5Bb3b";

describe("MultiRewardDistribution", function() {
    let MultiRewardDistribution: MultiRewardDistribution;
    let deployer: SignerWithAddress;
    let alice: SignerWithAddress;
    let Token: WrapERC20;
    let snapshotId: string;
    const tokenAmount = getBigNumber(10_000);
    const rewardsDuration = 86400 * 7;
    
    before(async () =>{
        [deployer, alice] = await ethers.getSigners();

        // deploy MultiRewardDistribution
        const contractFactory = await ethers.getContractFactory("MultiRewardDistribution");
        MultiRewardDistribution = (await contractFactory.deploy(WMEMO_ADDRESS)) as MultiRewardDistribution;

        // deploy some tokens
        const tokenFactory = await ethers.getContractFactory("WrapERC20");
        Token = (await tokenFactory.deploy("Token 1", "T1")) as WrapERC20;
        
        // mint some mim
        await Token.mint(deployer.address, tokenAmount);

        await Token.approve(MultiRewardDistribution.address, constants.MaxUint256);

        snapshotId = await ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async () => {
        await network.provider.send("evm_revert", [snapshotId]);
        snapshotId = await ethers.provider.send("evm_snapshot", []);
    });
    
    describe("addReward", ()=> {
        it("should added reward token", async function () {
            await MultiRewardDistribution.addReward(Token.address);      
            const rewardToken = await MultiRewardDistribution.rewardTokens(0);
            const rewardTokenLength = await MultiRewardDistribution.rewardTokenLength();
      
            expect(rewardToken).to.be.equal(Token.address);
            expect(rewardTokenLength).to.be.equal(1);
        });

        it("should execute only by the owner", async function () {
            const action = MultiRewardDistribution.connect(alice).addReward(Token.address);
            await expect(action).to.revertedWith('Ownable: caller is not the owner');
        });

        it("should check for staking token", async function () {
            const action = MultiRewardDistribution.addReward(WMEMO_ADDRESS);
            await expect(action).to.revertedWith('ANA');
        });
    });

    describe("removeReward", () => {
        beforeEach("added token", async () => {
            await MultiRewardDistribution.addReward(Token.address);
        });

        it("should remove reward token", async function () {
            await MultiRewardDistribution.removeReward(0);

            const rewardTokenLength = await MultiRewardDistribution.rewardTokenLength();
            expect(rewardTokenLength).to.be.equal(0);
        });

        it("should execute only by the owner", async function () {
            const action = MultiRewardDistribution.connect(alice).removeReward(0);
            await expect(action).to.revertedWith('Ownable: caller is not the owner');
        });
    });

    describe("lastTimeRewardApplicable", () => {
        beforeEach("added token", async () => {
            await MultiRewardDistribution.addReward(Token.address);
        });

        it("should return last time reward applicable", async () => {
            const lastTimeRewardApplicable = await MultiRewardDistribution.lastTimeRewardApplicable(Token.address);

            const currentBlock = await ethers.provider.getBlockNumber();
            const blockTime = (await ethers.provider.getBlock(currentBlock)).timestamp;

            expect(lastTimeRewardApplicable).to.be.equal(blockTime);
        });
    });

    describe("rewardPerToken", () => {
        beforeEach("added token", async () => {
            await MultiRewardDistribution.addReward(Token.address);
        });

        it("should return reward per token", async () => {
            const rewardPerToken = await MultiRewardDistribution.rewardPerToken(Token.address);
            expect(rewardPerToken).to.be.equal(0);
        });
    });

    describe("getRewardForDuration", () => {
        beforeEach("added token", async () => {
            await MultiRewardDistribution.addReward(Token.address);
        });

        it("should return reward for duration", async () => {
            const rewardPerToken = await MultiRewardDistribution.getRewardForDuration(Token.address);
            expect(rewardPerToken).to.be.equal(0);
        });
    });

    describe("rewardTokenLength", () => {
        it("should return reward token length (0)", async () => {
            const rewardTokenLength = await MultiRewardDistribution.rewardTokenLength();
            expect(rewardTokenLength).to.be.equal(0);
        });

        it("should return reward token length (1)", async () => {
            await MultiRewardDistribution.addReward(Token.address);
            const rewardTokenLength = await MultiRewardDistribution.rewardTokenLength();
            expect(rewardTokenLength).to.be.equal(1);
        });
    });

    describe("notifyReward", () => {
        beforeEach("added token", async () => {
            await MultiRewardDistribution.addReward(Token.address);
        });

        it("should added reward for token", async () => {
            const beforeOwnerBalance = await Token.balanceOf(deployer.address);
            await MultiRewardDistribution.notifyReward(Token.address, tokenAmount);
            const afterOwnerBalance = await Token.balanceOf(deployer.address);
            const { periodFinish, rewardRate, lastUpdateTime, rewardPerTokenStored } = await MultiRewardDistribution.rewardData(Token.address);
            const currentBlock = await ethers.provider.getBlockNumber();
            const blockTime = (await ethers.provider.getBlock(currentBlock)).timestamp;

            expect(beforeOwnerBalance).to.be.equal(tokenAmount);
            expect(afterOwnerBalance).to.be.equal(0);
            expect(afterOwnerBalance).not.be.equal(beforeOwnerBalance);
            expect(rewardPerTokenStored).to.be.equal(0);
            expect(lastUpdateTime).to.be.equal(blockTime);
            expect(periodFinish).to.be.equal(blockTime + rewardsDuration);
            expect(rewardRate).to.be.equal(tokenAmount.mul(1e12).div(rewardsDuration));
        });

        it("should execute only by the owner", async function () {
            const action = MultiRewardDistribution.connect(alice).notifyReward(Token.address, tokenAmount);
            await expect(action).to.revertedWith('Ownable: caller is not the owner');
        });
    });

    describe("setRewardRate", () => {
        beforeEach("added token", async () => {
            await MultiRewardDistribution.addReward(Token.address);
        });

        it("should update rewardRate", async () => {
            await MultiRewardDistribution.setRewardRate(Token.address, 10);

            const { rewardRate, lastUpdateTime, rewardPerTokenStored } = await MultiRewardDistribution.rewardData(Token.address);
            const currentBlock = await ethers.provider.getBlockNumber();
            const blockTime = (await ethers.provider.getBlock(currentBlock)).timestamp;

            expect(rewardPerTokenStored).to.be.equal(0);
            expect(lastUpdateTime).to.be.equal(blockTime);
            expect(rewardRate).to.be.equal(10);
        });

        it("should emit RateChanged event", async () => {
            const action = MultiRewardDistribution.setRewardRate(Token.address, 10);
            await expect(action).to.emit(MultiRewardDistribution, 'RateChanged').withArgs(Token.address, 0, 10);
        });

        it("should execute only by the owner", async function () {
            const action = MultiRewardDistribution.connect(alice).setRewardRate(Token.address, 10);
            await expect(action).to.revertedWith('Ownable: caller is not the owner');
        });
    });

    describe("recoverERC20", () => {
        beforeEach("added token", async () => {
            await MultiRewardDistribution.addReward(Token.address);
        });

        beforeEach("added rewards", async () => {
            await MultiRewardDistribution.notifyReward(Token.address, tokenAmount);
        });

        it("should emit Recovered", async () => {
            await MultiRewardDistribution.setRewardRate(Token.address, 0);
            const action = MultiRewardDistribution.recoverERC20(Token.address, tokenAmount);
            await expect(action).to.emit(MultiRewardDistribution, "Recovered").withArgs(Token.address, tokenAmount);
        });

        it("should transfer tokens to owner", async () => {
            await MultiRewardDistribution.setRewardRate(Token.address, 0);
            const beforeOwnerBalance = await Token.balanceOf(deployer.address);
            await MultiRewardDistribution.recoverERC20(Token.address, tokenAmount);
            const afterOwnerBalance = await Token.balanceOf(deployer.address);

            expect(beforeOwnerBalance).to.be.equal(0);
            expect(afterOwnerBalance).to.be.equal(tokenAmount);
            expect(afterOwnerBalance).not.be.equal(beforeOwnerBalance);
        });

        it("should check staking address", async function () {
            const action = MultiRewardDistribution.recoverERC20(WMEMO_ADDRESS, 10);
            await expect(action).to.revertedWith('Cannot withdraw staking token');
        });

        it("should check reward address", async function () {
            const action = MultiRewardDistribution.recoverERC20(Token.address, 0);
            await expect(action).to.revertedWith('Cannot withdraw reward token');
        });

        it("should execute only by the owner", async function () {
            const action = MultiRewardDistribution.connect(alice).recoverERC20(Token.address, 10);
            await expect(action).to.revertedWith('Ownable: caller is not the owner');
        });
    })
});