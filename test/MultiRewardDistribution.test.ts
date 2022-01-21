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
    let Token1: WrapERC20;
    let Token2: WrapERC20;
    let snapshotId: string;

    before(async () =>{
        [deployer, alice] = await ethers.getSigners();

        // deploy MultiRewardDistribution
        const contractFactory = await ethers.getContractFactory("MultiRewardDistribution");
        MultiRewardDistribution = (await contractFactory.deploy(WMEMO_ADDRESS)) as MultiRewardDistribution;

        // deploy some tokens
        const tokenFactory = await ethers.getContractFactory("WrapERC20");
        Token1 = (await tokenFactory.deploy("Token 1", "T1")) as WrapERC20;
        Token2 = (await tokenFactory.deploy("Token 2", "T2")) as WrapERC20;
        
        // mint some mim
        await Token1.mint(deployer.address, getBigNumber(10_000));
        await Token2.mint(deployer.address, getBigNumber(20_000));

        await Token1.approve(MultiRewardDistribution.address, constants.MaxUint256);
        await Token2.approve(MultiRewardDistribution.address, constants.MaxUint256);

        snapshotId = await ethers.provider.send("evm_snapshot", []);
    });

    afterEach(async () => {
        await network.provider.send("evm_revert", [snapshotId]);
        snapshotId = await ethers.provider.send("evm_snapshot", []);
    });
    
    describe("addReward", ()=> {
        it("should added reward token", async function () {
            await MultiRewardDistribution.addReward(Token1.address);      
            const rewardToken = await MultiRewardDistribution.rewardTokens(0);
      
            expect(rewardToken).to.be.equal(Token1.address);
        });

        it("should execute only by the owner", async function () {
            const action = MultiRewardDistribution.connect(alice).addReward(Token1.address);
            await expect(action).to.revertedWith('Ownable: caller is not the owner');
        });
    });

    // describe("removeReward", ()=> {
    //     it("should added reward token", async function () {
    //         await MultiRewardDistribution.addReward(Token1.address);      
    //         const rewardToken = await MultiRewardDistribution.rewardTokens(0);
      
    //         expect(rewardToken).to.be.equal(Token1.address);
    //     });

    //     it("should execute only by the owner", async function () {
    //         const action = MultiRewardDistribution.connect(alice).addReward(Token1.address);
    //         await expect(action).to.revertedWith('Ownable: caller is not the owner');
    //     });
    // });
});