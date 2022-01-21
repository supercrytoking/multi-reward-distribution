import { BigNumber } from "ethers";
import { BASE_TEN } from "./constants";

// Defaults to e18 using amount * 10^18
export function getBigNumber(amount: any, decimals = 18) {
    return BigNumber.from(amount).mul(BigNumber.from(BASE_TEN).pow(decimals))
}