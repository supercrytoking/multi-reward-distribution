import { ethers, network } from "hardhat";
import { MultiRewardDistribution, WrapERC20 } from "../typechain-types";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { getBigNumber } from "../utils";
import { constants } from "ethers";

describe("MultiRewardDistribution", function() {
    let MultiRewardDistribution: MultiRewardDistribution;
    let deployer: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let Token: WrapERC20;
    let StakingToken: WrapERC20;
    let snapshotId: string;
    const tokenAmount = getBigNumber(10_000);
    const rewardsDuration = 86400 * 7;
    
    before(async () =>{
        [deployer, alice, bob] = await ethers.getSigners();

        // deploy some tokens
        const tokenFactory = await ethers.getContractFactory("WrapERC20");
        Token = (await tokenFactory.deploy("Token", "T")) as WrapERC20;
        StakingToken = (await tokenFactory.deploy("Staking Token", "ST")) as WrapERC20;

        // deploy MultiRewardDistribution
        const contractFactory = await ethers.getContractFactory("MultiRewardDistribution");
        MultiRewardDistribution = (await contractFactory.deploy(StakingToken.address)) as MultiRewardDistribution;
        
        // mint some mim
        await Token.mint(deployer.address, tokenAmount);
        await StakingToken.mint(alice.address, tokenAmount);

        await Token.approve(MultiRewardDistribution.address, constants.MaxUint256);
        await StakingToken.connect(alice).approve(MultiRewardDistribution.address, constants.MaxUint256);

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
            const action = MultiRewardDistribution.addReward(StakingToken.address);
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
            expect(afterOwnerBalance).to.be.equal(beforeOwnerBalance.sub(tokenAmount));
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
            const action = MultiRewardDistribution.recoverERC20(StakingToken.address, 10);
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
    });

    describe("stake", () => {
        it("should emit Staked", async () => {
            const action = MultiRewardDistribution.connect(alice).stake(tokenAmount);
            await expect(action).to.emit(MultiRewardDistribution, "Staked").withArgs(alice.address, alice.address, tokenAmount);
        });

        it("should check 0 amount", async () => {
            const action = MultiRewardDistribution.connect(alice).stake(0);
            await expect(action).to.revertedWith('Cannot stake 0');
        });

        it("should stake", async () => {
            const beforeTotalSupply = await MultiRewardDistribution.totalSupply();
            const beforeAliceStakingTokenBalance = await StakingToken.balanceOf(alice.address);
            const beforeContractBalance = await StakingToken.balanceOf(MultiRewardDistribution.address);
            await MultiRewardDistribution.connect(alice).stake(tokenAmount);
            const afterTotalSupply = await MultiRewardDistribution.totalSupply();
            const afterAliceStakingTokenBalance = await StakingToken.balanceOf(alice.address);
            const afterContractBalance = await StakingToken.balanceOf(MultiRewardDistribution.address);

            expect(beforeTotalSupply).to.be.equal(0);
            expect(afterTotalSupply).to.be.equal(beforeTotalSupply.add(tokenAmount));
            expect(afterTotalSupply).not.be.equal(beforeTotalSupply);

            expect(beforeAliceStakingTokenBalance).to.be.equal(tokenAmount);
            expect(afterAliceStakingTokenBalance).to.be.equal(beforeAliceStakingTokenBalance.sub(tokenAmount));
            expect(afterAliceStakingTokenBalance).not.be.equal(beforeAliceStakingTokenBalance);

            expect(beforeContractBalance).to.be.equal(0);
            expect(afterContractBalance).to.be.equal(beforeContractBalance.add(tokenAmount));
            expect(afterContractBalance).not.be.equal(beforeContractBalance);

            const balance = await MultiRewardDistribution.balances(alice.address);
            expect(balance).to.be.equal(tokenAmount);
        });
    });

    describe("stakeFor", () => {
        it("should emit Staked", async () => {
            const action = MultiRewardDistribution.connect(alice).stakeFor(bob.address, tokenAmount);
            await expect(action).to.emit(MultiRewardDistribution, "Staked").withArgs(alice.address, bob.address, tokenAmount);
        });

        it("should check 0 amount", async () => {
            const action = MultiRewardDistribution.connect(alice).stakeFor(bob.address, 0);
            await expect(action).to.revertedWith('Cannot stake 0');
        });

        it("should stake", async () => {
            const beforeTotalSupply = await MultiRewardDistribution.totalSupply();
            const beforeAliceStakingTokenBalance = await StakingToken.balanceOf(alice.address);
            const beforeContractBalance = await StakingToken.balanceOf(MultiRewardDistribution.address);
            await MultiRewardDistribution.connect(alice).stakeFor(bob.address, tokenAmount);
            const afterTotalSupply = await MultiRewardDistribution.totalSupply();
            const afterAliceStakingTokenBalance = await StakingToken.balanceOf(alice.address);
            const afterContractBalance = await StakingToken.balanceOf(MultiRewardDistribution.address);

            expect(beforeTotalSupply).to.be.equal(0);
            expect(afterTotalSupply).to.be.equal(beforeTotalSupply.add(tokenAmount));
            expect(afterTotalSupply).not.be.equal(beforeTotalSupply);

            expect(beforeAliceStakingTokenBalance).to.be.equal(tokenAmount);
            expect(afterAliceStakingTokenBalance).to.be.equal(beforeAliceStakingTokenBalance.sub(tokenAmount));
            expect(afterAliceStakingTokenBalance).not.be.equal(beforeAliceStakingTokenBalance);

            expect(beforeContractBalance).to.be.equal(0);
            expect(afterContractBalance).to.be.equal(beforeContractBalance.add(tokenAmount));
            expect(afterContractBalance).not.be.equal(beforeContractBalance);

            const balanceBobe = await MultiRewardDistribution.balances(bob.address);
            expect(balanceBobe).to.be.equal(tokenAmount);
            const balanceAlice = await MultiRewardDistribution.balances(alice.address);
            expect(balanceAlice).to.be.equal(0);
        });
    });

    describe("withdraw", () => {
        beforeEach("added token", async () => {
            await MultiRewardDistribution.addReward(Token.address);
        });

        beforeEach("added rewards", async () => {
            await MultiRewardDistribution.notifyReward(Token.address, tokenAmount);
        });

        beforeEach("stake token", async () => {
            await MultiRewardDistribution.connect(alice).stake(tokenAmount);
        });

        it("should check 0 amount", async () => {
            const action = MultiRewardDistribution.connect(alice).withdraw(0, false);
            await expect(action).to.revertedWith('AGB');
        });

        it("should emit Withdrawn", async () => {
            const action = MultiRewardDistribution.connect(alice).withdraw(tokenAmount, false);
            await expect(action).to.emit(MultiRewardDistribution, "Withdrawn").withArgs(alice.address, tokenAmount);
        });

        it("should emit RewardPaid", async () => {
            const action = MultiRewardDistribution.connect(alice).withdraw(tokenAmount, true);
            await expect(action).to.emit(MultiRewardDistribution, "RewardPaid").withArgs(alice.address, alice.address, Token.address, "16534391534391534");
        });

        it("should return staking token without claim rewards", async () => {
            const beforeTotalSupply = await MultiRewardDistribution.totalSupply();
            const beforeStakingTokenBalance = await StakingToken.balanceOf(alice.address);
            const beforeBalance = await MultiRewardDistribution.balances(alice.address);
            await MultiRewardDistribution.connect(alice).withdraw(tokenAmount, false);
            const afterTotalSupply = await MultiRewardDistribution.totalSupply();
            const afterStakingTokenBalance = await StakingToken.balanceOf(alice.address);
            const afterBalance = await MultiRewardDistribution.balances(alice.address);

            expect(beforeTotalSupply).to.be.equal(tokenAmount);
            expect(afterTotalSupply).to.be.equal(0);
            expect(afterTotalSupply).not.be.equal(beforeTotalSupply);

            expect(beforeStakingTokenBalance).to.be.equal(0);
            expect(afterStakingTokenBalance).to.be.equal(tokenAmount);
            expect(afterStakingTokenBalance).not.be.equal(beforeStakingTokenBalance);

            expect(beforeBalance).to.be.equal(tokenAmount);
            expect(afterBalance).to.be.equal(0);
            expect(afterBalance).not.be.equal(beforeBalance);
        });

        it("should return staking token with claim rewards", async () => {
            const beforeTotalSupply = await MultiRewardDistribution.totalSupply();
            const beforeStakingTokenBalance = await StakingToken.balanceOf(alice.address);
            const beforeBalance = await MultiRewardDistribution.balances(alice.address);
            const beforeRewardTokenBalance = await Token.balanceOf(alice.address);
            const userRewardPerTokenPaid = await MultiRewardDistribution.userRewardPerTokenPaid(alice.address, Token.address);

            await MultiRewardDistribution.connect(alice).withdraw(tokenAmount, true);

            const afterTotalSupply = await MultiRewardDistribution.totalSupply();
            const afterStakingTokenBalance = await StakingToken.balanceOf(alice.address);
            const afterBalance = await MultiRewardDistribution.balances(alice.address);
            const afterRewardTokenBalance = await Token.balanceOf(alice.address);

            const { rewardPerTokenStored } = await MultiRewardDistribution.rewardData(Token.address);
            const rewardAmount = tokenAmount.mul(rewardPerTokenStored.sub(userRewardPerTokenPaid)).div(getBigNumber(1));

            expect(beforeTotalSupply).to.be.equal(tokenAmount);
            expect(afterTotalSupply).to.be.equal(0);
            expect(afterTotalSupply).not.be.equal(beforeTotalSupply);

            expect(beforeStakingTokenBalance).to.be.equal(0);
            expect(afterStakingTokenBalance).to.be.equal(tokenAmount);
            expect(afterStakingTokenBalance).not.be.equal(beforeStakingTokenBalance);

            expect(beforeBalance).to.be.equal(tokenAmount);
            expect(afterBalance).to.be.equal(0);
            expect(afterBalance).not.be.equal(beforeBalance);

            expect(beforeRewardTokenBalance).to.be.equal(0);
            expect(afterRewardTokenBalance).to.be.equal(rewardAmount.div("1000000000000"));
            expect(afterRewardTokenBalance).not.be.equal(beforeRewardTokenBalance);
        });
    });

    describe("getReward", () => {
        beforeEach("added token", async () => {
            await MultiRewardDistribution.addReward(Token.address);
        });

        beforeEach("added rewards", async () => {
            await MultiRewardDistribution.notifyReward(Token.address, tokenAmount);
        });

        beforeEach("stake token", async () => {
            await MultiRewardDistribution.connect(alice).stake(tokenAmount);
        });

        it("should emit RewardPaid", async () => {
            const action = MultiRewardDistribution.connect(alice).getReward([Token.address]);
            await expect(action).to.emit(MultiRewardDistribution, "RewardPaid").withArgs(alice.address, alice.address, Token.address, "16534391534391534");
        });

        it("should return rewards", async () => {
            const beforeRewardTokenBalance = await Token.balanceOf(alice.address);
            const userRewardPerTokenPaid = await MultiRewardDistribution.userRewardPerTokenPaid(alice.address, Token.address);

            await MultiRewardDistribution.connect(alice).getReward([Token.address]);

            const afterRewardTokenBalance = await Token.balanceOf(alice.address);

            const { rewardPerTokenStored } = await MultiRewardDistribution.rewardData(Token.address);
            const rewardAmount = tokenAmount.mul(rewardPerTokenStored.sub(userRewardPerTokenPaid)).div(getBigNumber(1));

            expect(beforeRewardTokenBalance).to.be.equal(0);
            expect(afterRewardTokenBalance).to.be.equal(rewardAmount.div("1000000000000"));
            expect(afterRewardTokenBalance).not.be.equal(beforeRewardTokenBalance);
        });
    });

    describe("getRewardFor", () => {
        beforeEach("added token", async () => {
            await MultiRewardDistribution.addReward(Token.address);
        });

        beforeEach("added rewards", async () => {
            await MultiRewardDistribution.notifyReward(Token.address, tokenAmount);
        });

        beforeEach("stake token", async () => {
            await MultiRewardDistribution.connect(alice).stake(tokenAmount);
        });

        it("should emit RewardPaid", async () => {
            const action = MultiRewardDistribution.connect(alice).getRewardFor([Token.address], bob.address);
            await expect(action).to.emit(MultiRewardDistribution, "RewardPaid").withArgs(alice.address, bob.address, Token.address, "16534391534391534");
        });

        it("should return rewards", async () => {
            const beforeRewardTokenBalance = await Token.balanceOf(bob.address);
            const userRewardPerTokenPaid = await MultiRewardDistribution.userRewardPerTokenPaid(alice.address, Token.address);

            await MultiRewardDistribution.connect(alice).getRewardFor([Token.address], bob.address);

            const afterRewardTokenBalance = await Token.balanceOf(bob.address);

            const { rewardPerTokenStored } = await MultiRewardDistribution.rewardData(Token.address);
            const rewardAmount = tokenAmount.mul(rewardPerTokenStored.sub(userRewardPerTokenPaid)).div(getBigNumber(1));

            expect(beforeRewardTokenBalance).to.be.equal(0);
            expect(afterRewardTokenBalance).to.be.equal(rewardAmount.div("1000000000000"));
            expect(afterRewardTokenBalance).not.be.equal(beforeRewardTokenBalance);
        });
    });

    describe("rewardPerToken", () => {
        beforeEach("added token", async () => {
            await MultiRewardDistribution.addReward(Token.address);
        });

        beforeEach("added rewards", async () => {
            await MultiRewardDistribution.notifyReward(Token.address, tokenAmount);
        });

        it("shoild return rewardPerToken", async () => {
            const { rewardPerTokenStored } = await MultiRewardDistribution.rewardData(Token.address);
            const rewardPerToken = await MultiRewardDistribution.rewardPerToken(Token.address);
            expect(rewardPerToken).to.be.equal(rewardPerTokenStored);
        });
    });

    describe("getRewardForDuration", () => {
        beforeEach("added token", async () => {
            await MultiRewardDistribution.addReward(Token.address);
        });

        beforeEach("added rewards", async () => {
            await MultiRewardDistribution.notifyReward(Token.address, tokenAmount);
        });

        it("shoild return rewardPerToken", async () => {
            const { rewardRate } = await MultiRewardDistribution.rewardData(Token.address);
            const rfd = rewardRate.mul(rewardsDuration).div("1000000000000");
            const getRewardForDuration = await MultiRewardDistribution.getRewardForDuration(Token.address);
            expect(getRewardForDuration).to.be.equal(rfd);
        });
    });

    describe("claimableRewards", () => {
        beforeEach("added token", async () => {
            await MultiRewardDistribution.addReward(Token.address);
        });

        beforeEach("added rewards", async () => {
            await MultiRewardDistribution.notifyReward(Token.address, tokenAmount);
        });

        it('should return rewards list', async () => {
            const claimableRewards = await MultiRewardDistribution.claimableRewards(alice.address);
            const { token, amount } = claimableRewards[0];
            expect(token).to.be.equal(Token.address);
            expect(amount).to.be.equal(getBigNumber(0));
        });
    });
});